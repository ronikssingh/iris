import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { motion, useSpring } from 'motion/react';
import { sound } from '../lib/sound';

const SPAN = 300; // degrees of travel from 0 to 100, like a real focus ring

export function scoreHue(v: number): string {
  if (v >= 96) return '#f4c95d';
  if (v >= 85) return '#4fd6a0';
  if (v >= 70) return '#7cc4ff';
  if (v >= 50) return '#e9c46a';
  if (v >= 30) return '#ef9a5a';
  return '#ff6b6b';
}

/**
 * A lens focus ring for entering a score out of 100. Turn it with a drag, the scroll wheel or the
 * arrow keys, or just type the number.
 */
export function ScoreDial({
  value,
  onChange,
  label,
  size = 380,
  autoFocus,
}: {
  value: number | null;
  onChange: (v: number) => void;
  label: string;
  size?: number;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const v = value ?? 50;
  const rot = useSpring((v / 100) * SPAN, { stiffness: 260, damping: 30, mass: 0.6 });
  const drag = useRef<{ a: number; v: number } | null>(null);
  const typed = useRef<{ s: string; t: number }>({ s: '', t: 0 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    rot.set((v / 100) * SPAN);
  }, [v, rot]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus, label]);

  const set = (n: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(n)));
    if (clamped !== value) {
      onChange(clamped);
      sound.dial(clamped);
    }
  };

  const angleAt = (x: number, y: number) => {
    const r = ref.current!.getBoundingClientRect();
    return (Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { a: angleAt(e.clientX, e.clientY), v };
    setActive(true);
    ref.current?.focus({ preventScroll: true });
    if (value === null) set(v);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const a = angleAt(e.clientX, e.clientY);
    let d = a - drag.current.a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    drag.current.a = a;
    // dragging clockwise turns the ring towards higher numbers
    drag.current.v = Math.max(0, Math.min(100, drag.current.v + (d / SPAN) * 100));
    set(drag.current.v);
  };
  const onPointerUp = () => {
    drag.current = null;
    setActive(false);
  };

  const onWheel = (e: React.WheelEvent) => {
    const step = e.shiftKey ? 5 : 1;
    set(v + (e.deltaY < 0 || e.deltaX < 0 ? step : -step));
  };

  const onKey = (e: KeyboardEvent) => {
    // shortcuts with modifiers (like ⌥→ for the next step) belong to the editor, not the ring
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const k = e.key;
    if (k === 'ArrowUp' || k === 'ArrowRight') set(v + (e.shiftKey ? 10 : 1));
    else if (k === 'ArrowDown' || k === 'ArrowLeft') set(v - (e.shiftKey ? 10 : 1));
    else if (k === 'PageUp') set(v + 10);
    else if (k === 'PageDown') set(v - 10);
    else if (k === 'Home') set(0);
    else if (k === 'End') set(100);
    else if (/^\d$/.test(k)) {
      const now = Date.now();
      const buf = now - typed.current.t < 1600 ? typed.current.s + k : k;
      typed.current = { s: buf.slice(-3), t: now };
      const n = parseInt(typed.current.s, 10);
      set(n > 100 ? parseInt(k, 10) : n);
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const R = size / 2;
  const ticks: ReactElement[] = [];
  for (let i = 0; i <= 100; i++) {
    // numbers run anticlockwise, so turning the ring clockwise (it follows your hand) raises the score
    const a = -(i / 100) * SPAN - 90;
    const major = i % 10 === 0;
    const mid = i % 5 === 0;
    const r1 = R - 34;
    const r2 = R - (major ? 56 : mid ? 49 : 44);
    const rad = (a * Math.PI) / 180;
    ticks.push(
      <line
        key={i}
        x1={R + Math.cos(rad) * r1}
        y1={R + Math.sin(rad) * r1}
        x2={R + Math.cos(rad) * r2}
        y2={R + Math.sin(rad) * r2}
        className={major ? 'dial-tick major' : mid ? 'dial-tick mid' : 'dial-tick'}
      />,
    );
    if (major) {
      const rt = R - 72;
      ticks.push(
        <text
          key={'t' + i}
          x={R + Math.cos(rad) * rt}
          y={R + Math.sin(rad) * rt}
          className="dial-num"
          textAnchor="middle"
          dominantBaseline="central"
          transform={`rotate(${a + 90} ${R + Math.cos(rad) * rt} ${R + Math.sin(rad) * rt})`}
        >
          {i}
        </text>,
      );
    }
  }
  const knurl: ReactElement[] = [];
  for (let i = 0; i < 120; i++) {
    const rad = (i / 120) * Math.PI * 2;
    knurl.push(
      <line key={i} x1={R + Math.cos(rad) * (R - 4)} y1={R + Math.sin(rad) * (R - 4)} x2={R + Math.cos(rad) * (R - 18)} y2={R + Math.sin(rad) * (R - 18)} className="dial-knurl" />,
    );
  }
  const hue = value === null ? 'var(--ink-3)' : scoreHue(v);

  return (
    <div
      ref={ref}
      className={'dial' + (active ? ' active' : '') + (value === null ? ' unset' : '')}
      style={{ width: size, height: size, ['--hue' as any]: hue }}
      tabIndex={0}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? 'Not scored yet' : `${value} out of 100`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onKeyDown={onKey}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="dial-svg">
        <defs>
          <radialGradient id="dial-face" cx="50%" cy="38%" r="70%">
            <stop offset="0" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="1" stopColor="rgba(0,0,0,0.35)" />
          </radialGradient>
          <linearGradient id="dial-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.22)" />
          </linearGradient>
        </defs>
        <circle cx={R} cy={R} r={R - 2} className="dial-body" />
        <motion.g style={{ rotate: rot, originX: '50%', originY: '50%' }}>{knurl}</motion.g>
        <circle cx={R} cy={R} r={R - 20} fill="url(#dial-face)" stroke="url(#dial-rim)" strokeWidth="1.2" />
        <motion.g style={{ rotate: rot, originX: '50%', originY: '50%' }}>
          {ticks}
        </motion.g>
        <path d={`M ${R} 26 l -8 -12 h 16 z`} className="dial-index" />
        <circle cx={R} cy={R} r={R - 104} className="dial-glass" />
      </svg>
      <div className="dial-center">
        <span className="dial-value">{value === null ? '–' : value}</span>
        <span className="dial-of">out of 100</span>
      </div>
    </div>
  );
}
