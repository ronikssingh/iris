import {
  CLASSES,
  CLASS_BY_KEY,
  SCORES,
  TYPES,
  TYPE_PLURAL,
  classOf,
  ratingOf,
  type ClassKey,
  type Critique,
  type MediaType,
  type ScoreKey,
} from '../shared/model';
import type { GroupBy, SortKeyId, SortRule } from '../shared/settings';

export interface Filters {
  q: string;
  types: MediaType[];
  classes: ClassKey[];
  recommend: 'any' | 'yes' | 'no' | 'unset';
  rating: [number, number];
  scoreMins: Partial<Record<ScoreKey, number>>;
}

export const EMPTY_FILTERS: Filters = { q: '', types: [], classes: [], recommend: 'any', rating: [0, 1000], scoreMins: {} };

export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.classes.length) n++;
  if (f.recommend !== 'any') n++;
  if (f.rating[0] > 0 || f.rating[1] < 1000) n++;
  n += Object.values(f.scoreMins).filter((v) => (v ?? 0) > 0).length;
  return n;
}

export const SORT_LABELS: Record<SortKeyId, string> = {
  type: 'Type',
  rating: 'Rating',
  enjoyment: 'Personal enjoyment',
  class: 'Class',
  title: 'Title',
  added: 'Date added',
  updated: 'Last edited',
  year: 'Release year',
  recommend: 'Recommended',
  director: 'Director',
  studio: 'Studio',
  story: 'Story',
  screenplay: 'Screenplay and dialogue',
  characters: 'Characters',
  acting: 'Acting',
  visuals: 'Cinematography and visuals',
  soundtrack: 'Score and soundtrack',
  production: 'Production and design',
  vision: 'Vision, themes and tone',
  pacing: 'Rhythm and pacing',
};

/** Words for each direction, so "Rating: highest first" reads naturally. */
export function dirLabel(key: SortKeyId, dir: 'asc' | 'desc'): string {
  if (key === 'title' || key === 'director' || key === 'studio') return dir === 'asc' ? 'A to Z' : 'Z to A';
  if (key === 'type') return dir === 'asc' ? 'Movies, shows, games' : 'Games, shows, movies';
  if (key === 'added' || key === 'updated') return dir === 'desc' ? 'Newest first' : 'Oldest first';
  if (key === 'year') return dir === 'desc' ? 'Newest first' : 'Oldest first';
  if (key === 'recommend') return dir === 'desc' ? 'Yes first' : 'No first';
  return dir === 'desc' ? 'Highest first' : 'Lowest first';
}

const titleKey = (t: string) => t.replace(/^(the|a|an)\s+/i, '').toLocaleLowerCase();

function value(c: Critique, key: SortKeyId): number | string {
  switch (key) {
    case 'type':
      return TYPES.indexOf(c.type);
    case 'rating':
      return ratingOf(c);
    case 'enjoyment':
      return c.scores.enjoyment;
    case 'class':
      return CLASS_BY_KEY[classOf(c)].rank;
    case 'title':
      return titleKey(c.title);
    case 'added':
      return c.createdAt;
    case 'updated':
      return c.updatedAt;
    case 'year':
      return parseInt(c.year, 10) || 0;
    case 'recommend':
      return c.recommend === 'yes' ? 2 : c.recommend === 'no' ? 0 : 1;
    case 'director':
      return c.director.trim().toLocaleLowerCase();
    case 'studio':
      return c.studio.trim().toLocaleLowerCase();
    default:
      return c.scores[key as ScoreKey] ?? 0;
  }
}

export function comparator(rules: SortRule[]) {
  return (a: Critique, b: Critique) => {
    for (const r of rules) {
      const va = value(a, r.key);
      const vb = value(b, r.key);
      let d = 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        // empty text always sorts last
        if (!va && vb) return 1;
        if (va && !vb) return -1;
        d = va.localeCompare(vb);
      } else d = (va as number) - (vb as number);
      if (d !== 0) return r.dir === 'asc' ? d : -d;
    }
    return titleKey(a.title).localeCompare(titleKey(b.title));
  };
}

export function matches(c: Critique, f: Filters): boolean {
  if (f.types.length && !f.types.includes(c.type)) return false;
  if (f.classes.length && !f.classes.includes(classOf(c))) return false;
  if (f.recommend === 'yes' && c.recommend !== 'yes') return false;
  if (f.recommend === 'no' && c.recommend !== 'no') return false;
  if (f.recommend === 'unset' && c.recommend !== null) return false;
  const r = ratingOf(c);
  if (r < f.rating[0] || r > f.rating[1]) return false;
  for (const s of SCORES) {
    const min = f.scoreMins[s.key];
    if (min && c.scores[s.key] < min) return false;
  }
  const q = f.q.trim().toLocaleLowerCase();
  if (q) {
    const hay = [c.title, c.director, c.studio, c.cast, c.description, c.comments, c.finalRemarks, c.year]
      .join(' \u0001 ')
      .toLocaleLowerCase();
    for (const word of q.split(/\s+/)) if (!hay.includes(word)) return false;
  }
  return true;
}

export interface Group {
  key: string;
  label: string;
  items: Critique[];
}

export function groupCritiques(list: Critique[], groupBy: GroupBy, rules: SortRule[]): Group[] {
  const effective = rules.filter((r) => !(groupBy === 'type' && r.key === 'type') && !(groupBy === 'class' && r.key === 'class'));
  const cmp = comparator(effective.length ? effective : [{ key: 'rating', dir: 'desc' }]);
  const sorted = [...list].sort(cmp);
  if (groupBy === 'none') return [{ key: 'all', label: 'All critiques', items: sorted }];
  if (groupBy === 'type') {
    const typeRule = rules.find((r) => r.key === 'type');
    const order = typeRule?.dir === 'desc' ? [...TYPES].reverse() : TYPES;
    return order
      .map((t) => ({ key: t, label: TYPE_PLURAL[t], items: sorted.filter((c) => c.type === t) }))
      .filter((g) => g.items.length);
  }
  if (groupBy === 'class') {
    const classRule = rules.find((r) => r.key === 'class');
    const order = classRule?.dir === 'asc' ? [...CLASSES].reverse() : CLASSES;
    return order.map((cl) => ({ key: cl.key, label: cl.label, items: sorted.filter((c) => classOf(c) === cl.key) })).filter((g) => g.items.length);
  }
  const rec = [
    { key: 'yes', label: 'Recommended', items: sorted.filter((c) => c.recommend === 'yes') },
    { key: 'no', label: 'Not recommended', items: sorted.filter((c) => c.recommend === 'no') },
    { key: 'unset', label: 'No recommendation yet', items: sorted.filter((c) => c.recommend === null) },
  ];
  return rec.filter((g) => g.items.length);
}

export const SORT_PRESETS: { id: string; label: string; rules: SortRule[] }[] = [
  { id: 'default', label: 'Type, then rating', rules: [{ key: 'type', dir: 'asc' }, { key: 'rating', dir: 'desc' }] },
  { id: 'top', label: 'Highest rated', rules: [{ key: 'rating', dir: 'desc' }] },
  { id: 'loved', label: 'Most enjoyed', rules: [{ key: 'enjoyment', dir: 'desc' }, { key: 'rating', dir: 'desc' }] },
  { id: 'recent', label: 'Recently added', rules: [{ key: 'added', dir: 'desc' }] },
  { id: 'az', label: 'Title A to Z', rules: [{ key: 'title', dir: 'asc' }] },
  { id: 'class', label: 'Class, then enjoyment', rules: [{ key: 'class', dir: 'desc' }, { key: 'enjoyment', dir: 'desc' }] },
];
