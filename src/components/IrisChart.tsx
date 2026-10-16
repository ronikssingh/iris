import { motion } from 'motion/react';
import { SCORES, type ClassKey, type ScoreKey } from '../shared/model';
import { CLASS_COLOR } from './ClassBadge';

/** The ten scores drawn as an aperture: every critique gets its own iris shape. */
export function IrisChart({
  scores,
  cls,
  size = 320,
  labels = true,
  highlight,
  animate = true,
  compare,
}: {
  scores: Partial<Record<ScoreKey, number | null>>;
  cls: ClassKey;
  size?: number;
  labels?: boolean;
  highlight?: ScoreKey | null;
  animate?: boolean;
  compare?: { scores: Partial<Record<ScoreKey, number | null>>; color: string } | null; // a second person's shape drawn underneath
}) {
  const pad = labels ? 64 : 8;
  const vb = size + pad * 2;
  const c = vb / 2;
  const R = size / 2;
  const n = SCORES.length;
  const pt = (i: number, v: number) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v] as const;
  };
  const poly = SCORES.map((s, i) => pt(i, Math.max(0.02, (scores[s.key] ?? 0) / 100)).join(',')).join(' ');
  const color = CLASS_COLOR[cls];
  return (
    <svg className="iris-chart" viewBox={`0 0 ${vb} ${vb}`} width="100%" style={{ maxWidth: vb }} role="img" aria-label="Score shape">
      <defs>
        <radialGradient id={`ic-fill-${cls}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={color} stopOpacity="0.05" />
          <stop offset="1" stopColor={color} stopOpacity="0.45" />
        </radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <circle key={k} cx={c} cy={c} r={R * k} className="ic-ring" />
      ))}
      {SCORES.map((s, i) => {
        const [x, y] = pt(i, 1);
        return <line key={s.key} x1={c} y1={c} x2={x} y2={y} className={'ic-spoke' + (highlight === s.key ? ' on' : '')} />;
      })}
      {compare && (
        <motion.polygon
          points={SCORES.map((s, i) => pt(i, Math.max(0.02, (compare.scores[s.key] ?? 0) / 100)).join(',')).join(' ')}
          fill="none"
          stroke={compare.color}
          strokeWidth={2}
          strokeDasharray="5 5"
          strokeLinejoin="round"
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 0.95 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        />
      )}
      <motion.polygon
        points={poly}
        fill={`url(#ic-fill-${cls})`}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        initial={animate ? { scale: 0.2, opacity: 0, rotate: -40 } : false}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: `${c}px ${c}px` }}
      />
      {SCORES.map((s, i) => {
        const v = scores[s.key];
        if (v == null) return null;
        const [x, y] = pt(i, v / 100);
        return <circle key={s.key} cx={x} cy={y} r={highlight === s.key ? 5 : 3} fill={color} className="ic-dot" />;
      })}
      {labels &&
        SCORES.map((s, i) => {
          const [x, y] = pt(i, 1.17);
          const anchor = Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end';
          return (
            <text key={s.key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className={'ic-label' + (highlight === s.key ? ' on' : '')}>
              {s.short}
              <tspan className="ic-num" x={x} dy="1.25em">
                {scores[s.key] ?? '–'}
              </tspan>
            </text>
          );
        })}
    </svg>
  );
}
