import { memo, useState, type CSSProperties } from 'react';
import { mediaUrl } from '../lib/images';
import { hashStr } from '../lib/format';
import { Icon } from './Icon';
import type { MediaType } from '../shared/model';

/* Colour pairs for generated title cards, chosen to look like screen-printed one-sheets. */
const CARD_PALETTES: [string, string, string][] = [
  ['#1b2a4a', '#e8b04b', '#f6ead2'],
  ['#3a0f1e', '#ff6b4a', '#ffe7d6'],
  ['#0f3b3a', '#7fe0c4', '#e9fff8'],
  ['#2c1946', '#ff8ad8', '#fde9ff'],
  ['#3d2a12', '#f2c879', '#fff4dc'],
  ['#102434', '#58b4ff', '#e6f4ff'],
  ['#21301b', '#c5e06b', '#f5ffe0'],
  ['#3a1b0f', '#ffb15c', '#fff0de'],
  ['#14141a', '#d8d8e0', '#ffffff'],
  ['#3b1230', '#ffd166', '#fff6dd'],
];

function monogram(t: string): string {
  const words = t
    .replace(/[:\-–—,.!?'’"]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(the|a|an|of|and|in|on|to)$/i.test(w));
  if (!words.length) return t.slice(0, 1).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase() + (words[0].length > 1 ? words[0].slice(1, 2).toLowerCase() : '');
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface Props {
  title: string;
  type: MediaType;
  poster: string | null;
  year?: string;
  className?: string;
  style?: CSSProperties;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Poster = memo(function Poster({ title, type, poster, year, className, style, size = 'md' }: Props) {
  const [broken, setBroken] = useState(false);
  const url = !broken ? mediaUrl(poster) : null;
  if (url) {
    return (
      <div className={`poster poster-${size} ${className ?? ''}`} style={style}>
        <img src={url} alt="" draggable={false} onError={() => setBroken(true)} decoding="async" />
      </div>
    );
  }
  const h = hashStr(title.toLowerCase() + type);
  const [bg, accent, ink] = CARD_PALETTES[h % CARD_PALETTES.length];
  const angle = (h >> 4) % 360;
  const words = title.trim() || 'Untitled';
  const longest = words.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 1);
  const len = words.length;
  // size in % of the poster width: the longest word must fit on one line, long titles shrink overall
  const k = Math.min(16, 104 / Math.max(longest, 4), len > 44 ? 8 : len > 30 ? 9.5 : len > 18 ? 12 : 16);
  const mono = monogram(words);
  return (
    <div
      className={`poster poster-${size} poster-gen poster-gen-${type} ${className ?? ''}`}
      style={{ ...style, ['--pg-bg' as any]: bg, ['--pg-accent' as any]: accent, ['--pg-ink' as any]: ink, ['--pg-angle' as any]: angle + 'deg' }}
    >
      <div className="pg-art" />
      <div className="pg-text">
        <span className="pg-type">
          <Icon name={type} size={14} />
        </span>
        <span className="pg-title" style={{ ['--k' as any]: k.toFixed(2) }}>
          {words}
        </span>
        <span className="pg-mono">{mono}</span>
        {year && <span className="pg-year">{year}</span>}
      </div>
    </div>
  );
});
