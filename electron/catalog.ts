/* Movie, show and game details from TMDB (films and series) and IGDB (games), with Wikipedia as a fallback. */
import type { ExtRef, MediaType } from '../src/shared/model';
import type { LookupCandidate, LookupDetails, RecCard, RecRequest } from '../src/shared/ipc';
import { KEYS } from './keys';
import { searchTitles as wikiSearch, titleDetails as wikiDetails } from './lookup';

export type HttpFn = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<any>;

let http: HttpFn = async () => {
  throw new Error('no network');
};
/** main.ts plugs in Electron's network stack; tests plug in canned answers. */
export function setCatalogHttp(fn: HttpFn) {
  http = fn;
}

const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const IGDB = 'https://api.igdb.com/v4';
const IGDB_IMG = 'https://images.igdb.com/igdb/image/upload/';

export const catalogStatus = () => ({ tmdb: !!KEYS.tmdb, igdb: !!(KEYS.igdbId && KEYS.igdbSecret) });

/* ------------------------------------------------------------------ TMDB */

const tmdb = (path: string, params: Record<string, string | number> = {}) => {
  const q = new URLSearchParams({ language: 'en-US', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  return http(`${TMDB}${path}?${q}`, { headers: { Authorization: `Bearer ${KEYS.tmdb}`, Accept: 'application/json' } });
};

const yearOf = (d?: string) => (d && /^\d{4}/.test(d) ? d.slice(0, 4) : '');
const tmdbKind = (t: MediaType) => (t === 'show' ? 'tv' : 'movie');

let genreNames: Record<string, Record<number, string>> | null = null;
async function tmdbGenres(): Promise<Record<string, Record<number, string>>> {
  if (genreNames) return genreNames;
  const out: Record<string, Record<number, string>> = { movie: {}, tv: {} };
  for (const k of ['movie', 'tv'] as const) {
    try {
      const r = await tmdb(`/genre/${k}/list`);
      for (const g of r?.genres ?? []) out[k][g.id] = g.name;
    } catch {
      /* names are a nicety */
    }
  }
  genreNames = out;
  return out;
}

function tmdbCandidate(r: any, kind: 'movie' | 'tv'): LookupCandidate {
  const title = kind === 'movie' ? r.title : r.name;
  const year = yearOf(kind === 'movie' ? r.release_date : r.first_air_date);
  return {
    id: `tmdb:${kind}:${r.id}`,
    title: String(title ?? ''),
    description: [year, kind === 'movie' ? 'Film' : 'TV series'].filter(Boolean).join(' '),
    type: kind === 'movie' ? 'movie' : 'show',
    year,
    thumb: r.poster_path ? IMG + 'w185' + r.poster_path : null,
    image: r.poster_path ? IMG + 'w780' + r.poster_path : null,
    qid: null,
    extract: String(r.overview ?? ''),
    source: 'tmdb',
    ext: { source: 'tmdb', kind, id: String(r.id) },
    popularity: Number(r.vote_count) || 0,
  };
}

async function tmdbSearch(q: string, type: MediaType | null): Promise<LookupCandidate[]> {
  if (type === 'movie' || type === 'show') {
    const kind = tmdbKind(type);
    const r = await tmdb(`/search/${kind}`, { query: q, include_adult: 'false', page: 1 });
    return (r?.results ?? []).slice(0, 8).map((x: any) => tmdbCandidate(x, kind));
  }
  const r = await tmdb('/search/multi', { query: q, include_adult: 'false', page: 1 });
  return (r?.results ?? [])
    .filter((x: any) => x.media_type === 'movie' || x.media_type === 'tv')
    .slice(0, 6)
    .map((x: any) => tmdbCandidate(x, x.media_type));
}

async function tmdbDetails(ext: ExtRef): Promise<LookupDetails> {
  if (ext.kind === 'movie') {
    const r = await tmdb(`/movie/${ext.id}`, { append_to_response: 'credits' });
    const directors = (r?.credits?.crew ?? []).filter((c: any) => c.job === 'Director').map((c: any) => c.name);
    return {
      title: r.title ?? '',
      type: 'movie',
      year: yearOf(r.release_date),
      director: [...new Set(directors)].slice(0, 3).join(', '),
      studio: (r.production_companies ?? []).slice(0, 2).map((c: any) => c.name).join(', '),
      cast: (r.credits?.cast ?? []).slice(0, 8).map((c: any) => c.name).join(', '),
      description: r.overview ?? '',
      image: r.poster_path ? IMG + 'w780' + r.poster_path : null,
      ext,
      genres: (r.genres ?? []).map((g: any) => g.name),
    };
  }
  const r = await tmdb(`/tv/${ext.id}`, { append_to_response: 'aggregate_credits' });
  const creators = (r.created_by ?? []).map((c: any) => c.name);
  return {
    title: r.name ?? '',
    type: 'show',
    year: yearOf(r.first_air_date),
    director: creators.slice(0, 3).join(', '),
    studio: ((r.production_companies ?? []).length ? r.production_companies : (r.networks ?? [])).slice(0, 2).map((c: any) => c.name).join(', '),
    cast: (r.aggregate_credits?.cast ?? r.credits?.cast ?? []).slice(0, 8).map((c: any) => c.name).join(', '),
    description: r.overview ?? '',
    image: r.poster_path ? IMG + 'w780' + r.poster_path : null,
    ext,
    genres: (r.genres ?? []).map((g: any) => g.name),
  };
}

/* ------------------------------------------------------------------ IGDB */

let igdbToken: { token: string; until: number } | null = null;
async function igdbAuth(): Promise<string> {
  if (igdbToken && igdbToken.until > Date.now() + 60_000) return igdbToken.token;
  const q = new URLSearchParams({ client_id: KEYS.igdbId, client_secret: KEYS.igdbSecret, grant_type: 'client_credentials' });
  const r = await http(`https://id.twitch.tv/oauth2/token?${q}`, { method: 'POST' });
  if (!r?.access_token) throw new Error('IGDB sign-in failed');
  igdbToken = { token: r.access_token, until: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
  return igdbToken.token;
}

async function igdb(endpoint: string, body: string): Promise<any[]> {
  const token = await igdbAuth();
  const r = await http(`${IGDB}/${endpoint}`, {
    method: 'POST',
    headers: { 'Client-ID': KEYS.igdbId, Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'text/plain' },
    body,
  });
  return Array.isArray(r) ? r : [];
}

const GAME_FIELDS =
  'name,first_release_date,cover.image_id,summary,genres.name,total_rating,total_rating_count,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,parent_game,version_parent';

const gameYear = (t?: number) => (t ? String(new Date(t * 1000).getUTCFullYear()) : '');

function gameCandidate(g: any): LookupCandidate {
  const year = gameYear(g.first_release_date);
  const cover = g.cover?.image_id;
  return {
    id: `igdb:game:${g.id}`,
    title: String(g.name ?? ''),
    description: [year, 'Video game'].filter(Boolean).join(' '),
    type: 'game',
    year,
    thumb: cover ? `${IGDB_IMG}t_cover_small_2x/${cover}.jpg` : null,
    image: cover ? `${IGDB_IMG}t_cover_big_2x/${cover}.jpg` : null,
    qid: null,
    extract: String(g.summary ?? ''),
    source: 'igdb',
    ext: { source: 'igdb', kind: 'game', id: String(g.id) },
    popularity: Number(g.total_rating_count) || 0,
  };
}

const quote = (s: string) => '"' + s.replace(/["\\]/g, ' ').trim() + '"';

async function igdbSearch(q: string): Promise<LookupCandidate[]> {
  const rows = await igdb('games', `search ${quote(q)}; fields ${GAME_FIELDS}; where version_parent = null & parent_game = null; limit 20;`);
  const norm = q.trim().toLowerCase();
  return rows
    .map((g, i) => ({ g, i }))
    .sort((a, b) => {
      const ea = String(a.g.name).toLowerCase() === norm ? 1 : 0;
      const eb = String(b.g.name).toLowerCase() === norm ? 1 : 0;
      if (ea !== eb) return eb - ea;
      const pa = Math.log10(1 + (a.g.total_rating_count || 0)) - a.i * 0.15;
      const pb = Math.log10(1 + (b.g.total_rating_count || 0)) - b.i * 0.15;
      return pb - pa;
    })
    .slice(0, 8)
    .map(({ g }) => gameCandidate(g));
}

function gameDetailsFrom(g: any, ext: ExtRef): LookupDetails {
  const cos = g.involved_companies ?? [];
  const devs = cos.filter((c: any) => c.developer).map((c: any) => c.company?.name).filter(Boolean);
  const pubs = cos.filter((c: any) => c.publisher).map((c: any) => c.company?.name).filter(Boolean);
  const c = gameCandidate(g);
  return {
    title: c.title,
    type: 'game',
    year: c.year,
    director: '',
    studio: [...new Set(devs.length ? devs : pubs)].slice(0, 2).join(', '),
    cast: '',
    description: g.summary ?? '',
    image: c.image,
    ext,
    genres: (g.genres ?? []).map((x: any) => x.name),
  };
}

async function igdbDetails(ext: ExtRef): Promise<LookupDetails> {
  const rows = await igdb('games', `fields ${GAME_FIELDS}; where id = ${Number(ext.id)};`);
  if (!rows[0]) throw new Error('Not found');
  return gameDetailsFrom(rows[0], ext);
}

/* --------------------------------------------------------------- Public */

export async function searchTitles(query: string, type: MediaType | null): Promise<LookupCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const st = catalogStatus();
  const jobs: Promise<LookupCandidate[]>[] = [];
  if (st.tmdb && type !== 'game') jobs.push(tmdbSearch(q, type).catch(() => []));
  if (st.igdb && (type === 'game' || type === null)) jobs.push(igdbSearch(q).catch(() => []));
  const parts = await Promise.all(jobs);
  let out: LookupCandidate[] = [];
  if (type === null && parts.length === 2) {
    // interleave by how well known each title is, keeping exact title matches first
    const norm = q.toLowerCase();
    out = [...parts[0], ...parts[1].slice(0, 4)].sort((a, b) => {
      const ea = a.title.toLowerCase() === norm ? 1 : 0;
      const eb = b.title.toLowerCase() === norm ? 1 : 0;
      if (ea !== eb) return eb - ea;
      return (b.popularity ?? 0) - (a.popularity ?? 0);
    });
  } else out = parts.flat();
  if (!out.length) out = await wikiSearch(q, type);
  return out.slice(0, 8);
}

export async function titleDetails(c: LookupCandidate): Promise<LookupDetails> {
  try {
    if (c.ext?.source === 'tmdb') return await tmdbDetails(c.ext);
    if (c.ext?.source === 'igdb') return await igdbDetails(c.ext);
  } catch {
    return {
      title: c.title,
      type: c.type,
      year: c.year,
      director: '',
      studio: '',
      cast: '',
      description: c.extract,
      image: c.image,
      ext: c.ext ?? null,
      genres: [],
    };
  }
  const d = await wikiDetails(c);
  return { ...d, ext: null, genres: [] };
}

/* -------------------------------------------------------- Recommendations */

const TMDB_MIN_VOTES = { movie: 2500, tv: 600 };
const IGDB_MIN = 120;

const normTitle = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const resolved = new Map<string, ExtRef | null>();
async function resolveSeed(s: RecRequest['seeds'][number]): Promise<ExtRef | null> {
  if (s.ext) return s.ext;
  const key = s.type + '|' + normTitle(s.title) + '|' + s.year;
  if (resolved.has(key)) return resolved.get(key)!;
  let ext: ExtRef | null = null;
  try {
    if (s.type === 'game') ext = (await igdbSearch(s.title))[0]?.ext ?? null;
    else {
      const hits = await tmdbSearch(s.title, s.type);
      const best = hits.find((h) => !s.year || h.year === s.year) ?? hits[0];
      ext = best?.ext ?? null;
    }
  } catch {
    ext = null;
  }
  resolved.set(key, ext);
  return ext;
}

interface Pool {
  card: RecCard;
  score: number;
}

function tmdbCard(r: any, kind: 'movie' | 'tv', reason: string, names: Record<number, string>): RecCard | null {
  if (!r?.poster_path || r.adult) return null;
  const title = kind === 'movie' ? r.title : r.name;
  return {
    key: `tmdb:${kind}:${r.id}`,
    ext: { source: 'tmdb', kind, id: String(r.id) },
    type: kind === 'movie' ? 'movie' : 'show',
    title: String(title ?? ''),
    year: yearOf(kind === 'movie' ? r.release_date : r.first_air_date),
    overview: String(r.overview ?? ''),
    poster: IMG + 'w500' + r.poster_path,
    backdrop: r.backdrop_path ? IMG + 'w1280' + r.backdrop_path : null,
    genres: (r.genre_ids ?? []).map((g: number) => names[g]).filter(Boolean).slice(0, 3),
    score: r.vote_average ? Math.round(r.vote_average * 10) : null,
    votes: Number(r.vote_count) || 0,
    reason,
  };
}

function gameCard(g: any, reason: string): RecCard | null {
  const c = gameCandidate(g);
  if (!c.image) return null;
  return {
    key: c.id,
    ext: c.ext!,
    type: 'game',
    title: c.title,
    year: c.year,
    overview: c.extract,
    poster: c.image,
    backdrop: null,
    genres: (g.genres ?? []).map((x: any) => x.name).slice(0, 3),
    score: g.total_rating ? Math.round(g.total_rating) : null,
    votes: Number(g.total_rating_count) || 0,
    reason,
  };
}

export async function recommend(req: RecRequest): Promise<RecCard[]> {
  const st = catalogStatus();
  const exclude = new Set(req.exclude);
  const exTitles = new Set(req.excludeTitles.map(normTitle));
  const pool = new Map<string, Pool>();
  const add = (card: RecCard | null, score: number) => {
    if (!card || exclude.has(card.key) || exTitles.has(normTitle(card.title))) return;
    if (req.era === 'recent' && card.year && Number(card.year) < 2000) return;
    const prev = pool.get(card.key);
    if (prev) prev.score += score * 0.6;
    else pool.set(card.key, { card, score });
  };
  const seeds = req.seeds
    .filter((s) => s.type === req.type && s.rating >= 750)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 6);
  const page = Math.max(1, req.page);

  if (req.type !== 'game') {
    if (!st.tmdb) return [];
    const kind = tmdbKind(req.type);
    const min = TMDB_MIN_VOTES[kind];
    const names = (await tmdbGenres())[kind];
    const genreWeight = new Map<number, number>();
    // 1. titles like the ones you rated highest
    await Promise.all(
      seeds.map(async (s) => {
        const ext = await resolveSeed(s);
        if (!ext || ext.source !== 'tmdb') return;
        try {
          const r = await tmdb(`/${kind}/${ext.id}/recommendations`, { page: Math.min(page, 3) });
          for (const x of r?.results ?? []) {
            if ((x.vote_count ?? 0) < min) continue;
            for (const g of x.genre_ids ?? []) genreWeight.set(g, (genreWeight.get(g) ?? 0) + s.rating / 1000);
            add(tmdbCard(x, kind, `Because you gave ${s.title} ${s.rating}`, names), 3 + s.rating / 400 + Math.log10(x.vote_count));
          }
        } catch {
          /* one seed failing shouldn't sink the rest */
        }
      }),
    );
    // 2. well-known titles in the genres you rate highly
    const topGenres = [...genreWeight.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
    try {
      const params: Record<string, string | number> = { sort_by: 'vote_count.desc', 'vote_count.gte': min, include_adult: 'false', page };
      if (topGenres.length) params.with_genres = topGenres.join('|');
      if (req.era === 'recent') params[kind === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte'] = '2000-01-01';
      const r = await tmdb(`/discover/${kind}`, params);
      const label = topGenres.map((g) => names[g]).filter(Boolean).join(' and ');
      for (const x of r?.results ?? []) add(tmdbCard(x, kind, label ? `Big in ${label}, which you rate highly` : 'One of the most loved of all time', names), 1.5 + Math.log10(x.vote_count || 1) * 0.6);
    } catch {
      /* fine */
    }
    // 3. what everyone's watching right now
    try {
      const r = await tmdb(`/trending/${kind}/week`, { page });
      for (const x of r?.results ?? []) if ((x.vote_count ?? 0) >= min / 3) add(tmdbCard(x, kind, 'Everyone is talking about this one this week', names), 1.8 + Math.log10(x.vote_count || 1) * 0.4);
    } catch {
      /* fine */
    }
    // 4. friends' favourites
    for (const f of req.friends.filter((f) => f.type === req.type && f.ext?.source === 'tmdb')) {
      try {
        const r = await tmdb(`/${kind}/${f.ext!.id}`);
        add(tmdbCard({ ...r, genre_ids: (r.genres ?? []).map((g: any) => g.id) }, kind, `${f.by} rated it ${f.rating}`, names), 5 + f.rating / 300);
      } catch {
        /* fine */
      }
    }
  } else {
    if (!st.igdb) return [];
    const ids: number[] = [];
    const seedName = new Map<number, { title: string; rating: number }>();
    for (const s of seeds) {
      const ext = await resolveSeed(s);
      if (ext?.source === 'igdb') {
        ids.push(Number(ext.id));
        seedName.set(Number(ext.id), { title: s.title, rating: s.rating });
      }
    }
    const era = req.era === 'recent' ? ' & first_release_date > 946684800' : '';
    if (ids.length) {
      try {
        const rows = await igdb('games', `fields similar_games.${GAME_FIELDS.split(',').join(',similar_games.')},genres.id; where id = (${ids.join(',')});`);
        for (const row of rows) {
          const seed = seedName.get(row.id);
          for (const g of row.similar_games ?? []) {
            if ((g.total_rating_count ?? 0) < IGDB_MIN || g.version_parent || g.parent_game) continue;
            add(gameCard(g, seed ? `Because you gave ${seed.title} ${seed.rating}` : 'Similar to games you love'), 3 + Math.log10(g.total_rating_count));
          }
        }
      } catch {
        /* fine */
      }
    }
    try {
      const rows = await igdb(
        'games',
        `fields ${GAME_FIELDS}; where total_rating_count > 400 & cover != null & version_parent = null & parent_game = null${era}; sort total_rating_count desc; limit 40; offset ${(page - 1) * 40};`,
      );
      for (const g of rows) add(gameCard(g, 'One of the most played and loved games'), 1.2 + Math.log10(g.total_rating_count || 1) * 0.5);
    } catch {
      /* fine */
    }
    for (const f of req.friends.filter((f) => f.type === 'game' && f.ext?.source === 'igdb')) {
      try {
        const rows = await igdb('games', `fields ${GAME_FIELDS}; where id = ${Number(f.ext!.id)};`);
        if (rows[0]) add(gameCard(rows[0], `${f.by} rated it ${f.rating}`), 5 + f.rating / 300);
      } catch {
        /* fine */
      }
    }
  }
  return [...pool.values()]
    .map((p) => ({ ...p, score: p.score + Math.random() * 0.8 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((p) => p.card);
}
