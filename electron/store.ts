import fsp from 'node:fs/promises';
import path from 'node:path';
import { emptyLibrary, normalizeLibrary, type Library } from '../src/shared/model';
import { defaultSettings, normalizeSettings, type Settings } from '../src/shared/settings';
import type { SnapshotInfo } from '../src/shared/ipc';
import { ensureDir, exists, LatestWriter, readJson, sha256, stamp, writeFileAtomic } from './fsutil';

const SNAP_RE = /^snapshot-(\d{8})-(\d{6})-([a-z-]+)\.json$/;

export class DataStore {
  readonly libFile: string;
  readonly settingsFile: string;
  readonly mediaDir: string;
  readonly snapDir: string;
  private readonly snapIndexFile: string;

  library: Library = emptyLibrary();
  settings: Settings = defaultSettings();

  private lastSavedJson = '';
  private lastSnapshotHash: string | null = null;
  changedSinceSnapshot = false;
  changedSinceFullBackup = false;

  private readonly libWriter: LatestWriter<string>;
  private readonly settingsWriter: LatestWriter<string>;

  constructor(readonly dir: string) {
    this.libFile = path.join(dir, 'library.json');
    this.settingsFile = path.join(dir, 'settings.json');
    this.mediaDir = path.join(dir, 'Media');
    this.snapDir = path.join(dir, 'Snapshots');
    this.snapIndexFile = path.join(this.snapDir, 'index.json');
    this.libWriter = new LatestWriter((json) => writeFileAtomic(this.libFile, json, true));
    this.settingsWriter = new LatestWriter((json) => writeFileAtomic(this.settingsFile, json, true));
  }

  /** Loads everything from disk, falling back to the backup copy or the newest snapshot if a file is damaged. */
  async init(): Promise<{ recovered: string | null; firstRun: boolean }> {
    await ensureDir(this.dir);
    await ensureDir(this.mediaDir);
    await ensureDir(this.snapDir);
    let recovered: string | null = null;
    const hadLibrary = (await exists(this.libFile)) || (await exists(this.libFile + '.bak'));

    const tryLoad = async (file: string): Promise<Library | null> => {
      try {
        const raw = await readJson<any>(file);
        if (!raw || typeof raw !== 'object' || !Array.isArray(raw.critiques)) throw new Error('not a library');
        return normalizeLibrary(raw);
      } catch {
        return null;
      }
    };

    let lib: Library | null = null;
    if (await exists(this.libFile)) {
      lib = await tryLoad(this.libFile);
      if (!lib) {
        // keep the damaged file for inspection instead of overwriting it
        const keep = path.join(this.dir, `library.damaged-${stamp()}.json`);
        try {
          await fsp.copyFile(this.libFile, keep);
        } catch {
          /* ignore */
        }
      }
    }
    if (!lib && (await exists(this.libFile + '.bak'))) {
      lib = await tryLoad(this.libFile + '.bak');
      if (lib) recovered = 'the automatic backup copy';
    }
    if (!lib && hadLibrary) {
      const snaps = await this.listSnapshots();
      for (const s of snaps) {
        lib = await tryLoad(path.join(this.snapDir, s.name));
        if (lib) {
          recovered = `the snapshot from ${new Date(s.createdAt).toLocaleString()}`;
          break;
        }
      }
    }
    this.library = lib ?? emptyLibrary();
    this.lastSavedJson = JSON.stringify(this.library);
    if (recovered) await this.saveLibrary(this.library);

    try {
      this.settings = normalizeSettings(await readJson(this.settingsFile));
    } catch {
      try {
        this.settings = normalizeSettings(await readJson(this.settingsFile + '.bak'));
      } catch {
        this.settings = defaultSettings();
      }
    }

    const idx = await this.readIndex();
    this.lastSnapshotHash = idx[0]?.hash ?? null;
    return { recovered, firstRun: !hadLibrary };
  }

  async saveLibrary(lib: Library): Promise<{ ok: boolean; error?: string }> {
    const clean = normalizeLibrary(lib);
    const json = JSON.stringify(clean);
    this.library = clean;
    if (json === this.lastSavedJson && (await exists(this.libFile))) return { ok: true };
    this.lastSavedJson = json;
    this.changedSinceSnapshot = true;
    this.changedSinceFullBackup = true;
    return this.libWriter.write(json);
  }

  async saveSettings(s: Settings): Promise<{ ok: boolean; error?: string }> {
    this.settings = normalizeSettings(s);
    return this.settingsWriter.write(JSON.stringify(this.settings, null, 2));
  }

  async flush(): Promise<void> {
    await this.libWriter.idle();
    await this.settingsWriter.idle();
  }

  /* ---------------------------- snapshots ---------------------------- */

