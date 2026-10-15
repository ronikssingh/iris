/* Online look-up of titles through Wikipedia and Wikidata (no account or API key needed). */
import { net } from 'electron';
import type { MediaType } from '../src/shared/model';
import type { LookupCandidate, LookupDetails } from '../src/shared/ipc';
import { USER_AGENT } from './media';

const WP = 'https://en.wikipedia.org/w/api.php';
const WD = 'https://www.wikidata.org/w/api.php';

type Fetcher = (url: string) => Promise<any>;

const defaultFetcher: Fetcher = async (url) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await net.fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Api-User-Agent': USER_AGENT },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
};

let fetcher: Fetcher = defaultFetcher;
/** Tests swap in canned responses. */
export function setLookupFetcher(f: Fetcher | null) {
  fetcher = f ?? defaultFetcher;
}

export function classify(description: string): MediaType | null {
  const d = (description || '').toLowerCase();
  if (!d) return null;
  if (/television film|tv film|tv movie|made-for-television film/.test(d)) return 'movie';
  if (
    /(television|tv|web|streaming|animated|anime|drama|comedy|reality|docu)[\w\s-]*\b(series|show|miniseries|serial|programme|program)\b/.test(d) ||
    /\bminiseries\b|\bsitcom\b|\bsoap opera\b|\bgame show\b|\btalk show\b|\banime\b/.test(d)
  )
    return 'show';
  if (/\bvideo game\b|\bgame\b/.test(d)) return 'game';
  if (/\bfilm\b|\bmovie\b|\bdocumentary\b/.test(d)) return 'movie';
  if (/\bseries\b/.test(d)) return 'show';
  return null;
}

export function cleanTitle(t: string): string {
  return t
    .replace(
      /\s*\((?:[^)]*\b(?:film|series|tv series|miniseries|video game|game|season|soundtrack|tv program|tv programme|anime)\b[^)]*)\)\s*$/i,
      '',
    )
    .trim();
}

function yearIn(s: string): string {
  const m = /\b(18[89]\d|19\d\d|20\d\d)\b/.exec(s || '');
  return m ? m[1] : '';
}

export async function searchTitles(query: string, type: MediaType | null): Promise<LookupCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const run = async (withHint: boolean) => {
    const hint = !withHint ? '' : type === 'movie' ? ' film' : type === 'show' ? ' television series' : type === 'game' ? ' video game' : '';
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      redirects: '1',
      generator: 'search',
      gsrsearch: q + hint,
      gsrlimit: '12',
      gsrnamespace: '0',
      prop: 'pageprops|pageimages|description|extracts',
      ppprop: 'wikibase_item',
      piprop: 'thumbnail|original',
      pithumbsize: '360',
      pilicense: 'any',
      exintro: '1',
      explaintext: '1',
      exsentences: '3',
      exlimit: '12',
    });
    const data = await fetcher(`${WP}?${params}`);
    const pages: any[] = Array.isArray(data?.query?.pages) ? [...data.query.pages] : [];
    pages.sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
    const out: LookupCandidate[] = [];
    for (const p of pages) {
      const desc = typeof p.description === 'string' ? p.description : '';
      const t = classify(desc);
      if (!t) continue;
      if (type && t !== type) continue;
      out.push({
        id: String(p.pageid ?? p.title),
        title: String(p.title ?? ''),
        description: desc,
        type: t,
        year: yearIn(desc) || yearIn(String(p.extract ?? '').slice(0, 200)),
        thumb: p.thumbnail?.source ?? null,
        image: p.original?.source ?? p.thumbnail?.source ?? null,
        qid: p.pageprops?.wikibase_item ?? null,
        extract: typeof p.extract === 'string' ? p.extract : '',
      });
    }
    return out;
  };
  try {
    let out = await run(true);
    if (!out.length && type) out = await run(false);
    return out.slice(0, 8);
  } catch {
    return [];
  }
}

function claimIds(claims: any, prop: string): string[] {
  const list: any[] = Array.isArray(claims?.[prop]) ? claims[prop] : [];
  const preferred = list.filter((c) => c?.rank === 'preferred');
  const pool = (preferred.length ? preferred : list).filter((c) => c?.rank !== 'deprecated');
  const ids: string[] = [];
  for (const c of pool) {
    const id = c?.mainsnak?.datavalue?.value?.id;
    if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function claimYear(claims: any, prop: string): string {
  const list: any[] = Array.isArray(claims?.[prop]) ? claims[prop] : [];
  let best = '';
  for (const c of list) {
    const t = c?.mainsnak?.datavalue?.value?.time;
    if (typeof t === 'string') {
      const y = t.replace(/^\+/, '').slice(0, 4);
      if (/^\d{4}$/.test(y) && (!best || y < best)) best = y;
    }
  }
  return best;
}

function tidyExtract(s: string): string {
  return (s || '')
    .replace(/\s*\([^()]*(pronounced|listen|IPA)[^()]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
}

export async function titleDetails(c: LookupCandidate): Promise<LookupDetails> {
  const base: LookupDetails = {
    title: cleanTitle(c.title),
    type: c.type,
    year: c.year,
    director: '',
    studio: '',
    cast: '',
    description: tidyExtract(c.extract),
    image: c.image || c.thumb,
  };
  if (!c.qid) return base;
  try {
    const ent = await fetcher(
      `${WD}?${new URLSearchParams({ action: 'wbgetentities', ids: c.qid, props: 'claims', format: 'json' })}`,
    );
    const claims = ent?.entities?.[c.qid]?.claims ?? {};
    const t = c.type;
    const directors = claimIds(claims, 'P57').slice(0, 4);
    const creators = claimIds(claims, 'P170').slice(0, 4);
    const production = claimIds(claims, 'P272').slice(0, 3);
    const distributor = claimIds(claims, 'P750').slice(0, 2);
    const network = claimIds(claims, 'P449').slice(0, 2);
    const developer = claimIds(claims, 'P178').slice(0, 3);
    const publisher = claimIds(claims, 'P123').slice(0, 2);
    const cast = [...claimIds(claims, 'P161'), ...claimIds(claims, 'P725')].filter((v, i, a) => a.indexOf(v) === i).slice(0, 10);

    const dirIds = t === 'show' ? (directors.length ? directors : creators) : directors;
    const studioIds =
      t === 'game'
        ? developer.length
          ? developer
          : publisher
        : t === 'show'
          ? production.length
            ? production
            : network
          : production.length
            ? production
            : distributor;

    const need = [...new Set([...dirIds, ...studioIds, ...cast])].slice(0, 50);
    const labels: Record<string, string> = {};
    if (need.length) {
      const lab = await fetcher(
        `${WD}?${new URLSearchParams({ action: 'wbgetentities', ids: need.join('|'), props: 'labels', languages: 'en', format: 'json' })}`,
      );
      for (const id of need) {
        const v = lab?.entities?.[id]?.labels?.en?.value;
        if (typeof v === 'string') labels[id] = v;
      }
    }
    const names = (ids: string[]) => ids.map((id) => labels[id]).filter(Boolean).join(', ');
    return {
      ...base,
      year: claimYear(claims, 'P577') || base.year,
      director: names(dirIds),
      studio: names(studioIds),
      cast: names(cast),
    };
  } catch {
    return base;
  }
}
