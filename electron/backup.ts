import fsp from 'node:fs/promises';
import path from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import {
  CLASS_BY_KEY,
  SCORES,
  TYPE_LABEL,
  classOf,
  emptyLibrary,
  fromLegacyCritique,
  fromLegacyWatch,
  mediaRefs,
  mergeLibraries,
  normalizeLibrary,
  ratingOf,
  type Library,
} from '../src/shared/model';
import { normalizeSettings, type Settings } from '../src/shared/settings';
import type { ImportPreview, ImportResult } from '../src/shared/ipc';
import type { DataStore } from './store';
import { dataUrlToBytes, MEDIA_NAME } from './media';
import { ensureDir, exists, humanStamp, sha256, writeFileAtomic } from './fsutil';

export const BACKUP_EXT = 'irisbackup';
const MIRROR_RE = /^Iris Backup \d{4}-\d{2}-\d{2} \d{4}( \d+)?\.irisbackup$/;

interface ParsedBackup {
  library: Library;
  settings: Settings | null;
  media: Map<string, Uint8Array>;
  createdAt: number | null;
  appVersion: string | null;
}

export async function buildBackup(store: DataStore, appVersion: string): Promise<Uint8Array> {
  await store.flush();
  const lib = store.library;
  const files: Zippable = {
    'manifest.json': strToU8(
      JSON.stringify(
        {
          format: 'iris-backup',
          version: 1,
          app: 'Iris',
          appVersion,
          createdAt: Date.now(),
          counts: {
            critiques: lib.critiques.length,
            watchlist: lib.watchlist.length,
            drafts: lib.drafts.length,
            trash: lib.trash.length,
          },
        },
        null,
        2,
      ),
    ),
    'library.json': strToU8(JSON.stringify(lib, null, 1)),
    'settings.json': strToU8(JSON.stringify(store.settings, null, 2)),
  };
  for (const name of mediaRefs(lib)) {
    try {
      const data = await fsp.readFile(path.join(store.mediaDir, name));
      files['media/' + name] = [new Uint8Array(data), { level: 0 }];
    } catch {
      /* a missing image is skipped rather than failing the whole backup */
    }
  }
  return zipSync(files, { level: 6 });
}

/** Reads an Iris backup, an Iris snapshot/library file, or an old Marquee backup file. */
export async function parseBackupFile(file: string): Promise<ParsedBackup> {
  const buf = new Uint8Array(await fsp.readFile(file));
  if (buf.byteLength < 4) throw new Error('That file is empty.');
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (isZip) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(buf);
    } catch {
      throw new Error('That backup file is damaged and could not be opened.');
    }
    const manifest = entries['manifest.json'] ? JSON.parse(strFromU8(entries['manifest.json'])) : null;
    if (!entries['library.json']) throw new Error('This is not an Iris backup file.');
    const library = normalizeLibrary(JSON.parse(strFromU8(entries['library.json'])));
    const settings = entries['settings.json'] ? normalizeSettings(JSON.parse(strFromU8(entries['settings.json']))) : null;
    const media = new Map<string, Uint8Array>();
    for (const [k, v] of Object.entries(entries)) {
      if (!k.startsWith('media/')) continue;
      const name = k.slice(6);
      if (MEDIA_NAME.test(name)) media.set(name, v);
    }
    return {
      library,
      settings,
      media,
      createdAt: Number(manifest?.createdAt) || null,
      appVersion: typeof manifest?.appVersion === 'string' ? manifest.appVersion : null,
    };
  }
  let raw: any;
  try {
    raw = JSON.parse(strFromU8(buf));
  } catch {
    throw new Error('This file is not a backup Iris can read.');
  }
  if (raw && Array.isArray(raw.critiques)) {
    return { library: normalizeLibrary(raw), settings: null, media: new Map(), createdAt: null, appVersion: null };
  }
  if (raw && (Array.isArray(raw.items) || Array.isArray(raw.watchlist))) {
    // Old Marquee / Verdict backup file
    const lib = emptyLibrary();
    const media = new Map<string, Uint8Array>();
    const pending: Array<{ idx: number; dataUrl: string }> = [];
    (raw.items || []).forEach((it: any) => {
      const { critique, posterDataUrl } = fromLegacyCritique(it);
      if (!critique.title) return;
      lib.critiques.push(critique);
      if (posterDataUrl) pending.push({ idx: lib.critiques.length - 1, dataUrl: posterDataUrl });
    });
    (raw.watchlist || []).forEach((w: any, i: number) => {
      const item = fromLegacyWatch(w, i);
      if (item.title) lib.watchlist.push(item);
    });
    for (const p of pending) {
      const d = dataUrlToBytes(p.dataUrl);
      if (!d) continue;
      const name = sha256(d.bytes).slice(0, 40) + '.' + d.ext;
      media.set(name, d.bytes);
      lib.critiques[p.idx].poster = name;
    }
    const at = Date.parse(raw.exportedAt);
    return { library: lib, settings: null, media, createdAt: Number.isFinite(at) ? at : null, appVersion: 'Marquee' };
  }
  throw new Error('This file is not a backup Iris can read.');
}

