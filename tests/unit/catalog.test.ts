import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

// Real answers from TMDB and IGDB, recorded once by the service probe (no keys inside), replayed here.
const fx = JSON.parse(fs.readFileSync('tests/fixtures/catalog-recorded.json', 'utf8'));
let cat: typeof import('../../electron/catalog');

beforeAll(async () => {
  process.env.TMDB_TOKEN = 'test-token';
  process.env.IGDB_CLIENT_ID = 'test-id';
  process.env.IGDB_CLIENT_SECRET = 'test-secret';
  cat = await import('../../electron/catalog');
  cat.setCatalogHttp(async (url, init) => {
    const u = new URL(url);
    if (u.hostname === 'id.twitch.tv') return { access_token: 'test', expires_in: 3600, token_type: 'bearer' };
    if (u.hostname === 'api.themoviedb.org') {
      expect(init?.headers?.Authorization).toBe('Bearer test-token');
      const path = u.pathname.replace(/^\/3/, '');
      const q = u.searchParams.get('query');
      const hit = fx.tmdb[path + (q ? '?' + q : '')];
      if (hit) return hit;
      if (q) return { page: 1, results: [] };
      throw new Error('HTTP 404');
    }
    if (u.hostname === 'api.igdb.com') {
      expect(init?.headers?.['Client-ID']).toBe('test-id');
      const body = init?.body ?? '';
      const term = /search "([^"]*)"/.exec(body);
      if (term) return fx.igdb_search[term[1]] ?? [];
      const id = /where id = (\d+);/.exec(body);
      return id ? (fx.igdb_id[id[1]] ?? []) : [];
    }
    throw new Error('unexpected request ' + url);
  });
});

describe('catalogue matching', () => {
  it('compares titles without accents, case or punctuation', () => {
    expect(cat.fold('Shōgun')).toBe('shogun');
    expect(cat.titleMatch('pokemon', 'Pokémon')).toBe(1);
    expect(cat.titleMatch('the batman', 'Batman')).toBe(1);
    expect(cat.titleMatch('dune', 'Dune: Part Two')).toBeGreaterThan(0.8);
    expect(cat.titleMatch('spider-man', "Marvel's Spider-Man")).toBeGreaterThan(0.7);
    expect(cat.titleMatch('dune', 'Oppenheimer')).toBe(0);
  });

  it('reads a release year typed after the title, but not one that is part of it', () => {
    expect(cat.trailingYear('Dune 1984')).toEqual({ title: 'Dune', year: '1984' });
    expect(cat.trailingYear('Dune (2021)')).toEqual({ title: 'Dune', year: '2021' });
    expect(cat.trailingYear('Cyberpunk 2077')).toBeNull();
    expect(cat.trailingYear('1917')).toBeNull();
  });
});

describe('catalogue search with real answers', () => {
  it('puts the famous one first when the name is shared', async () => {
    const r = await cat.searchTitles('Shogun', null);
    expect(r[0].title).toBe('Shōgun');
    expect(r[0].year).toBe('2024');
    expect(r[0].type).toBe('show');
  });

  it('finds the game everyone means', async () => {
    const r = await cat.searchTitles('spider-man', 'game');
    expect(r[0].title).toBe("Marvel's Spider-Man");
    expect(r[0].image).toMatch(/^https:\/\/images\.igdb\.com\//);
  });

  it('prefers the film over an obscure game of the same name', async () => {
    const r = await cat.searchTitles('Interstellar', null);
    expect(r[0]).toMatchObject({ title: 'Interstellar', year: '2014', type: 'movie', source: 'tmdb' });
  });

  it('honours a year typed after the title', async () => {
    const r = await cat.searchTitles('Dune 1984', 'movie');
    expect(r[0]).toMatchObject({ title: 'Dune', year: '1984' });
  });

  it('keeps fan projects with no cover or ratings out of game results', async () => {
    const r = await cat.searchTitles('Pokemon', 'game');
    expect(r.length).toBeGreaterThan(0);
    for (const c of r) expect(c.popularity ?? 0).toBeGreaterThan(0);
  });

  it('fills a film: director, studio, cast, year, description and a large poster', async () => {
    const r = await cat.searchTitles('Interstellar', 'movie');
    const d = await cat.titleDetails(r[0]);
    expect(d.director).toContain('Christopher Nolan');
    expect(d.cast).toContain('Matthew McConaughey');
    expect(d.studio.length).toBeGreaterThan(2);
    expect(d.year).toBe('2014');
    expect(d.description.length).toBeGreaterThan(40);
    expect(d.image).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\/w780\//);
    expect(d.ext).toEqual({ source: 'tmdb', kind: 'movie', id: '157336' });
  });

  it('fills a series with its creators', async () => {
    const r = await cat.searchTitles('Breaking Bad', 'show');
    const d = await cat.titleDetails(r[0]);
    expect(d.director).toContain('Vince Gilligan');
    expect(d.year).toBe('2008');
    expect(d.cast).toContain('Bryan Cranston');
  });

  it('fills a game with its developer', async () => {
    const r = await cat.searchTitles('God of War Ragnarok', 'game');
    expect(r[0].title).toBe('God of War Ragnarök');
    const d = await cat.titleDetails(r[0]);
    expect(d.studio).toContain('Santa Monica Studio');
    expect(d.year).toBe('2022');
    expect(d.genres?.length).toBeGreaterThan(0);
  });
});
