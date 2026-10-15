import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion/react';
import { CLASS_COLOR } from './ClassBadge';
import type { ClassKey } from '../shared/model';

export function useCountUp(target: number, run = true, duration = 1.4) {
  const [v, setV] = useState(run ? 0 : target);
  const ref = useRef(0);
  useEffect(() => {
    if (!run) {
      setV(target);
      return;
    }
    const ctl = animate(ref.current, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (x) => {
        ref.current = x;
        setV(x);
      },
    });
    return () => ctl.stop();
  }, [target, run, duration]);
  return Math.round(v);
}

export function RatingRing({ value, max = 1000, cls, size = 200, run = true, label }: { value: number; max?: number; cls: ClassKey; size?: number; run?: boolean; label?: string }) {
  const shown = useCountUp(value, run);
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, shown / max));
  const color = CLASS_COLOR[cls];
  return (
    <div className="ring" style={{ width: size, height: size, ['--ring' as any]: color }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={`rg-${cls}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={color} />
            <stop offset="1" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const r1 = r + 6;
          const r2 = r + (i % 5 === 0 ? 2 : 4);
          return (
            <line
              key={i}
              x1={size / 2 + Math.cos(a) * r1}
              y1={size / 2 + Math.sin(a) * r1}
              x2={size / 2 + Math.cos(a) * r2}
              y2={size / 2 + Math.sin(a) * r2}
              className="ring-tick"
              style={{ opacity: i / 60 <= frac ? 0.9 : 0.25 }}
            />
          );
        })}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-fill"
          stroke={`url(#rg-${cls})`}
          strokeDasharray={`${circ * frac} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <span className="ring-value">{shown}</span>
        <span className="ring-max">{label ?? `out of ${max}`}</span>
      </div>
    </div>
  );
}
