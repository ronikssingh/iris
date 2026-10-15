/* Shared data model for Iris. Used by both the Electron main process and the UI. */

export const APP_NAME = 'Iris';

export const TYPES = ['movie', 'show', 'game'] as const;
export type MediaType = (typeof TYPES)[number];

export const TYPE_LABEL: Record<MediaType, string> = { movie: 'Movie', show: 'Show', game: 'Game' };
export const TYPE_PLURAL: Record<MediaType, string> = { movie: 'Movies', show: 'Shows', game: 'Games' };

export const SCORE_KEYS = [
  'story',
  'screenplay',
  'characters',
  'acting',
  'visuals',
  'soundtrack',
  'production',
  'vision',
  'pacing',
  'enjoyment',
] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];

export interface ScoreDef {
  key: ScoreKey;
  label: string;
  short: string;
  hint: Record<MediaType, string>;
}

export const SCORES: ScoreDef[] = [
  {
    key: 'story',
    label: 'Story',
    short: 'Story',
    hint: {
      movie: 'The plot itself: its structure, originality, stakes and how well it pays off.',
      show: 'The arc across the season or series: structure, stakes and payoff.',
      game: 'The narrative and quest design: stakes, structure and how well it pays off.',
    },
  },
  {
    key: 'screenplay',
    label: 'Screenplay and Dialogue',
    short: 'Screenplay',
    hint: {
      movie: 'The writing scene by scene: dialogue, wit, subtext and economy.',
      show: 'The writing episode by episode: dialogue, wit, subtext and economy.',
      game: 'Script and dialogue: lines, banter, delivery of lore and choices.',
    },
  },
  {
    key: 'characters',
    label: 'Characters',
    short: 'Characters',
    hint: {
      movie: 'Depth, arcs, motivation, and how much you cared what happened to them.',
      show: 'Depth, arcs and growth over time, and how much you cared.',
      game: 'Depth, arcs and companions, and how much you cared about them.',
    },
  },
  {
    key: 'acting',
    label: 'Acting',
    short: 'Acting',
    hint: {
      movie: 'Performances across the cast, leads and supporting roles alike.',
      show: 'Performances across the cast, leads and recurring roles alike.',
      game: 'Voice acting and motion-capture performances.',
    },
  },
  {
    key: 'visuals',
    label: 'Cinematography and Visuals',
    short: 'Visuals',
    hint: {
      movie: 'Framing, lighting, color and camera movement: the images that stay with you.',
      show: 'Framing, lighting, color and camera work: the images that stay with you.',
      game: 'Art direction, camera, lighting and the views that stay with you.',
    },
  },
  {
    key: 'soundtrack',
    label: 'Score and Soundtrack',
    short: 'Soundtrack',
    hint: {
      movie: 'The music and sound: themes, cues and how they carry the emotion.',
      show: 'The music and sound: themes, cues and how they carry the emotion.',
      game: 'The music and sound design: themes, cues and how they carry the emotion.',
    },
  },
  {
    key: 'production',
    label: 'Production Quality (Effects and CGI) and Design',
    short: 'Production',
    hint: {
      movie: 'Effects, CGI, sets, costumes and the craft of the whole production.',
      show: 'Effects, CGI, sets, costumes and the craft of the whole production.',
      game: 'Technical polish, effects, world and level design.',
    },
  },
  {
    key: 'vision',
    label: 'Director Vision, Themes, Tones',
    short: 'Vision',
    hint: {
      movie: 'The guiding vision: what it is about, and how sure-footed its tone is.',
      show: 'The guiding vision: what it is about, and how sure-footed its tone is.',
      game: 'The creative vision: what it is about, and how sure-footed its tone is.',
    },
  },
  {
    key: 'pacing',
    label: 'Rhythm and Pacing',
    short: 'Pacing',
    hint: {
      movie: 'Flow and momentum, the editing, and whether it earns its runtime.',
      show: 'Flow across episodes, momentum, and whether it earns its length.',
      game: 'Flow and momentum between story, exploration and combat.',
    },
  },
  {
    key: 'enjoyment',
    label: 'Personal Enjoyment',
    short: 'Enjoyment',
    hint: {
      movie: 'Forget the craft for a second. How much did you love watching it?',
      show: 'Forget the craft for a second. How much did you love watching it?',
      game: 'Forget the craft for a second. How much did you love playing it?',
    },
  },
];

