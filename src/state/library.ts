import { create } from 'zustand';
import {
  emptyLibrary,
  newId,
  type Critique,
  type Draft,
  type Library,
  type Swipe,
  type TrashEntry,
  type WatchItem,
  type WatchStatus,
} from '../shared/model';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LibState {
  lib: Library;
  loaded: boolean;
  saveState: SaveState;
  saveError: string | null;
  setLibrary: (lib: Library, persist?: boolean) => void;
  upsertCritique: (c: Critique) => void;
  removeCritique: (id: string) => TrashEntry | null;
  upsertWatch: (w: WatchItem) => void;
  removeWatch: (id: string) => TrashEntry | null;
  moveWatch: (id: string, status: WatchStatus, beforeId?: string | null) => void;
  upsertDraft: (d: Draft) => void;
  removeDraft: (id: string) => void;
  restoreTrash: (id: string) => void;
  purgeTrash: (id?: string) => void;
  addSwipe: (w: Swipe) => void;
  undoSwipe: (key: string) => void;
  patchMeta: (m: Partial<Library['meta']>) => void;
  mergeCritiques: (incoming: Critique[]) => void;
  mergeWatch: (incoming: WatchItem[], removeIds: string[]) => void;
  mergeSwipes: (incoming: Swipe[]) => void;
}

const TRASH_DAYS = 30;

function pruneTrash(lib: Library): Library {
  const cutoff = Date.now() - TRASH_DAYS * 864e5;
  if (!lib.trash.some((t) => t.deletedAt < cutoff)) return lib;
  return { ...lib, trash: lib.trash.filter((t) => t.deletedAt >= cutoff) };
}

