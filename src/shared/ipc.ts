/* The bridge between the UI and the Electron main process (exposed as window.iris). */
import type { ExtRef, Library, MediaType } from './model';
import type { Settings } from './settings';

export interface LoadResult {
  library: Library;
  settings: Settings;
  recovered: string | null; // set when the main file was unreadable and a backup copy was used
  legacy: { imported: number; sources: string[] } | null;
  pendingOpen: string | null; // a backup file the app was opened with
  info: AppInfo;
}

export interface AppInfo {
  version: string;
  platform: 'darwin' | 'win32' | 'linux';
  dataFolder: string;
  snapshotsFolder: string;
  isPackaged: boolean;
  introSpeed?: number; // only used by automated tests to slow the opening down
  fakeOnline?: boolean; // automated tests use a pretend server instead of Supabase
}

export interface SnapshotInfo {
  name: string;
  createdAt: number;
  critiques: number;
  watchlist: number;
  size: number;
  reason: string;
}

export interface BackupStatus {
  snapshots: SnapshotInfo[];
  folder: string | null;
  folderOk: boolean;
  lastFullBackupAt: number | null;
  lastFullBackupFile: string | null;
  lastFullBackupError: string | null;
}

export interface ImportPreview {
  file: string;
  createdAt: number | null;
  appVersion: string | null;
  critiques: number;
  watchlist: number;
  drafts: number;
  titles: string[];
}

export interface ImportResult {
  ok: boolean;
  mode: 'merge' | 'replace';
  added: number;
  updated: number;
  library: Library;
  settings?: Settings;
  error?: string;
}

export interface LookupCandidate {
  id: string; // wikipedia page id
  title: string;
  description: string;
  type: MediaType | null;
  year: string;
  thumb: string | null;
  image: string | null;
  qid: string | null;
  extract: string;
  source?: 'tmdb' | 'igdb' | 'wiki';
  ext?: ExtRef | null;
  popularity?: number;
}

export interface LookupDetails {
  title: string;
  type: MediaType | null;
  year: string;
  director: string;
  studio: string;
  cast: string;
  description: string;
  image: string | null;
  ext?: ExtRef | null;
  genres?: string[];
}

export interface RecCard {
  key: string;
  ext: ExtRef;
  type: MediaType;
  title: string;
  year: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  genres: string[];
  score: number | null; // audience score out of 100
  votes: number;
  reason: string;
}

export interface RecRequest {
  type: MediaType;
  seeds: { title: string; type: MediaType; year: string; rating: number; ext: ExtRef | null }[];
  exclude: string[];
  excludeTitles: string[];
  friends: { title: string; type: MediaType; rating: number; by: string; ext: ExtRef | null }[];
  era: 'all' | 'recent';
  page: number;
}

export interface IrisApi {
  load(): Promise<LoadResult>;
  saveLibrary(lib: Library): Promise<{ ok: boolean; error?: string }>;
  saveSettings(s: Settings): Promise<{ ok: boolean; error?: string }>;
  media: {
    save(bytes: Uint8Array, ext: 'jpg' | 'png' | 'webp'): Promise<string>;
    fetchRemote(url: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
    readFile(path: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
  };
  lookup: {
    search(query: string, type: MediaType | null): Promise<LookupCandidate[]>;
    details(c: LookupCandidate): Promise<LookupDetails>;
    status(): Promise<{ tmdb: boolean; igdb: boolean }>;
    recommend(req: RecRequest): Promise<RecCard[]>;
  };
  backup: {
    status(): Promise<BackupStatus>;
    snapshotNow(reason?: string): Promise<SnapshotInfo | null>;
    restoreSnapshot(name: string): Promise<ImportResult>;
    chooseFolder(): Promise<string | null>;
    clearFolder(): Promise<void>;
    fullBackupNow(): Promise<{ ok: boolean; file?: string; error?: string }>;
    exportTo(): Promise<{ ok: boolean; file?: string; error?: string; canceled?: boolean }>;
    pickImport(): Promise<ImportPreview | null>;
    previewImport(file: string): Promise<ImportPreview | null>;
    runImport(file: string, mode: 'merge' | 'replace'): Promise<ImportResult>;
    exportCsv(): Promise<{ ok: boolean; file?: string; canceled?: boolean }>;
    openFolder(which: 'snapshots' | 'mirror' | 'data'): Promise<void>;
    legacyImport(): Promise<{ imported: number; sources: string[]; library: Library }>;
  };
  app: {
    openExternal(url: string): Promise<void>;
    pathForFile(file: File): string;
    setTitleBarTheme(dark: boolean): void;
    onMenu(cb: (action: string) => void): () => void;
    onOpenFile(cb: (file: string) => void): () => void;
    onFlushRequest(cb: () => Promise<void> | void): () => void;
  };
}

declare global {
  interface Window {
    iris: IrisApi;
  }
}
