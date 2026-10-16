/* Adding titles to Up Next from anywhere: swipes, friends' critiques and friends' suggestions. */
import { useLibrary } from '../state/library';
import { savePosterFromUrl } from './images';
import { newId, normalizeExt, type ExtRef, type MediaType, type WatchItem, type WatchStatus } from '../shared/model';

export interface Addable {
  title: string;
  type: MediaType;
  year: string;
  ext: ExtRef | null;
  posterUrl: string | null;
  description?: string;
  genres?: string[];
  from?: string;
  note?: string;
}

export const extFromKey = (k: string | null | undefined): ExtRef | null => {
  if (!k) return null;
  const [source, kind, id] = k.split(':');
  return normalizeExt({ source, kind, id });
};

const same = (a: { title: string; type: MediaType }, b: { title: string; type: MediaType }) =>
  a.type === b.type && a.title.trim().toLowerCase() === b.title.trim().toLowerCase();

/** Where a title already is in your library, if anywhere. */
export function whereIs(item: { title: string; type: MediaType }): 'critiqued' | 'watchlist' | null {
  const lib = useLibrary.getState().lib;
  if (lib.critiques.some((c) => same(c, item))) return 'critiqued';
  if (lib.watchlist.some((w) => same(w, item))) return 'watchlist';
  return null;
}

/** Adds a title to Up Next straight away, then fills in credits and the poster in the background. */
export function addToUpNext(item: Addable, status: WatchStatus = 'want'): WatchItem | null {
  const lib = useLibrary.getState();
  const existing = lib.lib.watchlist.find((w) => same(w, item));
  if (existing) {
    if (existing.status !== status) lib.moveWatch(existing.id, status);
    return existing;
  }
  const order = Math.max(-1, ...lib.lib.watchlist.filter((w) => w.status === status).map((w) => w.order)) + 1;
  const w: WatchItem = {
    id: newId('w'),
    title: item.title,
    type: item.type,
    status,
    note: item.note ?? '',
    poster: null,
    posterColor: null,
    year: item.year,
    director: '',
    studio: '',
    cast: '',
    description: item.description ?? '',
    ext: item.ext,
    genres: item.genres ?? [],
    from: item.from ?? '',
    order,
    addedAt: Date.now(),
    updatedAt: Date.now(),
  };
  lib.upsertWatch(w);
  void (async () => {
    let patch: Partial<WatchItem> = {};
    if (item.ext) {
      try {
        const d = await window.iris.lookup.details({
          id: `${item.ext.source}:${item.ext.kind}:${item.ext.id}`,
          title: item.title,
          description: '',
          type: item.type,
          year: item.year,
          thumb: null,
          image: item.posterUrl,
          qid: null,
          extract: item.description ?? '',
          source: item.ext.source,
          ext: item.ext,
        });
        patch = { director: d.director, studio: d.studio, cast: d.cast, description: d.description || w.description, genres: d.genres?.length ? d.genres : w.genres };
        if (!item.posterUrl && d.image) item.posterUrl = d.image;
      } catch {
        /* the title is still on the list */
      }
    }
    if (item.posterUrl) {
      const p = await savePosterFromUrl(item.posterUrl).catch(() => null);
      if (p) patch = { ...patch, poster: p.name, posterColor: p.color };
    }
    const cur = useLibrary.getState().lib.watchlist.find((x) => x.id === w.id);
    if (cur && Object.keys(patch).length) useLibrary.getState().upsertWatch({ ...cur, ...patch, updatedAt: Date.now() });
  })();
  return w;
}
