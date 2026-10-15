import { describe, expect, it, vi } from 'vitest';
vi.mock('electron', () => ({ net: { fetch: () => { throw new Error('no network in tests'); } } }));
import { classify, cleanTitle, searchTitles, setLookupFetcher, titleDetails } from '../../electron/lookup';

describe('classifying Wikipedia descriptions', () => {
  it.each([
    ['2024 film by Denis Villeneuve', 'movie'],
    ['2014 epic science fiction film directed by Christopher Nolan', 'movie'],
    ['American television series', 'show'],
    ['2008 American crime drama television series', 'show'],
    ['Japanese anime television series', 'show'],
    ['British miniseries', 'show'],
    ['2022 video game', 'game'],
    ['2018 action-adventure game', 'game'],
    ['American game show', 'show'],
    ['1965 novel by Frank Herbert', null],
    ['fictional character', null],
  ])('%s', (d, t) => expect(classify(d)).toBe(t));
  it('cleans disambiguation from titles', () => {
    expect(cleanTitle('Dune (2021 film)')).toBe('Dune');
    expect(cleanTitle('The Office (American TV series)')).toBe('The Office');
    expect(cleanTitle('God of War Ragnarök')).toBe('God of War Ragnarök');
  });
});

describe('looking up a title', () => {
  it('turns Wikipedia and Wikidata responses into filled-in details', async () => {
    const calls: string[] = [];
    setLookupFetcher(async (url) => {
      calls.push(url);
      if (url.includes('en.wikipedia.org')) {
        return {
          query: {
            pages: [
              { pageid: 2, index: 2, title: 'Dune (novel)', description: '1965 novel by Frank Herbert' },
              {
                pageid: 1, index: 1, title: 'Dune: Part Two', description: '2024 film by Denis Villeneuve',
                pageprops: { wikibase_item: 'Q100' },
                thumbnail: { source: 'https://upload.wikimedia.org/thumb.jpg' }, original: { source: 'https://upload.wikimedia.org/full.jpg' },
                extract: 'Dune: Part Two is a 2024 American epic science fiction film directed by Denis Villeneuve.',
              },
            ],
          },
        };
      }
      if (url.includes('props=claims')) {
        const v = (id: string) => ({ mainsnak: { datavalue: { value: { id } } }, rank: 'normal' });
        return { entities: { Q100: { claims: { P57: [v('Q1')], P272: [v('Q2')], P161: [v('Q3'), v('Q4')], P577: [{ mainsnak: { datavalue: { value: { time: '+2024-02-27T00:00:00Z' } } } }] } } } };
      }
      return { entities: { Q1: { labels: { en: { value: 'Denis Villeneuve' } } }, Q2: { labels: { en: { value: 'Legendary Pictures' } } }, Q3: { labels: { en: { value: 'Timothée Chalamet' } } }, Q4: { labels: { en: { value: 'Zendaya' } } } } };
    });
    const found = await searchTitles('dune part two', 'movie');
    expect(found).toHaveLength(1);
    expect(found[0].title).toBe('Dune: Part Two');
    expect(found[0].year).toBe('2024');
    const det = await titleDetails(found[0]);
    expect(det.director).toBe('Denis Villeneuve');
    expect(det.studio).toBe('Legendary Pictures');
    expect(det.cast).toBe('Timothée Chalamet, Zendaya');
    expect(det.year).toBe('2024');
    expect(det.image).toBe('https://upload.wikimedia.org/full.jpg');
    expect(calls[0]).toMatch(/pilicense=any/);
    setLookupFetcher(null);
  });
  it('returns nothing rather than failing when offline', async () => {
    setLookupFetcher(async () => {
      throw new Error('offline');
    });
    expect(await searchTitles('anything', null)).toEqual([]);
    setLookupFetcher(null);
  });
});