export const SCORE_BY_KEY: Record<ScoreKey, ScoreDef> = Object.fromEntries(SCORES.map((s) => [s.key, s])) as Record<
  ScoreKey,
  ScoreDef
>;

export const CLASS_KEYS = ['masterpiece', 'perfect', 'great', 'good', 'average', 'below', 'terrible'] as const;
export type ClassKey = (typeof CLASS_KEYS)[number];

export interface ClassDef {
  key: ClassKey;
  label: string;
  min: number;
  max: number;
  rank: number; // higher is better
}

export const CLASSES: ClassDef[] = [
  { key: 'masterpiece', label: 'Masterpiece', min: 960, max: 1000, rank: 6 },
  { key: 'perfect', label: 'Perfect', min: 900, max: 959, rank: 5 },
  { key: 'great', label: 'Great', min: 800, max: 899, rank: 4 },
  { key: 'good', label: 'Good', min: 650, max: 799, rank: 3 },
  { key: 'average', label: 'Average', min: 500, max: 649, rank: 2 },
  { key: 'below', label: 'Below average', min: 300, max: 499, rank: 1 },
  { key: 'terrible', label: 'Terrible', min: 0, max: 299, rank: 0 },
];

export const CLASS_BY_KEY: Record<ClassKey, ClassDef> = Object.fromEntries(CLASSES.map((c) => [c.key, c])) as Record<
  ClassKey,
  ClassDef
>;

export type Recommend = 'yes' | 'no';

/** Where a title came from in an online catalogue, so it can be matched across friends and recommendations. */
export interface ExtRef {
  source: 'tmdb' | 'igdb';
  kind: 'movie' | 'tv' | 'game';
  id: string;
}

export interface Swipe {
  key: string; // e.g. tmdb:movie:123
  title: string;
  type: MediaType;
  verdict: 'like' | 'skip' | 'seen';
  at: number;
}

export interface Critique {
  id: string;
  title: string;
  type: MediaType;
  director: string;
  studio: string;
  cast: string;
  description: string;
  comments: string;
  scores: Record<ScoreKey, number>;
  scoreNotes: Partial<Record<ScoreKey, string>>;
  classOverride: ClassKey | null;
  recommend: Recommend | null;
  finalRemarks: string;
  poster: string | null; // file name inside the media folder
  posterColor: string | null;
  year: string;
  ext: ExtRef | null;
  genres: string[];
  favourite: boolean;
  hidden: boolean; // kept off the friends feed
  createdAt: number;
  updatedAt: number;
}

export type WatchStatus = 'want' | 'watched';

export interface WatchItem {
  id: string;
  title: string;
  type: MediaType;
  status: WatchStatus;
  note: string;
  poster: string | null;
  posterColor: string | null;
  year: string;
  director: string;
  studio: string;
  cast: string;
  description: string;
  ext: ExtRef | null;
  genres: string[];
  from: string; // who recommended it, when it came from a friend
  order: number;
  addedAt: number;
  updatedAt: number;
}

export interface DraftData {
  title: string;
  type: MediaType | null;
  director: string;
  studio: string;
  cast: string;
  description: string;
  comments: string;
  scores: Record<ScoreKey, number | null>;
  scoreNotes: Partial<Record<ScoreKey, string>>;
  classOverride: ClassKey | null;
  recommend: Recommend | null;
  finalRemarks: string;
  poster: string | null;
  posterColor: string | null;
  year: string;
  ext: ExtRef | null;
  genres: string[];
}

export interface Draft {
  id: string;
  data: DraftData;
  step: number;
  editingId: string | null; // set when editing an existing critique
  watchId: string | null; // set when started from a watchlist item
  createdAt: number;
  updatedAt: number;
}

