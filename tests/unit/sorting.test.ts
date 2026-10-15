import { describe, expect, it } from 'vitest';
import { comparator, groupCritiques, matches, EMPTY_FILTERS } from '../../src/lib/sorting';
import { normalizeCritique, SCORE_KEYS } from '../../src/shared/model';

const mk = (title: string, type: string, base: number, extra: any = {}) =>
  normalizeCritique({ id: title, title, type, scores: Object.fromEntries(SCORE_KEYS.map((k) => [k, base])), ...extra });

const list = [mk('B Movie', 'movie', 50), mk('A Game', 'game', 90), mk('The Show', 'show', 70), mk('Zed', 'movie', 97), mk('An Apple', 'movie', 97, { scores: { ...Object.fromEntries(SCORE_KEYS.map((k) => [k, 97])), enjoyment: 60 } })];

describe('sorting', () => {
  it('defaults to type first, then rating', () => {
    const groups = groupCritiques(list, 'type', [{ key: 'type', dir: 'asc' }, { key: 'rating', dir: 'desc' }]);
    expect(groups.map((g) => g.key)).toEqual(['movie', 'show', 'game']);
    expect(groups[0].items.map((c) => c.title)).toEqual(['Zed', 'An Apple', 'B Movie']);
  });
  it('sorts by several levels', () => {
    const sorted = [...list].sort(comparator([{ key: 'rating', dir: 'desc' }, { key: 'enjoyment', dir: 'desc' }]));
    expect(sorted.map((c) => c.title).slice(0, 2)).toEqual(['Zed', 'An Apple']);
  });
  it('ignores "The" and "A" when sorting titles', () => {
    const sorted = [...list].sort(comparator([{ key: 'title', dir: 'asc' }]));
    expect(sorted.map((c) => c.title)).toEqual(['An Apple', 'B Movie', 'A Game', 'The Show', 'Zed'].sort((a, b) => a.replace(/^(the|a|an)\s+/i, '').localeCompare(b.replace(/^(the|a|an)\s+/i, ''))));
  });
  it('groups by class from best to worst', () => {
    const groups = groupCritiques(list, 'class', [{ key: 'rating', dir: 'desc' }]);
    expect(groups[0].key).toBe('masterpiece');
    expect(groups[groups.length - 1].key).toBe('average');
  });
});

describe('filters', () => {
  it('matches text across fields and filters by class and score', () => {
    expect(list.filter((c) => matches(c, { ...EMPTY_FILTERS, q: 'zed' })).map((c) => c.title)).toEqual(['Zed']);
    expect(list.filter((c) => matches(c, { ...EMPTY_FILTERS, classes: ['masterpiece'] })).map((c) => c.title)).toEqual(['Zed']);
    expect(list.filter((c) => matches(c, { ...EMPTY_FILTERS, scoreMins: { enjoyment: 80 } })).map((c) => c.title).sort()).toEqual(['A Game', 'Zed']);
    expect(list.filter((c) => matches(c, { ...EMPTY_FILTERS, rating: [600, 800] })).map((c) => c.title)).toEqual(['The Show']);
  });
});
