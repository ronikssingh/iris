// Runs on GitHub's build machines, where the keys are available as secrets. It talks to the real
// TMDB, IGDB and Supabase services with the app's own code and reports what came back, without ever
// printing a key. Locally it just reports that the keys aren't set.
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const report = [];
const note = (title, text) => {
  report.push(`${title}: ${text}`);
  console.log(`== ${title}\n${text}\n`);
};

const env = process.env;
note(
  'Keys',
  ['TMDB_TOKEN', 'IGDB_CLIENT_ID', 'IGDB_CLIENT_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']
    .map((k) => `${k}=${env[k] ? `set (${env[k].trim().length} chars${env[k] !== env[k].trim() ? ', has spaces around it' : ''})` : 'missing'}`)
    .join(', '),
);

const alts = Object.keys(env)
  .filter((k) => k.startsWith('ALT_') && env[k])
  .map((k) => `${k.replace(/^ALT_/, '').replace(/^VAR_/, 'variable ').replace(/^SECRET_/, 'secret ')} (${env[k].trim().length} chars${/^eyJ/.test(env[k].trim()) ? ', starts like a read access token' : /^[0-9a-f]{32}$/i.test(env[k].trim()) ? ', looks like an API key' : ''})`);
note('Keys found under other names', alts.length ? alts.join('; ') : 'none');
if (env.TMDB_TOKEN) {
  const v = env.TMDB_TOKEN.trim();
  note('TMDB key shape', /^eyJ/.test(v) ? 'read access token' : /^[0-9a-f]{32}$/i.test(v) ? 'v3 API key' : 'unrecognised');
}