  private async readIndex(): Promise<Array<SnapshotInfo & { hash: string }>> {
    try {
      const idx = await readJson<any[]>(this.snapIndexFile);
      if (Array.isArray(idx)) return idx.filter((x) => x && typeof x.name === 'string');
    } catch {
      /* rebuild below */
    }
    return this.rebuildIndex();
  }

  private async rebuildIndex(): Promise<Array<SnapshotInfo & { hash: string }>> {
    let names: string[] = [];
    try {
      names = (await fsp.readdir(this.snapDir)).filter((n) => SNAP_RE.test(n));
    } catch {
      return [];
    }
    const out: Array<SnapshotInfo & { hash: string }> = [];
    for (const name of names) {
      try {
        const file = path.join(this.snapDir, name);
        const txt = await fsp.readFile(file, 'utf8');
        const raw = JSON.parse(txt);
        const m = SNAP_RE.exec(name)!;
        out.push({
          name,
          createdAt: parseStamp(m[1], m[2]),
          critiques: Array.isArray(raw.critiques) ? raw.critiques.length : 0,
          watchlist: Array.isArray(raw.watchlist) ? raw.watchlist.length : 0,
          size: txt.length,
          reason: m[3],
          hash: sha256(txt),
        });
      } catch {
        /* skip unreadable snapshot */
      }
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    await writeFileAtomic(this.snapIndexFile, JSON.stringify(out, null, 1));
    return out;
  }

  async listSnapshots(): Promise<SnapshotInfo[]> {
    const idx = await this.readIndex();
    return idx.map(({ hash: _h, ...rest }) => rest);
  }

  /** Saves a copy of the current library into the Snapshots folder. Skips it when nothing changed since the last one. */
  async snapshot(reason: string, force = false): Promise<SnapshotInfo | null> {
    await this.libWriter.idle();
    const lib = this.library;
    if (!lib.critiques.length && !lib.watchlist.length && !lib.drafts.length) return null;
    const json = JSON.stringify(lib);
    const hash = sha256(json);
    if (!force && hash === this.lastSnapshotHash) {
      this.changedSinceSnapshot = false;
      return null;
    }
    const safeReason = reason.toLowerCase().replace(/[^a-z-]/g, '-').slice(0, 24) || 'auto';
    const st = stamp();
    let name = `snapshot-${st}-${safeReason}.json`;
    const idx = await this.readIndex();
    if (idx.some((s) => s.name === name)) name = `snapshot-${st}-${safeReason}-b.json`;
    await writeFileAtomic(path.join(this.snapDir, name), json);
    const info = {
      name,
      createdAt: Date.now(),
      critiques: lib.critiques.length,
      watchlist: lib.watchlist.length,
      size: json.length,
      reason: safeReason,
      hash,
    };
    const next = [info, ...idx.filter((s) => s.name !== name)];
    const kept = await this.prune(next);
    await writeFileAtomic(this.snapIndexFile, JSON.stringify(kept, null, 1));
    this.lastSnapshotHash = hash;
    this.changedSinceSnapshot = false;
    const { hash: _h, ...pub } = info;
    return pub;
  }

  /** Keeps the 40 newest snapshots, one per day for 90 days, and one per month beyond that. */
  private async prune(list: Array<SnapshotInfo & { hash: string }>): Promise<Array<SnapshotInfo & { hash: string }>> {
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
    const keep = new Set<string>();
    sorted.slice(0, 40).forEach((s) => keep.add(s.name));
    const now = Date.now();
    const seenDay = new Set<string>();
    const seenMonth = new Set<string>();
    for (const s of sorted) {
      const d = new Date(s.createdAt);
      const day = d.toISOString().slice(0, 10);
      const month = day.slice(0, 7);
      const age = now - s.createdAt;
      if (age <= 90 * 864e5) {
        if (!seenDay.has(day)) {
          seenDay.add(day);
          keep.add(s.name);
        }
      } else if (!seenMonth.has(month)) {
        seenMonth.add(month);
        keep.add(s.name);
      }
    }
    for (const s of sorted) {
      if (!keep.has(s.name)) {
        try {
          await fsp.unlink(path.join(this.snapDir, s.name));
        } catch {
          /* already gone */
        }
      }
    }
    return sorted.filter((s) => keep.has(s.name));
  }

  async readSnapshot(name: string): Promise<Library> {
    if (!SNAP_RE.test(name)) throw new Error('Not a snapshot name');
    const raw = await readJson<any>(path.join(this.snapDir, name));
    return normalizeLibrary(raw);
  }
}

function parseStamp(day: string, time: string): number {
  const y = +day.slice(0, 4);
  const mo = +day.slice(4, 6) - 1;
  const d = +day.slice(6, 8);
  const h = +time.slice(0, 2);
  const mi = +time.slice(2, 4);
  const s = +time.slice(4, 6);
  return new Date(y, mo, d, h, mi, s).getTime();
}