export type TrashEntry =
  | { id: string; kind: 'critique'; item: Critique; deletedAt: number }
  | { id: string; kind: 'watch'; item: WatchItem; deletedAt: number };

export interface LibraryMeta {
  createdAt: number;
  legacyCheckedAt: number | null;
  legacyImported: number;
  syncedIds: string[]; // critiques that have been shared online from this computer
  posterUploads: Record<string, string>; // local poster file -> its online address
  onlineOwner: string | null; // the online account this library is shared from
}

export interface Library {
  format: 'iris-library';
  schema: 1;
  critiques: Critique[];
  watchlist: WatchItem[];
  drafts: Draft[];
  trash: TrashEntry[];
  swipes: Swipe[];
  meta: LibraryMeta;
}

/* ------------------------------------------------------------------ */
/* Derived values                                                      */
/* ------------------------------------------------------------------ */

export function totalOf(scores: Partial<Record<ScoreKey, number | null>>): number {
  let n = 0;
  for (const k of SCORE_KEYS) {
    const v = scores[k];
    if (typeof v === 'number' && Number.isFinite(v)) n += v;
  }
  return n;
}

export function suggestClass(total: number): ClassKey {
  for (const c of CLASSES) if (total >= c.min) return c.key;
  return 'terrible';
}

export function ratingOf(c: Pick<Critique, 'scores'>): number {
  return totalOf(c.scores);
}

export function classOf(c: Pick<Critique, 'scores' | 'classOverride'>): ClassKey {
  return c.classOverride ?? suggestClass(ratingOf(c));
}

export function classRangeText(k: ClassKey): string {
  const c = CLASS_BY_KEY[k];
  if (c.key === 'masterpiece') return '960 and up';
  if (c.key === 'terrible') return 'under 300';
  return `${c.min}–${c.max}`;
}

/* ------------------------------------------------------------------ */
/* Construction and normalisation                                      */
/* ------------------------------------------------------------------ */

export function newId(prefix = 'c'): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return prefix + Date.now().toString(36) + rand;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const clampInt = (v: unknown, lo: number, hi: number): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};
const safeId = (v: unknown, prefix: string): string => {
  const s = str(v)
    .replace(/[^A-Za-z0-9_\-.~:@+]/g, '-')
    .slice(0, 120);
  return s && s !== '.' && s !== '..' ? s : newId(prefix);
};
const isType = (v: unknown): v is MediaType => (TYPES as readonly string[]).includes(v as string);
const isClass = (v: unknown): v is ClassKey => (CLASS_KEYS as readonly string[]).includes(v as string);
const MEDIA_NAME = /^[a-f0-9]{16,64}\.(jpg|jpeg|png|webp|gif)$/;
const safeMedia = (v: unknown): string | null => (typeof v === 'string' && MEDIA_NAME.test(v) ? v : null);
const safeColor = (v: unknown): string | null => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null);
const time = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function normalizeExt(v: any): ExtRef | null {
  if (!v || typeof v !== 'object') return null;
  const source = v.source === 'tmdb' || v.source === 'igdb' ? v.source : null;
  const kind = v.kind === 'movie' || v.kind === 'tv' || v.kind === 'game' ? v.kind : null;
  const id = typeof v.id === 'string' || typeof v.id === 'number' ? String(v.id).replace(/[^0-9a-zA-Z_-]/g, '').slice(0, 40) : '';
  return source && kind && id ? { source, kind, id } : null;
}
export const extKey = (e: ExtRef | null): string | null => (e ? `${e.source}:${e.kind}:${e.id}` : null);
const normGenres = (v: any): string[] => (Array.isArray(v) ? v.filter((g) => typeof g === 'string' && g.trim()).map((g: string) => g.trim().slice(0, 40)).slice(0, 8) : []);

export function emptyScores(): Record<ScoreKey, number | null> {
  return Object.fromEntries(SCORE_KEYS.map((k) => [k, null])) as Record<ScoreKey, number | null>;
}

