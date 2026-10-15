import { SCORES, type DraftData, type ScoreKey } from '../../shared/model';

export type StepId = 'work' | 'credits' | 'description' | 'comments' | ScoreKey | 'verdict' | 'remarks' | 'review';

export interface StepDef {
  id: StepId;
  label: string;
  short?: string;
  group: 'about' | 'scores' | 'verdict';
  score?: ScoreKey;
}

/** The order of writing a critique, matching the order the details are shown in. */
export const STEPS: StepDef[] = [
  { id: 'work', label: 'Title and type', group: 'about' },
  { id: 'credits', label: 'Director, studio and cast', short: 'Credits', group: 'about' },
  { id: 'description', label: 'Description', group: 'about' },
  { id: 'comments', label: 'Personal comments', group: 'about' },
  ...SCORES.map((s) => ({ id: s.key as StepId, label: s.label, group: 'scores' as const, score: s.key })),
  { id: 'verdict', label: 'Rating, class and recommend', short: 'Rating and class', group: 'verdict' },
  { id: 'remarks', label: 'Final remarks', group: 'verdict' },
  { id: 'review', label: 'Review and save', group: 'verdict' },
];

export const STEP_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.id, i])) as Record<StepId, number>;
export const COMMENTS_STEP = STEP_INDEX.comments;

export function stepDone(d: DraftData, s: StepDef): boolean {
  switch (s.id) {
    case 'work':
      return !!d.title.trim() && !!d.type;
    case 'credits':
      return !!(d.director.trim() || d.studio.trim() || d.cast.trim());
    case 'description':
      return !!d.description.trim();
    case 'comments':
      return !!d.comments.trim();
    case 'verdict':
      return d.recommend !== null;
    case 'remarks':
      return !!d.finalRemarks.trim();
    case 'review':
      return false;
    default:
      return s.score ? d.scores[s.score] !== null : false;
  }
}

export function stepRequiredMissing(d: DraftData, s: StepDef): boolean {
  if (s.id === 'work') return !d.title.trim() || !d.type;
  if (s.score) return d.scores[s.score] === null;
  return false;
}
