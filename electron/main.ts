import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  protocol,
  screen,
  shell,
  type MenuItemConstructorOptions,
} from 'electron';
import { DataStore } from './store';
import { fetchRemoteImage, mimeFor, saveMedia, serveMedia } from './media';
import { searchTitles, titleDetails } from './lookup';
import {
  BACKUP_EXT,
  buildBackup,
  critiquesCsv,
  importBackupFile,
  newestFolderBackup,
  previewBackupFile,
  restoreSnapshot,
  writeFolderBackup,
} from './backup';
import { cleanLegacyPartitions, importFromOldApp } from './legacy';
import { exists, humanStamp, readJson, writeFileAtomic } from './fsutil';
import type { BackupStatus, LoadResult } from '../src/shared/ipc';
import type { Settings } from '../src/shared/settings';

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const TEST = process.env.IRIS_TEST === '1';

app.setName('Iris');
if (process.env.IRIS_DATA_DIR) app.setPath('userData', path.resolve(process.env.IRIS_DATA_DIR));

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (TEST) {
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'iris-media', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

let win: BrowserWindow | null = null;
let store: DataStore;
let pendingOpen: string | null = null;
let lastFolderError: string | null = null;
let lastFolderFile: string | null = null;
let quitting = false;
let readyForQuit = false;

function backupFileFromArgs(argv: string[]): string | null {
  const hit = argv.find((a) => a.toLowerCase().endsWith('.' + BACKUP_EXT));
  return hit ? path.resolve(hit) : null;
}

if (!TEST && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const f = backupFileFromArgs(argv);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      if (f) win.webContents.send('app:open-file', f);
    }
  });
}

app.on('open-file', (e, file) => {
  e.preventDefault();
  if (win && !win.webContents.isLoading()) win.webContents.send('app:open-file', file);
  else pendingOpen = file;
});
pendingOpen = backupFileFromArgs(process.argv.slice(1));

/* ------------------------------------------------------------------ */
/* Window                                                              */
/* ------------------------------------------------------------------ */

interface WinState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized?: boolean;
}

async function loadWindowState(): Promise<WinState> {
  const fallback: WinState = { width: 1480, height: 940 };
  try {
    const s = await readJson<WinState>(path.join(store.dir, 'window.json'));
    const area = screen.getDisplayMatching({ x: s.x ?? 0, y: s.y ?? 0, width: s.width, height: s.height }).workArea;
    const width = Math.min(Math.max(1100, s.width), area.width);
    const height = Math.min(Math.max(700, s.height), area.height);
    const onScreen =
      s.x !== undefined && s.y !== undefined && s.x >= area.x - 50 && s.y >= area.y - 50 && s.x + 200 <= area.x + area.width;
    return { width, height, x: onScreen ? s.x : undefined, y: onScreen ? s.y : undefined, maximized: !!s.maximized };
  } catch {
    const area = screen.getPrimaryDisplay().workArea;
    return { width: Math.min(fallback.width, area.width), height: Math.min(fallback.height, area.height) };
  }
}

async function saveWindowState() {
  if (!win || win.isDestroyed()) return;
  const b = win.getNormalBounds();
  try {
    await writeFileAtomic(path.join(store.dir, 'window.json'), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch {
    /* not important */
  }
}

async function createWindow() {
  mainWindowCreated = true;
  const st = await loadWindowState();
  win = new BrowserWindow({
    width: st.width,
    height: st.height,
    x: st.x,
    y: st.y,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'Iris',
    backgroundColor: '#020306',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 22, y: 22 },
    titleBarOverlay: isWin ? { color: '#00000000', symbolColor: '#e8ecf2', height: 44 } : undefined,
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
      backgroundThrottling: true,
    },
  });
  if (st.maximized) win.maximize();

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const devUrl = process.env.IRIS_DEV_URL;
    if (devUrl && url.startsWith(devUrl)) return;
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });

  win.once('ready-to-show', () => win?.show());
  win.on('close', (e) => {
    if (readyForQuit || TEST) return;
    e.preventDefault();
    void beginQuit();
  });
  win.on('closed', () => {
    win = null;
  });
  win.on('resize', debounce(saveWindowState, 600));
  win.on('move', debounce(saveWindowState, 600));

  if (process.env.IRIS_DEV_URL) await win.loadURL(process.env.IRIS_DEV_URL);
  else await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