export async function previewBackupFile(file: string): Promise<ImportPreview> {
  const p = await parseBackupFile(file);
  return {
    file,
    createdAt: p.createdAt,
    appVersion: p.appVersion,
    critiques: p.library.critiques.length,
    watchlist: p.library.watchlist.length,
    drafts: p.library.drafts.length,
    titles: p.library.critiques.slice(0, 6).map((c) => c.title),
  };
}

export async function importBackupFile(
  store: DataStore,
  file: string,
  mode: 'merge' | 'replace',
  restoreSettings: boolean,
): Promise<ImportResult> {
  let parsed: ParsedBackup;
  try {
    parsed = await parseBackupFile(file);
  } catch (e: any) {
    return { ok: false, mode, added: 0, updated: 0, library: store.library, error: e?.message || String(e) };
  }
  // A safety net: whatever happens next can be undone from Snapshots.
  await store.snapshot('before-import', true);
  for (const [name, bytes] of parsed.media) {
    const target = path.join(store.mediaDir, name);
    if (!(await exists(target))) {
      await ensureDir(store.mediaDir);
      await writeFileAtomic(target, bytes);
    }
  }
  let result: { lib: Library; added: number; updated: number };
  if (mode === 'replace') {
    result = { lib: parsed.library, added: parsed.library.critiques.length, updated: 0 };
  } else {
    result = mergeLibraries(store.library, parsed.library);
  }
  result.lib.meta = { ...store.library.meta, ...result.lib.meta, legacyCheckedAt: store.library.meta.legacyCheckedAt ?? result.lib.meta.legacyCheckedAt };
  await store.saveLibrary(result.lib);
  let settings: Settings | undefined;
  if (restoreSettings && parsed.settings) {
    const keepBackup = store.settings.backup;
    settings = { ...parsed.settings, backup: keepBackup, firstRunDone: true };
    await store.saveSettings(settings);
  }
  return { ok: true, mode, added: result.added, updated: result.updated, library: store.library, settings };
}

/** Restores (replaces) the library from one of the automatic snapshots. */
export async function restoreSnapshot(store: DataStore, name: string): Promise<ImportResult> {
  try {
    const lib = await store.readSnapshot(name);
    await store.snapshot('before-restore', true);
    await store.saveLibrary(lib);
    return { ok: true, mode: 'replace', added: lib.critiques.length, updated: 0, library: store.library };
  } catch (e: any) {
    return { ok: false, mode: 'replace', added: 0, updated: 0, library: store.library, error: e?.message || String(e) };
  }
}

/** Writes a full backup into the user's chosen folder and keeps only the newest ones. */
export async function writeFolderBackup(store: DataStore, folder: string, keep: number, appVersion: string): Promise<string> {
  await ensureDir(folder);
  const bytes = await buildBackup(store, appVersion);
  let name = `Iris Backup ${humanStamp()}.${BACKUP_EXT}`;
  let n = 2;
  while (await exists(path.join(folder, name))) name = `Iris Backup ${humanStamp()} ${n++}.${BACKUP_EXT}`;
  const file = path.join(folder, name);
  await writeFileAtomic(file, bytes);
  try {
    const all = (await fsp.readdir(folder)).filter((f) => MIRROR_RE.test(f)).sort().reverse();
    for (const old of all.slice(Math.max(1, keep))) await fsp.unlink(path.join(folder, old));
  } catch {
    /* pruning is best effort */
  }
  store.changedSinceFullBackup = false;
  return file;
}

export async function newestFolderBackup(folder: string): Promise<string | null> {
  try {
    const all = (await fsp.readdir(folder)).filter((f) => MIRROR_RE.test(f)).sort().reverse();
    return all[0] ? path.join(folder, all[0]) : null;
  } catch {
    return null;
  }
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function critiquesCsv(lib: Library): string {
  const head = [
    'Title',
    'Type',
    'Director',
    'Producing Studio',
    'Cast',
    'Description',
    'Personal Comments',
    ...SCORES.map((s) => `${s.label} /100`),
    'Rating /1000',
    'Class',
    'Class chosen by you',
    'Recommend',
    'Final Remarks',
    'Year',
    'Added',
    'Last edited',
  ];
  const rows = lib.critiques.map((c) => [
    c.title,
    TYPE_LABEL[c.type],
    c.director,
    c.studio,
    c.cast,
    c.description,
    c.comments,
    ...SCORES.map((s) => c.scores[s.key]),
    ratingOf(c),
    CLASS_BY_KEY[classOf(c)].label,
    c.classOverride ? 'Yes' : 'No',
    c.recommend === 'yes' ? 'Yes' : c.recommend === 'no' ? 'No' : '',
    c.finalRemarks,
    c.year,
    new Date(c.createdAt).toISOString().slice(0, 10),
    new Date(c.updatedAt).toISOString().slice(0, 10),
  ]);
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

