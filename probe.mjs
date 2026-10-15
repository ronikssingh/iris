// Checks the real services Iris talks to. Prints a JSON report with no secrets in it.
const env = process.env;
const out = { at: new Date().toISOString(), keys: {}, tmdb: {}, igdb: {}, supabase: {} };
for (const k of ['TMDB_TOKEN', 'IGDB_CLIENT_ID', 'IGDB_CLIENT_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
  const v = env[k] || '';
  out.keys[k] = v ? { len: v.length, prefix: k === 'SUPABASE_URL' ? v : v.slice(0, k === 'SUPABASE_ANON_KEY' ? 15 : 3) + '…', looksLikeJwt: v.split('.').length === 3 } : 'missing';
}
async function get(url, init = {}) {
  try {
    const r = await fetch(url, init);
    const text = await r.text();
    let body = text;
    try { body = JSON.parse(text); } catch {}
    return { status: r.status, body };
  } catch (e) {
    return { status: 0, error: String(e) };
  }
}
const trim = (v, n = 600) => (typeof v === 'string' ? v.slice(0, n) : v);

// TMDB
if (env.TMDB_TOKEN) {
  const isV4 = env.TMDB_TOKEN.split('.').length === 3;
  const auth = isV4 ? { headers: { Authorization: 'Bearer ' + env.TMDB_TOKEN, Accept: 'application/json' } } : {};
  const q = (path, params = '') => `https://api.themoviedb.org/3${path}?${isV4 ? '' : 'api_key=' + env.TMDB_TOKEN + '&'}${params}`;
  out.tmdb.tokenKind = isV4 ? 'v4 read token' : 'v3 api key';
  const conf = await get(q('/configuration'), auth);
  out.tmdb.configuration = { status: conf.status, images: conf.body?.images ? { base: conf.body.images.secure_base_url, poster_sizes: conf.body.images.poster_sizes, backdrop_sizes: conf.body.images.backdrop_sizes } : trim(JSON.stringify(conf.body)) };
  const s = await get(q('/search/movie', 'query=Dune%20Part%20Two&include_adult=false'), auth);
  out.tmdb.search = { status: s.status, first: s.body?.results?.[0] ? Object.fromEntries(Object.entries(s.body.results[0]).map(([k, v]) => [k, trim(v, 120)])) : trim(JSON.stringify(s.body)) };
  const m = await get(q('/movie/693134', 'append_to_response=credits,release_dates'), auth);
  out.tmdb.movie = { status: m.status, keys: m.body ? Object.keys(m.body) : null, directors: m.body?.credits?.crew?.filter((c) => c.job === 'Director').map((c) => c.name), companies: m.body?.production_companies?.map((c) => c.name), cast: m.body?.credits?.cast?.slice(0, 5).map((c) => c.name), runtime: m.body?.runtime, genres: m.body?.genres, vote_count: m.body?.vote_count };
  const tv = await get(q('/tv/1399', 'append_to_response=aggregate_credits'), auth);
  out.tmdb.tv = { status: tv.status, created_by: tv.body?.created_by?.map((c) => c.name), companies: tv.body?.production_companies?.map((c) => c.name), networks: tv.body?.networks?.map((c) => c.name), cast: tv.body?.aggregate_credits?.cast?.slice(0, 5).map((c) => c.name), vote_count: tv.body?.vote_count };
  const rec = await get(q('/movie/693134/recommendations', 'page=1'), auth);
  out.tmdb.recommendations = { status: rec.status, count: rec.body?.results?.length, sample: rec.body?.results?.slice(0, 5).map((r) => [r.title, r.vote_count, r.release_date]) };
  const disc = await get(q('/discover/movie', 'sort_by=vote_count.desc&vote_count.gte=2500&page=1'), auth);
  out.tmdb.discover = { status: disc.status, total: disc.body?.total_results, sample: disc.body?.results?.slice(0, 5).map((r) => [r.title, r.vote_count]) };
  const tr = await get(q('/trending/all/week'), auth);
  out.tmdb.trending = { status: tr.status, sample: tr.body?.results?.slice(0, 5).map((r) => [r.title ?? r.name, r.media_type, r.vote_count]) };
}
// IGDB
if (env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET) {
  const tok = await get(`https://id.twitch.tv/oauth2/token?client_id=${env.IGDB_CLIENT_ID}&client_secret=${env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
  out.igdb.token = { status: tok.status, expires_in: tok.body?.expires_in, token_type: tok.body?.token_type, error: tok.body?.message };
  if (tok.body?.access_token) {
    const h = { 'Client-ID': env.IGDB_CLIENT_ID, Authorization: 'Bearer ' + tok.body.access_token, 'Content-Type': 'text/plain' };
    const g = await get('https://api.igdb.com/v4/games', { method: 'POST', headers: h, body: 'search "God of War Ragnarok"; fields name,first_release_date,cover.image_id,summary,genres.name,themes.name,total_rating,total_rating_count,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,version_parent,parent_game,game_type,category; limit 5;' });
    out.igdb.search = { status: g.status, results: Array.isArray(g.body) ? g.body.map((x) => ({ ...x, summary: trim(x.summary, 80) })) : trim(JSON.stringify(g.body)) };
    const p = await get('https://api.igdb.com/v4/games', { method: 'POST', headers: h, body: 'fields name,total_rating_count,first_release_date; where total_rating_count > 400 & cover != null; sort total_rating_count desc; limit 10;' });
    out.igdb.popular = { status: p.status, results: Array.isArray(p.body) ? p.body.map((x) => [x.name, x.total_rating_count]) : trim(JSON.stringify(p.body)) };
    const sim = await get('https://api.igdb.com/v4/games', { method: 'POST', headers: h, body: 'fields name,similar_games.name,similar_games.total_rating_count; where id = 112875;' });
    out.igdb.similar = { status: sim.status, body: trim(JSON.stringify(sim.body), 1500) };
  }
}
// Supabase
const SB = 'https://agxckwvbedmrhzutmzpt.supabase.co';
out.supabase.secretUrlMatches = env.SUPABASE_URL === SB || env.SUPABASE_URL === SB + '/';
if (env.SUPABASE_ANON_KEY) {
  const h = { apikey: env.SUPABASE_ANON_KEY };
  const hb = env.SUPABASE_ANON_KEY.split('.').length === 3 ? { ...h, Authorization: 'Bearer ' + env.SUPABASE_ANON_KEY } : h;
  const st = await get(SB + '/auth/v1/settings', { headers: h });
  out.supabase.authSettings = { status: st.status, body: st.body };
  const root = await get(SB + '/rest/v1/', { headers: { ...hb, Accept: 'application/openapi+json' } });
  out.supabase.restRoot = { status: root.status, paths: root.body?.paths ? Object.keys(root.body.paths) : trim(JSON.stringify(root.body)) };
  for (const t of ['profiles', 'friendships', 'critiques', 'likes', 'comments', 'suggestions']) {
    const r = await get(SB + `/rest/v1/${t}?select=*&limit=1`, { headers: hb });
    out.supabase['table_' + t] = { status: r.status, body: trim(JSON.stringify(r.body), 300) };
  }
  for (const b of ['avatars', 'posters']) {
    const r = await get(SB + `/storage/v1/object/public/${b}/probe-does-not-exist.jpg`, { headers: h });
    out.supabase['bucket_' + b] = { status: r.status, body: trim(JSON.stringify(r.body), 300) };
  }
  const health = await get(SB + '/auth/v1/health', { headers: h });
  out.supabase.authHealth = { status: health.status, body: health.body };
}
console.log(JSON.stringify(out, null, 2));