function debounce<T extends (...a: any[]) => any>(fn: T, ms: number) {
  let t: NodeJS.Timeout | null = null;
  return (...a: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

/* ------------------------------------------------------------------ */
/* Quit: flush the UI, snapshot, back up                               */
/* ------------------------------------------------------------------ */

async function askRendererToFlush(): Promise<void> {
  if (!win || win.isDestroyed()) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 2500);
    ipcMain.once('app:flushed', () => {
      clearTimeout(t);
      resolve();
    });
    win!.webContents.send('app:flush');
  });
}

async function beginQuit() {
  if (quitting) return;
  quitting = true;
  try {
    await askRendererToFlush();
    await saveWindowState();
    await store.flush();
    if (store.changedSinceSnapshot) await store.snapshot('quit');
    const s = store.settings;
    if (s.backup.folder && store.changedSinceFullBackup) {
      try {
        lastFolderFile = await writeFolderBackup(store, s.backup.folder, s.backup.keep, app.getVersion());
        await store.saveSettings({ ...store.settings, backup: { ...store.settings.backup, lastFullBackupAt: Date.now() } });
        await store.flush();
      } catch {
        /* the snapshot above still protects the data */
      }
    }
  } finally {
    readyForQuit = true;
    app.quit();
  }
}

app.on('before-quit', (e) => {
  if (readyForQuit || TEST) return;
  e.preventDefault();
  void beginQuit();
});

// The hidden window used to read old Marquee data closes before the main window exists;
// that must not count as the user closing the app.
let mainWindowCreated = false;
app.on('window-all-closed', () => {
  if (mainWindowCreated) app.quit();
});

/* ------------------------------------------------------------------ */
/* Scheduled safety copies                                             */
/* ------------------------------------------------------------------ */

async function folderBackupIfDue(force = false): Promise<void> {
  const s = store.settings;
  if (!s.backup.folder) return;
  const due = !s.backup.lastFullBackupAt || Date.now() - s.backup.lastFullBackupAt > 6 * 3600e3;
  if (!force && !(due && (store.changedSinceFullBackup || !s.backup.lastFullBackupAt))) return;
  try {
    lastFolderFile = await writeFolderBackup(store, s.backup.folder, s.backup.keep, app.getVersion());
    lastFolderError = null;
    await store.saveSettings({ ...store.settings, backup: { ...store.settings.backup, lastFullBackupAt: Date.now() } });
  } catch (e: any) {
    lastFolderError = e?.code === 'ENOENT' ? 'The backup folder could not be found. Is the drive connected?' : e?.message || String(e);
  }
}

