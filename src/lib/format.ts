import { TYPE_LABEL, type MediaType } from '../shared/model';

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n === 0 ? 'No' : n === 1 ? 'One' : n.toLocaleString()} ${n === 1 ? one : many}`;
}

export function count(n: number, one: string, many = one + 's'): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export function wordNum(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : n.toLocaleString();
}

export function greeting(name: string, d = new Date()): string {
  const h = d.getHours();
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Up late';
  const who = name.trim();
  if (part === 'Up late') return who ? `Up late, ${who}?` : 'Up late?';
  return who ? `${part}, ${who}.` : `${part}.`;
}

export function relTime(t: number, now = Date.now()): string {
  const s = Math.round((now - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? 'yesterday' : `${d} days ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(t).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
}

export function longDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function typeNoun(t: MediaType, n = 1): string {
  const base = t === 'movie' ? 'film' : t === 'show' ? 'show' : 'game';
  return n === 1 ? base : base + 's';
}

export function typeLabel(t: MediaType): string {
  return TYPE_LABEL[t];
}

export function splitCast(cast: string): string[] {
  return cast
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
