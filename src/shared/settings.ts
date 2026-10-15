/* User preferences, stored separately from the library. */

export const THEME_IDS = [
  'vigil',
  'skyward',
  'mirage',
  'glitchpop',
  'winedark',
  'fimbulwinter',
  'eventhorizon',
  'midnightdrive',
  'silverscreen',
  'emberrealm',
] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type SortDir = 'asc' | 'desc';
export const SORT_KEYS = [
  'type',
  'rating',
  'enjoyment',
  'class',
  'title',
  'added',
  'updated',
  'year',
  'recommend',
  'director',
  'studio',
  'story',
  'screenplay',
  'characters',
  'acting',
  'visuals',
  'soundtrack',
  'production',
  'vision',
  'pacing',
] as const;
export type SortKeyId = (typeof SORT_KEYS)[number];
export interface SortRule {
  key: SortKeyId;
  dir: SortDir;
}
export type GroupBy = 'type' | 'class' | 'recommend' | 'none';
export type ViewMode = 'posters' | 'list';

export interface ArchivePrefs {
  view: ViewMode;
  groupBy: GroupBy;
  sort: SortRule[];
}

export interface Settings {
  format: 'iris-settings';
  userName: string;
  firstRunDone: boolean;
  theme: ThemeId;
  autoRotate: boolean;
  rotateMinutes: number;
  rotateOrder: 'random' | 'sequence';
  rotation: ThemeId[];
  sound: {
    enabled: boolean;
    volume: number; // 0..1
    intro: boolean;
    ui: boolean;
    ambience: boolean;
    ambienceVolume: number; // 0..1
  };
  motion: 'full' | 'balanced' | 'calm';
  intro: 'full' | 'quick' | 'off';
  archive: ArchivePrefs;
  backup: {
    folder: string | null; // off-computer / mirror folder chosen by the user
    keep: number; // how many full backups to keep in that folder
    lastFullBackupAt: number | null;
    remindDismissedAt: number | null;
  };
}

export const DEFAULT_SORT: SortRule[] = [
  { key: 'type', dir: 'asc' },
  { key: 'rating', dir: 'desc' },
];

export function defaultSettings(): Settings {
  return {
    format: 'iris-settings',
    userName: '',
    firstRunDone: false,
    theme: 'winedark',
    autoRotate: true,
    rotateMinutes: 10,
    rotateOrder: 'random',
    rotation: [...THEME_IDS],
    sound: { enabled: true, volume: 0.7, intro: true, ui: true, ambience: true, ambienceVolume: 0.35 },
    motion: 'full',
    intro: 'full',
    archive: { view: 'posters', groupBy: 'type', sort: DEFAULT_SORT.map((r) => ({ ...r })) },
    backup: { folder: null, keep: 12, lastFullBackupAt: null, remindDismissedAt: null },
  };
}

const isTheme = (v: unknown): v is ThemeId => (THEME_IDS as readonly string[]).includes(v as string);
const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function normalizeSettings(raw: any): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const s = raw.sound && typeof raw.sound === 'object' ? raw.sound : {};
  const a = raw.archive && typeof raw.archive === 'object' ? raw.archive : {};
  const b = raw.backup && typeof raw.backup === 'object' ? raw.backup : {};
  const sort: SortRule[] = Array.isArray(a.sort)
    ? a.sort
        .filter((r: any) => r && (SORT_KEYS as readonly string[]).includes(r.key))
        .map((r: any) => ({ key: r.key, dir: r.dir === 'asc' ? 'asc' : 'desc' }))
        .slice(0, 5)
    : d.archive.sort;
  const rotation = Array.isArray(raw.rotation) ? raw.rotation.filter(isTheme) : d.rotation;
  return {
    format: 'iris-settings',
    userName: typeof raw.userName === 'string' ? raw.userName.slice(0, 40) : '',
    firstRunDone: !!raw.firstRunDone,
    theme: isTheme(raw.theme) ? raw.theme : d.theme,
    autoRotate: !!raw.autoRotate,
    rotateMinutes: num(raw.rotateMinutes, 0.5, 240, d.rotateMinutes),
    rotateOrder: raw.rotateOrder === 'sequence' ? 'sequence' : 'random',
    rotation: rotation.length >= 2 ? rotation : d.rotation,
    sound: {
      enabled: s.enabled === undefined ? d.sound.enabled : !!s.enabled,
      volume: num(s.volume, 0, 1, d.sound.volume),
      intro: s.intro === undefined ? d.sound.intro : !!s.intro,
      ui: s.ui === undefined ? d.sound.ui : !!s.ui,
      ambience: s.ambience === undefined ? d.sound.ambience : !!s.ambience,
      ambienceVolume: num(s.ambienceVolume, 0, 1, d.sound.ambienceVolume),
    },
    motion: raw.motion === 'balanced' || raw.motion === 'calm' ? raw.motion : 'full',
    intro: raw.intro === 'quick' || raw.intro === 'off' ? raw.intro : 'full',
    archive: {
      view: a.view === 'list' ? 'list' : 'posters',
      groupBy: ['type', 'class', 'recommend', 'none'].includes(a.groupBy) ? a.groupBy : 'type',
      sort: sort.length ? sort : d.archive.sort,
    },
    backup: {
      folder: typeof b.folder === 'string' && b.folder ? b.folder : null,
      keep: num(b.keep, 3, 100, d.backup.keep),
      lastFullBackupAt: Number(b.lastFullBackupAt) || null,
      remindDismissedAt: Number(b.remindDismissedAt) || null,
    },
  };
}