function startSchedules() {
  setInterval(() => {
    if (store.changedSinceSnapshot) void store.snapshot('auto');
  }, 15 * 60e3).unref?.();
  setInterval(() => void folderBackupIfDue(), 30 * 60e3).unref?.();
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

function send(action: string) {
  win?.webContents.send('menu', action);
}

function buildMenu() {
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'Iris',
            submenu: [
              { role: 'about' as const, label: 'About Iris' },
              { type: 'separator' as const },
              { label: 'Settings…', accelerator: 'Cmd+,', click: () => send('go:settings') },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const, label: 'Quit Iris' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Critique', accelerator: 'CmdOrCtrl+N', click: () => send('new-critique') },
        { label: 'Add to Up Next…', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('add-watch') },
        { type: 'separator' },
        { label: 'Back Up Now', accelerator: 'CmdOrCtrl+Alt+B', click: () => send('backup-now') },
        { label: 'Save Backup File…', click: () => send('backup-export') },
        { label: 'Restore or Import Backup…', click: () => send('backup-import') },
        { label: 'Export Spreadsheet (CSV)…', click: () => send('export-csv') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Lobby', accelerator: 'CmdOrCtrl+1', click: () => send('go:lobby') },
        { label: 'Critiques', accelerator: 'CmdOrCtrl+2', click: () => send('go:archive') },
        { label: 'Write', accelerator: 'CmdOrCtrl+3', click: () => send('go:write') },
        { label: 'Masterpieces', accelerator: 'CmdOrCtrl+4', click: () => send('go:masterpieces') },
        { label: 'Up Next', accelerator: 'CmdOrCtrl+5', click: () => send('go:upnext') },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => send('find') },
        { label: 'Next Theme', accelerator: 'CmdOrCtrl+T', click: () => send('theme-next') },
        { label: 'Surprise Me With a Theme', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('theme-random') },
        { label: 'Sound On or Off', accelerator: 'CmdOrCtrl+Shift+M', click: () => send('sound-toggle') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(!app.isPackaged ? [{ role: 'reload' as const }, { role: 'toggleDevTools' as const }] : []),
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', click: () => send('shortcuts') },
        { label: 'Show Data Folder', click: () => void shell.openPath(store.dir) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

async function backupStatus(): Promise<BackupStatus> {
  const folder = store.settings.backup.folder;
  let folderOk = false;
  if (folder) folderOk = await exists(folder);
  if (folder && !lastFolderFile) lastFolderFile = await newestFolderBackup(folder);
  return {
    snapshots: await store.listSnapshots(),
    folder,
    folderOk,
    lastFullBackupAt: store.settings.backup.lastFullBackupAt,
    lastFullBackupFile: lastFolderFile,
    lastFullBackupError: lastFolderError,
  };
}

function registerIpc(legacyReport: LoadResult['legacy'], recovered: string | null) {
  ipcMain.handle('iris:load', async (): Promise<LoadResult> => {
    const p = pendingOpen;
    pendingOpen = null;
    return {
      library: store.library,
      settings: store.settings,
      recovered,
      legacy: legacyReport,
      pendingOpen: p,
      info: {
        version: app.getVersion(),
        platform: process.platform as any,
        dataFolder: store.dir,
        snapshotsFolder: store.snapDir,
        isPackaged: app.isPackaged,
        introSpeed: TEST && process.env.IRIS_INTRO_SPEED ? Number(process.env.IRIS_INTRO_SPEED) : undefined,
      },
    };
  });
  ipcMain.handle('iris:save-library', (_e, lib) => store.saveLibrary(lib));
  ipcMain.handle('iris:save-settings', async (_e, s: Settings) => {
    const prevFolder = store.settings.backup.folder;
    const r = await store.saveSettings(s);
    if (s.backup?.folder && s.backup.folder !== prevFolder) void folderBackupIfDue(true);
    return r;
  });

  ipcMain.handle('media:save', async (_e, bytes: Uint8Array, ext: string) => saveMedia(store.mediaDir, new Uint8Array(bytes), ext));
  ipcMain.handle('media:fetch', async (_e, url: string) => fetchRemoteImage(String(url), true));
  ipcMain.handle('media:read-file', async (_e, file: string) => {
    try {
      const f = String(file);
      if (!/\.(jpe?g|png|webp|gif|avif|heic|bmp)$/i.test(f)) return null;
      const data = await fsp.readFile(f);
      return { bytes: new Uint8Array(data), mime: mimeFor(f) };
    } catch {
      return null;
    }
  });

  ipcMain.handle('lookup:search', (_e, q: string, type) => searchTitles(String(q || ''), type ?? null));
  ipcMain.handle('lookup:details', (_e, c) => titleDetails(c));

  ipcMain.handle('backup:status', () => backupStatus());
  ipcMain.handle('backup:snapshot', (_e, reason?: string) => store.snapshot(reason || 'manual', true));
  ipcMain.handle('backup:restore-snapshot', (_e, name: string) => restoreSnapshot(store, String(name)));
  ipcMain.handle('backup:choose-folder', async () => {
    const r = await dialog.showOpenDialog(win!, {
      title: 'Choose a folder for Iris backups',
      message: 'Pick a folder that syncs off this computer, like iCloud Drive, Dropbox or a USB drive.',
      buttonLabel: 'Use This Folder',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: app.getPath('documents'),
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const folder = path.join(r.filePaths[0], path.basename(r.filePaths[0]) === 'Iris Backups' ? '' : 'Iris Backups');
    lastFolderFile = null;
    lastFolderError = null;
    return folder;
  });
  ipcMain.handle('backup:clear-folder', async () => {
    lastFolderFile = null;
    lastFolderError = null;
  });
  ipcMain.handle('backup:full-now', async () => {
    const folder = store.settings.backup.folder;
    if (!folder) return { ok: false, error: 'Choose a backup folder first.' };
    try {
      const file = await writeFolderBackup(store, folder, store.settings.backup.keep, app.getVersion());
      lastFolderFile = file;
      lastFolderError = null;
      await store.saveSettings({ ...store.settings, backup: { ...store.settings.backup, lastFullBackupAt: Date.now() } });
      return { ok: true, file };
    } catch (e: any) {
      lastFolderError = e?.message || String(e);
      return { ok: false, error: lastFolderError ?? undefined };
    }
  });
  ipcMain.handle('backup:export', async () => {
    const r = await dialog.showSaveDialog(win!, {
      title: 'Save a backup of Iris',
      defaultPath: path.join(app.getPath('documents'), `Iris Backup ${humanStamp()}.${BACKUP_EXT}`),
      filters: [{ name: 'Iris backup', extensions: [BACKUP_EXT] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    try {
      const bytes = await buildBackup(store, app.getVersion());
      await writeFileAtomic(r.filePath, bytes);
      return { ok: true, file: r.filePath };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  });
  ipcMain.handle('backup:pick-import', async () => {
    const r = await dialog.showOpenDialog(win!, {
      title: 'Choose a backup to restore or import',
      properties: ['openFile'],
      filters: [{ name: 'Iris or Marquee backups', extensions: [BACKUP_EXT, 'json'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    try {
      return await previewBackupFile(r.filePaths[0]);
    } catch (e: any) {
      return { file: r.filePaths[0], error: e?.message || String(e), createdAt: null, appVersion: null, critiques: 0, watchlist: 0, drafts: 0, titles: [] };
    }
  });
  ipcMain.handle('backup:preview', async (_e, file: string) => {
    try {
      return await previewBackupFile(String(file));
    } catch (e: any) {
      return { file, error: e?.message || String(e), createdAt: null, appVersion: null, critiques: 0, watchlist: 0, drafts: 0, titles: [] };
    }
  });
  ipcMain.handle('backup:import', (_e, file: string, mode: 'merge' | 'replace') =>
    importBackupFile(store, String(file), mode === 'replace' ? 'replace' : 'merge', mode === 'replace'),
  );
  ipcMain.handle('backup:export-csv', async () => {
    const r = await dialog.showSaveDialog(win!, {
      title: 'Export your critiques as a spreadsheet',
      defaultPath: path.join(app.getPath('documents'), `Iris Critiques ${humanStamp().slice(0, 10)}.csv`),
      filters: [{ name: 'CSV spreadsheet', extensions: ['csv'] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    await writeFileAtomic(r.filePath, critiquesCsv(store.library));
    return { ok: true, file: r.filePath };
  });
  ipcMain.handle('backup:open-folder', async (_e, which: string) => {
    const target = which === 'mirror' ? store.settings.backup.folder : which === 'snapshots' ? store.snapDir : store.dir;
    if (target) await shell.openPath(target);
  });
  ipcMain.handle('backup:legacy', async () => importFromOldApp(store, path.join(__dirname, 'legacy-reader.html')));

  ipcMain.handle('app:open-external', async (_e, url: string) => {
    if (/^https?:\/\//i.test(String(url))) await shell.openExternal(String(url));
  });
  ipcMain.on('app:title-theme', (_e, dark: boolean) => {
    nativeTheme.themeSource = dark ? 'dark' : 'light';
    if (isWin && win) {
      try {
        win.setTitleBarOverlay({ color: '#00000000', symbolColor: dark ? '#e8ecf2' : '#14223a', height: 44 });
      } catch {
        /* older Windows builds */
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

app.whenReady().then(async () => {
  store = new DataStore(app.getPath('userData'));
  const { recovered } = await store.init();
  protocol.handle('iris-media', (req) => serveMedia(store.mediaDir, req.url));

  await cleanLegacyPartitions();
  let legacy: LoadResult['legacy'] = null;
  if (!store.library.meta.legacyCheckedAt && !process.env.IRIS_SKIP_LEGACY) {
    try {
      const r = await importFromOldApp(store, path.join(__dirname, 'legacy-reader.html'));
      legacy = { imported: r.imported, sources: r.sources };
    } catch {
      store.library.meta.legacyCheckedAt = Date.now();
      await store.saveLibrary(store.library);
    }
  }

  await store.snapshot('launch');
  registerIpc(legacy, recovered);
  buildMenu();
  await createWindow();
  startSchedules();
  setTimeout(() => void folderBackupIfDue(), 20e3);

  app.on('activate', () => {
    if (!win) void createWindow();
  });
});
