/*
 * Brings critiques over from the earlier "Marquee" app. That app kept everything in its
 * browser storage (localStorage) inside its own data folder, so Iris copies that storage
 * into a private, temporary profile and reads it from there. The old app's files are never changed.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, session } from 'electron';
import { fromLegacyCritique, fromLegacyWatch, mergeLibraries, emptyLibrary, type Library } from '../src/shared/model';
import { copyDir, exists } from './fsutil';
import { dataUrlToBytes, saveMedia } from './media';
import type { DataStore } from './store';

const OLD_NAMES = ['Marquee', 'marquee', 'Verdict', 'verdict'];
const KEYS = { items: 'verdict:items:v1', watch: 'verdict:watchlist:v1' };

async function candidateFolders(currentDir: string): Promise<string[]> {
  const appData = app.getPath('appData');
  const out: string[] = [];
  const seen = new Set<string>();
  let current = currentDir;
  try {
    current = await fsp.realpath(currentDir);
  } catch {
    /* keep as is */
  }
  for (const n of OLD_NAMES) {
    const dir = path.join(appData, n);
    if (!(await exists(path.join(dir, 'Local Storage', 'leveldb')))) continue;
    let real = dir;
    try {
      real = await fsp.realpath(dir);
    } catch {
      /* keep */
    }
    const key = process.platform === 'win32' || process.platform === 'darwin' ? real.toLowerCase() : real;
    if (seen.has(key) || real === current) continue;
    seen.add(key);
    out.push(dir);
  }
  return out;
}

const dbg = (...a: unknown[]) => {
  if (process.env.IRIS_DEBUG) console.log('[legacy]', ...a);
};

async function readOldStorage(dir: string, index: number, readerHtml: string): Promise<{ items: any[]; watch: any[] }> {
  const partName = `legacy-${Date.now().toString(36)}-${index}`;
  dbg('reading', dir, '->', partName);
  const partDir = path.join(app.getPath('userData'), 'Partitions', partName);
  await fsp.rm(partDir, { recursive: true, force: true });
  await copyDir(path.join(dir, 'Local Storage'), path.join(partDir, 'Local Storage'));
  const ses = session.fromPartition('persist:' + partName);
  const win = new BrowserWindow({
    show: false,
    width: 200,
    height: 200,
    webPreferences: { partition: 'persist:' + partName, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await win.loadFile(readerHtml);
    const json: string = await win.webContents.executeJavaScript(
      `JSON.stringify({ items: localStorage.getItem(${JSON.stringify(KEYS.items)}), watch: localStorage.getItem(${JSON.stringify(KEYS.watch)}) })`,
    );
    const raw = JSON.parse(json || '{}');
    const parse = (s: unknown) => {
      if (typeof s !== 'string' || !s) return [];
      try {
        const v = JSON.parse(s);
        if (Array.isArray(v)) return v;
        if (v && Array.isArray(v.items)) return v.items;
        return [];
      } catch {
        return [];
      }
    };
    return { items: parse(raw.items), watch: parse(raw.watch) };
  } finally {
    // the temporary copy is deleted on the next launch, before any profile is opened
    win.destroy();
    void ses;
  }
}

/** Removes temporary profiles left over from earlier imports. Call before any of them is opened. */
export async function cleanLegacyPartitions(): Promise<void> {
  const dir = path.join(app.getPath('userData'), 'Partitions');
  try {
    for (const n of await fsp.readdir(dir)) if (n.startsWith('legacy-')) await fsp.rm(path.join(dir, n), { recursive: true, force: true });
  } catch {
    /* nothing to clean */
  }
}

export async function importFromOldApp(
  store: DataStore,
  readerHtml: string,
): Promise<{ imported: number; sources: string[]; library: Library }> {
  const folders = await candidateFolders(store.dir);
  const incoming = emptyLibrary();
  const sources: string[] = [];
  for (let i = 0; i < folders.length; i++) {
    let data: { items: any[]; watch: any[] };
    try {
      data = await readOldStorage(folders[i], i, readerHtml);
      dbg('got', data.items.length, 'items', data.watch.length, 'watch');
    } catch (e) {
      dbg('failed', e);
      continue;
    }
    if (!data.items.length && !data.watch.length) continue;
    sources.push(path.basename(folders[i]));
    for (const raw of data.items) {
      const { critique, posterDataUrl } = fromLegacyCritique(raw);
      if (!critique.title) continue;
      if (posterDataUrl) {
        const d = dataUrlToBytes(posterDataUrl);
        if (d) {
          try {
            critique.poster = await saveMedia(store.mediaDir, d.bytes, d.ext);
          } catch {
            /* keep the critique without its poster */
          }
        }
      }
      incoming.critiques.push(critique);
    }
    data.watch.forEach((w, idx) => {
      const item = fromLegacyWatch(w, idx);
      if (item.title) incoming.watchlist.push(item);
    });
  }
  const before = store.library.critiques.length + store.library.watchlist.length;
  const merged = mergeLibraries(store.library, incoming).lib;
  merged.meta = { ...store.library.meta, legacyCheckedAt: Date.now() };
  const imported = merged.critiques.length + merged.watchlist.length - before;
  merged.meta.legacyImported = (store.library.meta.legacyImported || 0) + Math.max(0, imported);
  await store.saveLibrary(merged);
  dbg('saved', imported);
  return { imported: Math.max(0, imported), sources, library: store.library };
}
