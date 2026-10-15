import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
vi.mock('electron', () => ({ net: { fetch: () => { throw new Error('no network'); } } }));
import { DataStore } from '../../electron/store';
import { buildBackup, importBackupFile, parseBackupFile, writeFolderBackup } from '../../electron/backup';
import { saveMedia } from '../../electron/media';
import { normalizeCritique, SCORE_KEYS } from '../../src/shared/model';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'iris-test-'));
const crit = (id: string, title: string, poster: string | null = null) =>
  normalizeCritique({ id, title, type: 'movie', poster, scores: Object.fromEntries(SCORE_KEYS.map((k) => [k, 80])) });

describe('storage', () => {
  it('saves atomically and recovers from a damaged file', async () => {
    const dir = tmp();
    const s = new DataStore(dir);
    await s.init();
    await s.saveLibrary({ ...s.library, critiques: [crit('c1', 'One')] });
    await s.saveLibrary({ ...s.library, critiques: [crit('c1', 'One'), crit('c2', 'Two')] });
    await s.flush();
    expect(fs.existsSync(path.join(dir, 'library.json.bak'))).toBe(true);
    fs.writeFileSync(path.join(dir, 'library.json'), '{ this is not json');
    const again = new DataStore(dir);
    const r = await again.init();
    expect(r.recovered).toMatch(/backup copy/);
    expect(again.library.critiques.map((c) => c.title)).toEqual(['One']);
    expect(fs.readdirSync(dir).some((f) => f.startsWith('library.damaged-'))).toBe(true);
  });

  it('takes snapshots only when something changed, and restores them', async () => {
    const dir = tmp();
    const s = new DataStore(dir);
    await s.init();
    await s.saveLibrary({ ...s.library, critiques: [crit('c1', 'One')] });
    const a = await s.snapshot('launch');
    const b = await s.snapshot('auto');
    expect(a).not.toBeNull();
    expect(b).toBeNull();
    await s.saveLibrary({ ...s.library, critiques: [] });
    const lib = await s.readSnapshot(a!.name);
    expect(lib.critiques[0].title).toBe('One');
  });
});

describe('backup files', () => {
  it('round-trips critiques and posters through a .irisbackup file', async () => {
    const dir = tmp();
    const s = new DataStore(dir);
    await s.init();
    const poster = await saveMedia(s.mediaDir, new Uint8Array([1, 2, 3, 4, 5]), 'jpg');
    await s.saveLibrary({ ...s.library, critiques: [crit('c1', 'With poster', poster), crit('c2', 'Plain')] });
    const zip = await buildBackup(s, '1.0.0');
    const file = path.join(dir, 'test.irisbackup');
    fs.writeFileSync(file, zip);

    const other = new DataStore(tmp());
    await other.init();
    await other.saveLibrary({ ...other.library, critiques: [crit('c9', 'Already here')] });
    const r = await importBackupFile(other, file, 'merge', false);
    expect(r.ok).toBe(true);
    expect(r.added).toBe(2);
    expect(other.library.critiques.map((c) => c.title).sort()).toEqual(['Already here', 'Plain', 'With poster']);
    expect(fs.readFileSync(path.join(other.mediaDir, poster))).toEqual(Buffer.from([1, 2, 3, 4, 5]));
    const again = await importBackupFile(other, file, 'merge', false);
    expect(again.added).toBe(0);
    const replaced = await importBackupFile(other, file, 'replace', true);
    expect(replaced.library.critiques).toHaveLength(2);
  });

  it('reads an old Marquee backup file', async () => {
    const dir = tmp();
    const file = path.join(dir, 'marquee-backup-2026-10-14.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        app: 'verdict',
        version: 2,
        exportedAt: '2026-10-14T08:00:00Z',
        items: [{ id: 'old1', title: 'Old one', type: 'game', scores: { story: 90 }, cls: 'terrible', clsManual: false, recommend: 'yes', poster: 'data:image/png;base64,iVBORw0KGgo=' }],
        watchlist: [{ id: 'w1', title: 'Later', type: 'show', status: 'watched' }],
      }),
    );
    const p = await parseBackupFile(file);
    expect(p.library.critiques[0].title).toBe('Old one');
    expect(p.library.critiques[0].poster).toMatch(/\.png$/);
    expect(p.library.watchlist[0].status).toBe('watched');
    expect(p.media.size).toBe(1);
  });

  it('keeps only the newest backups in the chosen folder', async () => {
    const dir = tmp();
    const s = new DataStore(dir);
    await s.init();
    await s.saveLibrary({ ...s.library, critiques: [crit('c1', 'One')] });
    const folder = path.join(dir, 'Iris Backups');
    for (let i = 0; i < 5; i++) await writeFolderBackup(s, folder, 3, '1.0.0');
    const files = fs.readdirSync(folder).filter((f) => f.endsWith('.irisbackup'));
    expect(files.length).toBe(3);
    fs.writeFileSync(path.join(folder, 'my notes.txt'), 'keep me');
    await writeFolderBackup(s, folder, 3, '1.0.0');
    expect(fs.existsSync(path.join(folder, 'my notes.txt'))).toBe(true);
  });
});