export function normalizeCritique(raw: any): Critique {
  raw = raw && typeof raw === 'object' ? raw : {};
  const now = Date.now();
  const rs = raw.scores && typeof raw.scores === 'object' ? raw.scores : {};
  const scores = {} as Record<ScoreKey, number>;
  for (const k of SCORE_KEYS) scores[k] = clampInt(rs[k], 0, 100) ?? 0;
  const notesIn = raw.scoreNotes && typeof raw.scoreNotes === 'object' ? raw.scoreNotes : {};
  const scoreNotes: Partial<Record<ScoreKey, string>> = {};
  for (const k of SCORE_KEYS) {
    const t = str(notesIn[k]);
    if (t.trim()) scoreNotes[k] = t;
  }
  const createdAt = time(raw.createdAt, now);
  return {
    id: safeId(raw.id, 'c'),
    title: str(raw.title).trim(),
    type: isType(raw.type) ? raw.type : 'movie',
    director: str(raw.director),
    studio: str(raw.studio),
    cast: str(raw.cast),
    description: str(raw.description),
    comments: str(raw.comments),
    scores,
    scoreNotes,
    classOverride: isClass(raw.classOverride) ? raw.classOverride : null,
    recommend: raw.recommend === 'yes' || raw.recommend === 'no' ? raw.recommend : null,
    finalRemarks: str(raw.finalRemarks),
    poster: safeMedia(raw.poster),
    posterColor: safeColor(raw.posterColor),
    year: str(raw.year).slice(0, 12),
    ext: normalizeExt(raw.ext),
    genres: normGenres(raw.genres),
    favourite: !!raw.favourite,
    hidden: !!raw.hidden,
    createdAt,
    updatedAt: time(raw.updatedAt, createdAt),
  };
}

export function normalizeWatch(raw: any, index = 0): WatchItem {
  raw = raw && typeof raw === 'object' ? raw : {};
  const now = Date.now();
  const addedAt = time(raw.addedAt, now);
  return {
    id: safeId(raw.id, 'w'),
    title: str(raw.title).trim(),
    type: isType(raw.type) ? raw.type : 'movie',
    status: raw.status === 'watched' ? 'watched' : 'want',
    note: str(raw.note),
    poster: safeMedia(raw.poster),
    posterColor: safeColor(raw.posterColor),
    year: str(raw.year).slice(0, 12),
    director: str(raw.director),
    studio: str(raw.studio),
    cast: str(raw.cast),
    description: str(raw.description),
    ext: normalizeExt(raw.ext),
    genres: normGenres(raw.genres),
    from: str(raw.from).slice(0, 40),
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index,
    addedAt,
    updatedAt: time(raw.updatedAt, addedAt),
  };
}

export function emptyDraftData(): DraftData {
  return {
    title: '',
    type: null,
    director: '',
    studio: '',
    cast: '',
    description: '',
    comments: '',
    scores: emptyScores(),
    scoreNotes: {},
    classOverride: null,
    recommend: null,
    finalRemarks: '',
    poster: null,
    posterColor: null,
    year: '',
    ext: null,
    genres: [],
  };
}

export function normalizeDraft(raw: any): Draft {
  raw = raw && typeof raw === 'object' ? raw : {};
  const d = raw.data && typeof raw.data === 'object' ? raw.data : {};
  const now = Date.now();
  const scores = emptyScores();
  const rs = d.scores && typeof d.scores === 'object' ? d.scores : {};
  for (const k of SCORE_KEYS) scores[k] = clampInt(rs[k], 0, 100);
  const notesIn = d.scoreNotes && typeof d.scoreNotes === 'object' ? d.scoreNotes : {};
  const scoreNotes: Partial<Record<ScoreKey, string>> = {};
  for (const k of SCORE_KEYS) {
    const t = str(notesIn[k]);
    if (t) scoreNotes[k] = t;
  }
  const createdAt = time(raw.createdAt, now);
  return {
    id: safeId(raw.id, 'd'),
    data: {
      title: str(d.title),
      type: isType(d.type) ? d.type : null,
      director: str(d.director),
      studio: str(d.studio),
      cast: str(d.cast),
      description: str(d.description),
      comments: str(d.comments),
      scores,
      scoreNotes,
      classOverride: isClass(d.classOverride) ? d.classOverride : null,
      recommend: d.recommend === 'yes' || d.recommend === 'no' ? d.recommend : null,
      finalRemarks: str(d.finalRemarks),
      poster: safeMedia(d.poster),
      posterColor: safeColor(d.posterColor),
      year: str(d.year).slice(0, 12),
      ext: normalizeExt(d.ext),
      genres: normGenres(d.genres),
    },
    step: clampInt(raw.step, 0, 99) ?? 0,
    editingId: raw.editingId ? safeId(raw.editingId, 'c') : null,
    watchId: raw.watchId ? safeId(raw.watchId, 'w') : null,
    createdAt,
    updatedAt: time(raw.updatedAt, createdAt),
  };
}

