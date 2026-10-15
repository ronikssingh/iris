// Runs Iris's real catalogue code against TMDB and IGDB and records what came back (no keys in the output).
import fs from 'node:fs';
import { catalogStatus, recommend, searchTitles, setCatalogHttp, titleDetails } from './app/electron/catalog';

const calls: any[] = [];
setCatalogHttp(async (url, init) => {
  const res = await fetch(url, { method: init?.method ?? 'GET', headers: { 'User-Agent': 'Iris catalogue probe', ...(init?.headers ?? {}) }, body: init?.body });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  const secret = url.startsWith('https://id.twitch.tv');
  calls.push({ url: secret ? 'https://id.twitch.tv/oauth2/token' : url, body: init?.body ?? null, status: res.status, json: secret ? { access_token: 'redacted', expires_in: json?.expires_in, token_type: 'bearer' } : json });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + text.slice(0, 300));
  return json;
});

const report: any = { status: catalogStatus(), search: {}, details: {}, recommend: {} };
const queries: [string, any][] = [
  ['Interstellar', null], ['The Batman', 'movie'], ['Breaking Bad', null], ['The Office', 'show'], ['God of War Ragnarok', 'game'],
  ['god of war ragnarok', null], ['Red Dead Redemption 2', null], ['Elden Ring', 'game'], ['The Last of Us', null], ['Dune', 'movie'],
  ['Arcane', null], ['spider-man', 'game'], ['Oppenheimer', null], ['The Odyssey', 'movie'], ['Zelda breath of the wild', 'game'],
  ['Pokemon', 'game'], ['Severance', 'show'], ['Shogun', null], ['Resident Evil 4', 'game'], ['Avatar', null], ['Amelie', 'movie'], ['Pokémon', null],
];
for (const [q, t] of queries) {
  const key = q + ' | ' + (t ?? 'any');
  try {
    const hits = await searchTitles(q, t);
    report.search[key] = hits.map((h) => ({ title: h.title, type: h.type, year: h.year, source: h.source, popularity: h.popularity, ext: h.ext, thumb: !!h.thumb, desc: h.description }));
    if (hits[0] && !report.details[hits[0].id]) {
      const d = await titleDetails(hits[0]);
      report.details[hits[0].id] = { ...d, description: d.description.slice(0, 160) };
    }
  } catch (e) {
    report.search[key] = { error: String(e) };
  }
}
const seeds = {
  movie: [
    { title: 'Interstellar', type: 'movie', year: '2014', rating: 980, ext: null },
    { title: 'The Dark Knight', type: 'movie', year: '2008', rating: 940, ext: null },
    { title: 'Dune: Part Two', type: 'movie', year: '2024', rating: 900, ext: null },
  ],
  show: [
    { title: 'Breaking Bad', type: 'show', year: '2008', rating: 970, ext: null },
    { title: 'Arcane', type: 'show', year: '2021', rating: 930, ext: null },
  ],
  game: [
    { title: 'God of War Ragnarök', type: 'game', year: '2022', rating: 960, ext: null },
    { title: 'Red Dead Redemption 2', type: 'game', year: '2018', rating: 990, ext: null },
    { title: 'Elden Ring', type: 'game', year: '2022', rating: 880, ext: null },
  ],
};
for (const type of ['movie', 'show', 'game'] as const) {
  for (const era of ['all', 'recent'] as const) {
    try {
      const cards = await recommend({ type, seeds: seeds[type] as any, exclude: [], excludeTitles: seeds[type].map((s) => s.title), friends: [], era, page: 1 });
      report.recommend[type + '/' + era] = cards.map((c) => [c.title, c.year, c.votes, c.score, c.reason, c.genres.join('/'), !!c.poster, !!c.backdrop]);
    } catch (e) {
      report.recommend[type + '/' + era] = { error: String(e) };
    }
  }
}
fs.writeFileSync('catalog-report.json', JSON.stringify(report, null, 1));
fs.writeFileSync('catalog-calls.json', JSON.stringify(calls));
console.log('calls', calls.length, 'report bytes', JSON.stringify(report).length);
