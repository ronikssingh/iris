import { describe, expect, it } from 'vitest';
import {
  CLASSES,
  classOf,
  critiqueFromDraft,
  emptyDraftData,
  fromLegacyCritique,
  mergeLibraries,
  emptyLibrary,
  missingRequired,
  normalizeCritique,
  normalizeLibrary,
  ratingOf,
  suggestClass,
  totalOf,
  SCORE_KEYS,
} from '../../src/shared/model';

const allScores = (v: number) => Object.fromEntries(SCORE_KEYS.map((k) => [k, v])) as any;

describe('classes', () => {
  it('uses the thresholds Ronik set', () => {
    expect(suggestClass(1000)).toBe('masterpiece');
    expect(suggestClass(960)).toBe('masterpiece');
    expect(suggestClass(959)).toBe('perfect');
    expect(suggestClass(900)).toBe('perfect');
    expect(suggestClass(899)).toBe('great');
    expect(suggestClass(800)).toBe('great');
    expect(suggestClass(799)).toBe('good');
    expect(suggestClass(650)).toBe('good');
    expect(suggestClass(649)).toBe('average');
    expect(suggestClass(500)).toBe('average');
    expect(suggestClass(499)).toBe('below');
    expect(suggestClass(300)).toBe('below');
    expect(suggestClass(299)).toBe('terrible');
    expect(suggestClass(0)).toBe('terrible');
  });
  it('covers 0..1000 with no gaps or overlaps', () => {
    for (let n = 0; n <= 1000; n++) {
      const hits = CLASSES.filter((c) => n >= c.min && n <= c.max);
      expect(hits.length, `rating ${n}`).toBe(1);
      expect(hits[0].key).toBe(suggestClass(n));
    }
  });
  it('lets an override win over the suggestion', () => {
    const c = normalizeCritique({ title: 'X', type: 'movie', scores: allScores(97), classOverride: 'good' });
    expect(ratingOf(c)).toBe(970);
    expect(classOf(c)).toBe('good');
  });
});

describe('ratings', () => {
  it('adds the ten scores out of 1000', () => {
    expect(totalOf(allScores(100))).toBe(1000);
    expect(totalOf({ story: 50, acting: null as any })).toBe(50);
  });
  it('clamps and rounds bad scores', () => {
    const c = normalizeCritique({ title: 'X', scores: { story: 140, acting: -5, visuals: '71.6' } });
    expect(c.scores.story).toBe(100);
    expect(c.scores.acting).toBe(0);
    expect(c.scores.visuals).toBe(72);
  });
});

describe('saving a draft', () => {
  it('needs a title, a type and all ten scores', () => {
    const d = emptyDraftData();
    expect(missingRequired(d).map((m) => m.field)).toEqual(['title', 'type', ...SCORE_KEYS]);
    d.title = 'Interstellar';
    d.type = 'movie';
    for (const k of SCORE_KEYS) d.scores[k] = 90;
    expect(missingRequired(d)).toEqual([]);
    const c = critiqueFromDraft(d, 'c1', 123);
    expect(ratingOf(c)).toBe(900);
    expect(classOf(c)).toBe('perfect');
    expect(c.createdAt).toBe(123);
  });
  it('refuses an incomplete draft', () => {
    const d = emptyDraftData();
    d.title = 'Half done';
    d.type = 'show';
    d.scores.story = 80;
    expect(() => critiqueFromDraft(d, 'c2', 1)).toThrow(/Missing/);
  });
  it('treats a score of zero as filled in', () => {
    const d = emptyDraftData();
    d.title = 'Awful';
    d.type = 'game';
    for (const k of SCORE_KEYS) d.scores[k] = 0;
    expect(missingRequired(d)).toEqual([]);
    expect(classOf(critiqueFromDraft(d, 'c3', 1))).toBe('terrible');
  });
});

describe('old Marquee data', () => {
  it('maps the old fields, including a manual class and Maybe recommendations', () => {
    const { critique, posterDataUrl } = fromLegacyCritique({
      id: 'cmu7sbr3p9d18lh',
      title: 'The Odyssey',
      type: 'movie',
      director: 'Christopher Nolan',
      scores: { story: 92, screenplay: 95, characters: 98, acting: 91, visuals: 100, soundtrack: 100, production: 100, vision: 100, pacing: 98, enjoyment: 100 },
      cls: 'masterpiece',
      clsManual: false,
      recommend: 'maybe',
      poster: 'data:image/jpeg;base64,AAAA',
    });
    expect(critique.id).toBe('cmu7sbr3p9d18lh');
    expect(ratingOf(critique)).toBe(974);
    expect(critique.classOverride).toBeNull();
    expect(critique.recommend).toBeNull();
    expect(posterDataUrl).toMatch(/^data:image\/jpeg/);
    const manual = fromLegacyCritique({ title: 'Y', scores: allScores(50), cls: 'great', clsManual: true }).critique;
    expect(manual.classOverride).toBe('great');
  });
});

describe('merging libraries', () => {
  it('adds new items, updates newer ones and never duplicates', () => {
    const a = emptyLibrary();
    a.critiques.push(normalizeCritique({ id: 'c1', title: 'One', scores: allScores(50), updatedAt: 100, createdAt: 100 }));
    const b = emptyLibrary();
    b.critiques.push(normalizeCritique({ id: 'c1', title: 'One', scores: allScores(60), updatedAt: 200, createdAt: 100 }));
    b.critiques.push(normalizeCritique({ id: 'c2', title: 'Two', scores: allScores(70), updatedAt: 200, createdAt: 100 }));
    b.critiques.push(normalizeCritique({ id: 'zz', title: 'one', type: 'movie', scores: allScores(10), updatedAt: 50, createdAt: 50 }));
    const { lib, added, updated } = mergeLibraries(a, b);
    expect(lib.critiques.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
    expect(lib.critiques.find((c) => c.id === 'c1')!.scores.story).toBe(60);
    expect(added).toBe(1);
    expect(updated).toBe(1);
  });
  it('survives junk input', () => {
    const lib = normalizeLibrary({ critiques: [null, 5, { title: '' }, { title: 'Ok', scores: {} }], watchlist: 'nope', trash: [{ kind: 'x' }] });
    expect(lib.critiques).toHaveLength(1);
    expect(lib.watchlist).toEqual([]);
    expect(lib.trash).toEqual([]);
  });
});