export function emptyLibrary(): Library {
  return {
    format: 'iris-library',
    schema: 1,
    critiques: [],
    watchlist: [],
    drafts: [],
    trash: [],
    swipes: [],
    meta: { createdAt: Date.now(), legacyCheckedAt: null, legacyImported: 0, syncedIds: [], posterUploads: {}, onlineOwner: null },
  };
}

export function normalizeLibrary(raw: any): Library {
  const lib = emptyLibrary();
  if (!raw || typeof raw !== 'object') return lib;
  const seen = new Set<string>();
  if (Array.isArray(raw.critiques)) {
    for (const r of raw.critiques) {
      const c = normalizeCritique(r);
      if (!c.title || seen.has(c.id)) continue;
      seen.add(c.id);
      lib.critiques.push(c);
    }
  }
  const seenW = new Set<string>();
  if (Array.isArray(raw.watchlist)) {
    raw.watchlist.forEach((r: any, i: number) => {
      const w = normalizeWatch(r, i);
      if (!w.title || seenW.has(w.id)) return;
      seenW.add(w.id);
      lib.watchlist.push(w);
    });
  }
  if (Array.isArray(raw.drafts)) {
    const seenD = new Set<string>();
    for (const r of raw.drafts) {
      const d = normalizeDraft(r);
      if (seenD.has(d.id)) continue;
      seenD.add(d.id);
      lib.drafts.push(d);
    }
  }
  if (Array.isArray(raw.trash)) {
    for (const t of raw.trash) {
      if (!t || typeof t !== 'object') continue;
      const deletedAt = time(t.deletedAt, Date.now());
      if (t.kind === 'critique') {
        const item = normalizeCritique(t.item);
        if (item.title) lib.trash.push({ id: item.id, kind: 'critique', item, deletedAt });
      } else if (t.kind === 'watch') {
        const item = normalizeWatch(t.item);
        if (item.title) lib.trash.push({ id: item.id, kind: 'watch', item, deletedAt });
      }
    }
  }
  if (Array.isArray(raw.swipes)) {
    const seenS = new Set<string>();
    for (const w of raw.swipes.slice(-3000)) {
      if (!w || typeof w.key !== 'string' || seenS.has(w.key)) continue;
      seenS.add(w.key);
      lib.swipes.push({
        key: w.key.slice(0, 80),
        title: str(w.title).slice(0, 200),
        type: isType(w.type) ? w.type : 'movie',
        verdict: w.verdict === 'like' || w.verdict === 'seen' ? w.verdict : 'skip',
        at: time(w.at, Date.now()),
      });
    }
  }
  const m = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
  lib.meta = {
    createdAt: time(m.createdAt, Date.now()),
    legacyCheckedAt: Number.isFinite(Number(m.legacyCheckedAt)) && m.legacyCheckedAt ? Number(m.legacyCheckedAt) : null,
    legacyImported: Number(m.legacyImported) || 0,
    syncedIds: Array.isArray(m.syncedIds) ? m.syncedIds.filter((x: any) => typeof x === 'string').slice(0, 20000) : [],
    posterUploads:
      m.posterUploads && typeof m.posterUploads === 'object'
        ? (Object.fromEntries(Object.entries(m.posterUploads).filter(([k, v]) => MEDIA_NAME.test(k) && typeof v === 'string' && /^https:\/\//.test(v as string))) as Record<string, string>)
        : {},
    onlineOwner: typeof m.onlineOwner === 'string' && m.onlineOwner ? m.onlineOwner.slice(0, 80) : null,
  };
  return lib;
}

/** Every media file name a library refers to. */
export function mediaRefs(lib: Library): Set<string> {
  const out = new Set<string>();
  for (const c of lib.critiques) if (c.poster) out.add(c.poster);
  for (const w of lib.watchlist) if (w.poster) out.add(w.poster);
  for (const d of lib.drafts) if (d.data.poster) out.add(d.data.poster);
  for (const t of lib.trash) if (t.item.poster) out.add(t.item.poster);
  return out;
}

/**
 * Merge `incoming` into `base`. Items are matched by id; when both sides have the
 * same id the more recently updated copy wins. Returns the merged library and counts.
 */
export function mergeLibraries(base: Library, incoming: Library): { lib: Library; added: number; updated: number } {
  const lib: Library = structuredCloneSafe(base);
  let added = 0;
  let updated = 0;
  const byId = new Map(lib.critiques.map((c, i) => [c.id, i]));
  const byTitle = new Map(lib.critiques.map((c, i) => [c.type + '|' + c.title.trim().toLowerCase(), i]));
  for (const c of incoming.critiques) {
    const i = byId.get(c.id) ?? byTitle.get(c.type + '|' + c.title.trim().toLowerCase());
    if (i === undefined) {
      lib.critiques.push(c);
      byId.set(c.id, lib.critiques.length - 1);
      added++;
    } else if (c.updatedAt > lib.critiques[i].updatedAt) {
      lib.critiques[i] = { ...c, id: lib.critiques[i].id };
      updated++;
    }
  }
  const wById = new Map(lib.watchlist.map((w, i) => [w.id, i]));
  const wByTitle = new Map(lib.watchlist.map((w, i) => [w.type + '|' + w.title.trim().toLowerCase(), i]));
  let maxOrder = lib.watchlist.reduce((m, w) => Math.max(m, w.order), -1);
  for (const w of incoming.watchlist) {
    // something already critiqued doesn't need to sit on the watchlist
    if (lib.critiques.some((c) => c.type === w.type && c.title.trim().toLowerCase() === w.title.trim().toLowerCase())) continue;
    const i = wById.get(w.id) ?? wByTitle.get(w.type + '|' + w.title.trim().toLowerCase());
    if (i === undefined) {
      lib.watchlist.push({ ...w, order: ++maxOrder });
      added++;
    } else if (w.updatedAt > lib.watchlist[i].updatedAt) {
      lib.watchlist[i] = { ...w, id: lib.watchlist[i].id, order: lib.watchlist[i].order };
      updated++;
    }
  }
  const dIds = new Set(lib.drafts.map((d) => d.id));
  for (const d of incoming.drafts) if (!dIds.has(d.id)) lib.drafts.push(d);
  const sKeys = new Set(lib.swipes.map((w) => w.key));
  for (const w of incoming.swipes ?? []) if (!sKeys.has(w.key)) lib.swipes.push(w);
  return { lib, added, updated };
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/* ------------------------------------------------------------------ */
/* Draft helpers                                                        */
/* ------------------------------------------------------------------ */

export interface MissingField {
  field: 'title' | 'type' | ScoreKey;
  label: string;
}

export function missingRequired(d: DraftData): MissingField[] {
  const out: MissingField[] = [];
  if (!d.title.trim()) out.push({ field: 'title', label: 'Title' });
  if (!d.type) out.push({ field: 'type', label: 'Type' });
  for (const s of SCORES) if (d.scores[s.key] === null || d.scores[s.key] === undefined) out.push({ field: s.key, label: s.label });
  return out;
}

export function draftFromCritique(c: Critique): DraftData {
  return {
    title: c.title,
    type: c.type,
    director: c.director,
    studio: c.studio,
    cast: c.cast,
    description: c.description,
    comments: c.comments,
    scores: { ...c.scores },
    scoreNotes: { ...c.scoreNotes },
    classOverride: c.classOverride,
    recommend: c.recommend,
    finalRemarks: c.finalRemarks,
    poster: c.poster,
    posterColor: c.posterColor,
    year: c.year,
    ext: c.ext,
    genres: [...c.genres],
  };
}

export function draftFromWatch(w: WatchItem): DraftData {
  return {
    ...emptyDraftData(),
    title: w.title,
    type: w.type,
    director: w.director,
    studio: w.studio,
    cast: w.cast,
    description: w.description,
    poster: w.poster,
    posterColor: w.posterColor,
    year: w.year,
    ext: w.ext,
    genres: [...w.genres],
  };
}

/** Turn a complete draft into a critique. Throws if required fields are missing. */
export function critiqueFromDraft(d: DraftData, id: string, createdAt: number, keep?: Pick<Critique, 'favourite' | 'hidden'>): Critique {
  const missing = missingRequired(d);
  if (missing.length) throw new Error('Missing: ' + missing.map((m) => m.label).join(', '));
  const scores = {} as Record<ScoreKey, number>;
  for (const k of SCORE_KEYS) scores[k] = d.scores[k] as number;
  const notes: Partial<Record<ScoreKey, string>> = {};
  for (const k of SCORE_KEYS) {
    const t = d.scoreNotes[k];
    if (t && t.trim()) notes[k] = t.trim();
  }
  const now = Date.now();
  return normalizeCritique({
    id,
    title: d.title.trim(),
    type: d.type,
    director: d.director.trim(),
    studio: d.studio.trim(),
    cast: d.cast.trim(),
    description: d.description.trim(),
    comments: d.comments.trim(),
    scores,
    scoreNotes: notes,
    classOverride: d.classOverride,
    recommend: d.recommend,
    finalRemarks: d.finalRemarks.trim(),
    poster: d.poster,
    posterColor: d.posterColor,
    year: d.year,
    ext: d.ext,
    genres: d.genres,
    favourite: keep?.favourite ?? false,
    hidden: keep?.hidden ?? false,
    createdAt,
    updatedAt: now,
  });
}

/* ------------------------------------------------------------------ */
/* Old Marquee / Verdict format (localStorage 'verdict:items:v1')        */
/* ------------------------------------------------------------------ */

export interface LegacyCritique {
  id?: string;
  title?: string;
  type?: string;
  director?: string;
  studio?: string;
  cast?: string;
  description?: string;
  comments?: string;
  scores?: Record<string, number>;
  cls?: string;
  clsManual?: boolean;
  recommend?: string;
  finalRemarks?: string;
  poster?: string; // data URL
  createdAt?: number;
  updatedAt?: number;
}

/** Map an old-format critique to the new shape. The poster is returned separately (it needs saving to disk). */
export function fromLegacyCritique(raw: LegacyCritique): { critique: Critique; posterDataUrl: string | null } {
  const sug = suggestClass(totalOf((raw.scores as any) || {}));
  const cls = isClass(raw.cls) ? raw.cls : null;
  const manual = cls !== null && (raw.clsManual === undefined ? cls !== sug : !!raw.clsManual);
  const critique = normalizeCritique({
    id: raw.id,
    title: raw.title,
    type: raw.type,
    director: raw.director,
    studio: raw.studio,
    cast: raw.cast,
    description: raw.description,
    comments: raw.comments,
    scores: raw.scores,
    classOverride: manual ? cls : null,
    recommend: raw.recommend === 'yes' ? 'yes' : raw.recommend === 'no' ? 'no' : null,
    finalRemarks: raw.finalRemarks,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  });
  const p = typeof raw.poster === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,/.test(raw.poster) ? raw.poster : null;
  return { critique, posterDataUrl: p };
}

export function fromLegacyWatch(raw: any, index: number): WatchItem {
  return normalizeWatch(
    {
      id: raw?.id,
      title: raw?.title,
      type: raw?.type,
      status: raw?.status === 'watched' ? 'watched' : 'want',
      note: raw?.note,
      addedAt: raw?.addedAt,
      updatedAt: raw?.updatedAt,
    },
    index,
  );
}