// Build the app's catalogue module for plain Node, swapping Electron's network stack for fetch.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-live-'));
const shim = path.join(tmp, 'electron-shim.mjs');
fs.writeFileSync(shim, 'export const net = { fetch: (...a) => fetch(...a) }; export default { net };');
const out = path.join(tmp, 'catalog.mjs');
await build({
  entryPoints: ['electron/catalog.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  alias: { electron: shim },
  logLevel: 'warning',
  define: {
    __IRIS_KEYS__: JSON.stringify({ tmdb: (env.TMDB_TOKEN || '').trim(), igdbId: (env.IGDB_CLIENT_ID || '').trim(), igdbSecret: (env.IGDB_CLIENT_SECRET || '').trim() }),
  },
});
const cat = await import(out);
let calls = 0;
cat.setCatalogHttp(async (url, init) => {
  calls++;
  const res = await fetch(url, { method: init?.method ?? 'GET', headers: { 'User-Agent': 'Iris live check', ...(init?.headers ?? {}) }, body: init?.body });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}: ${text.slice(0, 160)}`);
  return JSON.parse(text);
});

const st = cat.catalogStatus();
note('Catalogue keys seen by the app', JSON.stringify(st));

const summarize = (d) =>
  `${d.title} (${d.year || '?'}) | type ${d.type} | director ${d.director || '-'} | studio ${d.studio || '-'} | cast ${d.cast ? d.cast.split(', ').length : 0} | genres ${(d.genres || []).join('/') || '-'} | poster ${d.image ? 'yes' : 'no'} | description ${d.description ? d.description.length + ' chars' : 'none'}`;

async function lookup(q, type) {
  try {
    const hits = await cat.searchTitles(q, type);
    if (!hits.length) return note(`Search "${q}" (${type ?? 'any'})`, 'no results');
    const list = hits.slice(0, 5).map((h) => `${h.title} [${h.source ?? 'wiki'} ${h.type ?? '?'} ${h.year || '?'} votes ${h.popularity ?? '-'}]`).join('; ');
    const d = await cat.titleDetails(hits[0]);
    note(`Search "${q}" (${type ?? 'any'})`, `${list}\nfirst result details: ${summarize(d)}`);
  } catch (e) {
    note(`Search "${q}" (${type ?? 'any'})`, 'FAILED ' + e.message);
  }
}

if (st.tmdb) {
  await lookup('Dune Part Two', 'movie');
  await lookup('Breaking Bad', 'show');
}
if (st.igdb) {
  await lookup('Elden Ring', 'game');
  await lookup('God of War Ragnarok', 'game');
}
if (st.tmdb && st.igdb) await lookup('The Last of Us', null);

async function recs(type, seeds, era = 'all') {
  try {
    const cards = await cat.recommend({ type, seeds, friends: [], exclude: [], excludeTitles: seeds.map((s) => s.title), era, page: 1 });
    const old = cards.filter((c) => c.year && Number(c.year) < 2000);
    note(
      `For You ${type} (${era})`,
      `${cards.length} cards; ${old.length} from before 2000\n` +
        cards
          .slice(0, 12)
          .map((c) => `${c.title} (${c.year}) votes ${c.votes} | ${c.reason}`)
          .join('\n') +
        (old.length ? '\nolder ones: ' + old.map((c) => `${c.title} (${c.year}, ${c.votes} votes)`).join('; ') : ''),
    );
  } catch (e) {
    note(`For You ${type}`, 'FAILED ' + e.message);
  }
}
if (st.tmdb) {
  await recs('movie', [{ title: 'Dune: Part Two', type: 'movie', rating: 950, year: '2024', ext: null }, { title: 'The Dark Knight', type: 'movie', rating: 930, year: '2008', ext: null }]);
  await recs('show', [{ title: 'Breaking Bad', type: 'show', rating: 912, year: '2008', ext: null }]);
}
if (st.igdb) await recs('game', [{ title: 'God of War Ragnarök', type: 'game', rating: 948, year: '2022', ext: null }]);
note('Catalogue requests made', String(calls));

// Supabase: is the project reachable, is sign-up set up the way the app expects, and has setup.sql been run?
const sbUrl = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const sbKey = (env.SUPABASE_ANON_KEY || '').trim();
if (sbUrl && sbKey) {
  const h = { apikey: sbKey, Accept: 'application/json' };
  try {
    const r = await fetch(`${sbUrl}/auth/v1/settings`, { headers: h });
    const s = await r.json().catch(() => ({}));
    note(
      'Supabase sign-in settings',
      r.ok
        ? `email sign-in ${s.external?.email ? 'on' : 'off'}; sign-ups ${s.disable_signup ? 'disabled' : 'allowed'}; email confirmation ${s.mailer_autoconfirm ? 'off (instant sign-up)' : 'on'}`
        : `HTTP ${r.status} ${JSON.stringify(s).slice(0, 200)}`,
    );
  } catch (e) {
    note('Supabase sign-in settings', 'FAILED ' + e.message);
  }
  const tables = ['profiles', 'friendships', 'critiques', 'likes', 'comments', 'suggestions'];
  const found = [];
  const missing = [];
  for (const t of tables) {
    try {
      const r = await fetch(`${sbUrl}/rest/v1/${t}?select=*&limit=1`, { headers: h });
      const body = await r.text();
      if (r.ok) found.push(t);
      else missing.push(`${t} (HTTP ${r.status} ${body.slice(0, 120)})`);
    } catch (e) {
      missing.push(`${t} (${e.message})`);
    }
  }
  note('Supabase tables', `present: ${found.join(', ') || 'none'}${missing.length ? `\nnot usable: ${missing.join('; ')}` : ''}`);
  for (const b of ['avatars', 'posters']) {
    try {
      const r = await fetch(`${sbUrl}/storage/v1/object/public/${b}/iris-live-check-missing.jpg`, { headers: h });
      const body = await r.text();
      note(`Supabase storage "${b}"`, /bucket not found/i.test(body) ? 'bucket missing' : `bucket present (lookup of a missing file answered HTTP ${r.status})`);
    } catch (e) {
      note(`Supabase storage "${b}"`, 'FAILED ' + e.message);
    }
  }
}

fs.writeFileSync('live-check.txt', report.join('\n\n'));
// GitHub keeps only a handful of annotations per step, so the sections are packed into a few of them.
if (env.GITHUB_ACTIONS) {
  const per = Math.ceil(report.length / 8);
  for (let i = 0; i < report.length; i += per) {
    const msg = report
      .slice(i, i + per)
      .join('\n\n')
      .replace(/%/g, '%25')
      .replace(/\r/g, '%0D')
      .replace(/\n/g, '%0A');
    console.log(`::notice title=Live check ${i / per + 1}::${msg}`);
  }
}
