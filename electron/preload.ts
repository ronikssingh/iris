import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { IrisApi } from '../src/shared/ipc';

const on = (channel: string, cb: (...a: any[]) => void) => {
  const fn = (_e: unknown, ...args: any[]) => cb(...args);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};

const api: IrisApi = {
  load: () => ipcRenderer.invoke('iris:load'),
  saveLibrary: (lib) => ipcRenderer.invoke('iris:save-library', lib),
  saveSettings: (s) => ipcRenderer.invoke('iris:save-settings', s),
  media: {
    save: (bytes, ext) => ipcRenderer.invoke('media:save', bytes, ext),
    fetchRemote: (url, pasted) => ipcRenderer.invoke('media:fetch', url, pasted === true),
    readFile: (p) => ipcRenderer.invoke('media:read-file', p),
  },
  lookup: {
    search: (q, type) => ipcRenderer.invoke('lookup:search', q, type),
    details: (c) => ipcRenderer.invoke('lookup:details', c),
    status: () => ipcRenderer.invoke('lookup:status'),
    recommend: (req) => ipcRenderer.invoke('lookup:recommend', req),
  },
  backup: {
    status: () => ipcRenderer.invoke('backup:status'),
    snapshotNow: (reason) => ipcRenderer.invoke('backup:snapshot', reason),
    restoreSnapshot: (name) => ipcRenderer.invoke('backup:restore-snapshot', name),
    chooseFolder: () => ipcRenderer.invoke('backup:choose-folder'),
    clearFolder: () => ipcRenderer.invoke('backup:clear-folder'),
    fullBackupNow: () => ipcRenderer.invoke('backup:full-now'),
    exportTo: () => ipcRenderer.invoke('backup:export'),
    pickImport: () => ipcRenderer.invoke('backup:pick-import'),
    previewImport: (file) => ipcRenderer.invoke('backup:preview', file),
    runImport: (file, mode) => ipcRenderer.invoke('backup:import', file, mode),
    exportCsv: () => ipcRenderer.invoke('backup:export-csv'),
    openFolder: (which) => ipcRenderer.invoke('backup:open-folder', which),
    legacyImport: () => ipcRenderer.invoke('backup:legacy'),
  },
  app: {
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
    pathForFile: (file) => {
      try {
        return webUtils.getPathForFile(file);
      } catch {
        return '';
      }
    },
    setTitleBarTheme: (dark) => ipcRenderer.send('app:title-theme', dark),
    onMenu: (cb) => on('menu', cb),
    onOpenFile: (cb) => on('app:open-file', cb),
    onFlushRequest: (cb) =>
      on('app:flush', async () => {
        try {
          await cb();
        } finally {
          ipcRenderer.send('app:flushed');
        }
      }),
  },
};

contextBridge.exposeInMainWorld('iris', api);