export const useLibrary = create<LibState>((set, get) => ({
  lib: emptyLibrary(),
  loaded: false,
  saveState: 'idle',
  saveError: null,

  setLibrary: (lib, persist = false) => {
    set({ lib: pruneTrash(lib), loaded: true });
    if (persist) scheduleSave();
  },

  upsertCritique: (c) => {
    const lib = get().lib;
    const i = lib.critiques.findIndex((x) => x.id === c.id);
    const critiques = [...lib.critiques];
    if (i >= 0) critiques[i] = c;
    else critiques.push(c);
    set({ lib: { ...lib, critiques } });
    scheduleSave();
  },

  removeCritique: (id) => {
    const lib = get().lib;
    const item = lib.critiques.find((c) => c.id === id);
    if (!item) return null;
    const entry: TrashEntry = { id, kind: 'critique', item, deletedAt: Date.now() };
    set({ lib: { ...lib, critiques: lib.critiques.filter((c) => c.id !== id), trash: [entry, ...lib.trash.filter((t) => t.id !== id)] } });
    scheduleSave();
    return entry;
  },

  upsertWatch: (w) => {
    const lib = get().lib;
    const i = lib.watchlist.findIndex((x) => x.id === w.id);
    const watchlist = [...lib.watchlist];
    if (i >= 0) watchlist[i] = w;
    else watchlist.push(w);
    set({ lib: { ...lib, watchlist } });
    scheduleSave();
  },

  removeWatch: (id) => {
    const lib = get().lib;
    const item = lib.watchlist.find((w) => w.id === id);
    if (!item) return null;
    const entry: TrashEntry = { id, kind: 'watch', item, deletedAt: Date.now() };
    set({ lib: { ...lib, watchlist: lib.watchlist.filter((w) => w.id !== id), trash: [entry, ...lib.trash.filter((t) => t.id !== id)] } });
    scheduleSave();
    return entry;
  },

  moveWatch: (id, status, beforeId = null) => {
    const lib = get().lib;
    const item = lib.watchlist.find((w) => w.id === id);
    if (!item) return;
    const others = lib.watchlist.filter((w) => w.id !== id);
    const col = others.filter((w) => w.status === status).sort((a, b) => a.order - b.order);
    const rest = others.filter((w) => w.status !== status);
    const now = Date.now();
    const moved = { ...item, status, updatedAt: now };
    const at = beforeId ? col.findIndex((w) => w.id === beforeId) : -1;
    if (at >= 0) col.splice(at, 0, moved);
    else col.push(moved);
    // every item whose place changed gets a fresh time, so the new order reaches your other computers
    const ordered = col.map((w, i) => (w.order === i ? w : { ...w, order: i, updatedAt: now }));
    set({ lib: { ...lib, watchlist: [...rest, ...ordered] } });
    scheduleSave();
  },

  upsertDraft: (d) => {
    const lib = get().lib;
    const i = lib.drafts.findIndex((x) => x.id === d.id);
    const drafts = [...lib.drafts];
    if (i >= 0) drafts[i] = d;
    else drafts.push(d);
    set({ lib: { ...lib, drafts } });
    scheduleSave(900);
  },

  removeDraft: (id) => {
    const lib = get().lib;
    if (!lib.drafts.some((d) => d.id === id)) return;
    set({ lib: { ...lib, drafts: lib.drafts.filter((d) => d.id !== id) } });
    scheduleSave();
  },

  restoreTrash: (id) => {
    const lib = get().lib;
    const t = lib.trash.find((x) => x.id === id);
    if (!t) return;
    const trash = lib.trash.filter((x) => x.id !== id);
    if (t.kind === 'critique') {
      const exists = lib.critiques.some((c) => c.id === t.item.id);
      const item = exists ? { ...t.item, id: newId('c') } : t.item;
      set({ lib: { ...lib, trash, critiques: [...lib.critiques, item] } });
    } else {
      const exists = lib.watchlist.some((w) => w.id === t.item.id);
      const item = exists ? { ...t.item, id: newId('w') } : t.item;
      set({ lib: { ...lib, trash, watchlist: [...lib.watchlist, item] } });
    }
    scheduleSave();
  },

  purgeTrash: (id) => {
    const lib = get().lib;
    set({ lib: { ...lib, trash: id ? lib.trash.filter((t) => t.id !== id) : [] } });
    scheduleSave();
  },

  addSwipe: (w) => {
    const lib = get().lib;
    set({ lib: { ...lib, swipes: [...lib.swipes.filter((x) => x.key !== w.key), w].slice(-3000) } });
    scheduleSave();
  },

  undoSwipe: (key) => {
    const lib = get().lib;
    set({ lib: { ...lib, swipes: lib.swipes.filter((x) => x.key !== key) } });
    scheduleSave();
  },

  patchMeta: (m) => {
    const lib = get().lib;
    set({ lib: { ...lib, meta: { ...lib.meta, ...m } } });
    scheduleSave();
  },

  mergeCritiques: (incoming) => {
    if (!incoming.length) return;
    const lib = get().lib;
    const critiques = [...lib.critiques];
    for (const c of incoming) {
      const i = critiques.findIndex((x) => x.id === c.id);
      if (i < 0) critiques.push(c);
      else if (c.updatedAt > critiques[i].updatedAt) critiques[i] = c;
    }
    set({ lib: { ...lib, critiques } });
    scheduleSave();
  },

  /** Up Next items changed or added on another computer, and ones deleted there. */
  mergeWatch: (incoming, removeIds) => {
    if (!incoming.length && !removeIds.length) return;
    const lib = get().lib;
    const gone = new Set(removeIds);
    const watchlist = lib.watchlist.filter((w) => !gone.has(w.id));
    for (const w of incoming) {
      const i = watchlist.findIndex((x) => x.id === w.id);
      if (i < 0) watchlist.push(w);
      else if (w.updatedAt > watchlist[i].updatedAt) watchlist[i] = w;
    }
    set({ lib: { ...lib, watchlist } });
    scheduleSave();
  },

  /** Discover verdicts made on another computer; the latest verdict for a title wins. */
  mergeSwipes: (incoming) => {
    if (!incoming.length) return;
    const lib = get().lib;
    const byKey = new Map(lib.swipes.map((w) => [w.key, w]));
    let changed = false;
    for (const w of incoming) {
      const cur = byKey.get(w.key);
      if (!cur || w.at > cur.at) {
        byKey.set(w.key, w);
        changed = true;
      }
    }
    if (!changed) return;
    set({ lib: { ...lib, swipes: [...byKey.values()].sort((a, b) => a.at - b.at).slice(-3000) } });
    scheduleSave();
  },
}));

/* ------------------------------------------------------------------ */
/* Saving                                                              */
/* ------------------------------------------------------------------ */

let timer: number | null = null;
let inflight: Promise<void> | null = null;

function scheduleSave(delay = 350) {
  useLibrary.setState({ saveState: 'saving' });
  if (timer) clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void flushLibrary();
  }, delay);
}

export async function flushLibrary(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (inflight) await inflight;
  const lib = useLibrary.getState().lib;
  inflight = (async () => {
    try {
      const r = await window.iris.saveLibrary(lib);
      useLibrary.setState({ saveState: r.ok ? 'saved' : 'error', saveError: r.ok ? null : r.error || 'Could not save' });
    } catch (e: any) {
      useLibrary.setState({ saveState: 'error', saveError: e?.message || String(e) });
    } finally {
      inflight = null;
    }
  })();
  await inflight;
}

export function hasPendingSave() {
  return timer !== null || inflight !== null;
}
