import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/sound';
import { appInfo } from '../lib/appInfo';

const STOPS = ['22', '16', '11', '8', '5.6', '4', '2.8', '2', '1.4'];

interface Props {
  mode: 'full' | 'quick' | 'off';
  onReveal: () => void;
  onDone: () => void;
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeIn = (t: number) => Math.pow(Math.min(1, Math.max(0, t)), 2.2);

/**
 * The opening: a lens aperture clicks open f-stop by f-stop, the world pours through,
 * and the title pulls into focus.
 */
export function Intro({ mode, onReveal, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<'lens' | 'title' | 'out'>('lens');
  const [stopIdx, setStopIdx] = useState(0);
  const skipRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (mode === 'off') {
      onReveal();
      onDone();
      return;
    }
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const quick = mode === 'quick';
    const T = quick
      ? { fadeIn: 0.2, stops: [0.25, 0.36, 0.47], zoom: 0.62, zoomDur: 0.55, title: 0.7, out: 1.7, done: 2.3 }
      : { fadeIn: 0.55, stops: [0.62, 0.8, 0.98, 1.16, 1.34, 1.52, 1.7, 1.88], zoom: 2.08, zoomDur: 0.95, title: 2.2, out: 4.6, done: 5.3 };
    const nStops = T.stops.length;
    let raf = 0;
    let t0 = performance.now();
    let skipped = false;
    let revealed = false;
    let fired = new Set<number>();
    let hit = false;
    let riser = false;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    size();
    window.addEventListener('resize', size);

    const openAt = (t: number): number => {
      if (t < T.stops[0]) return 0.025;
      let o = 0.025;
      for (let i = 0; i < nStops; i++) {
        const target = 0.025 + ((i + 1) / (nStops + 1)) * 0.82;
        const prev = i === 0 ? 0.025 : 0.025 + (i / (nStops + 1)) * 0.82;
        if (t >= T.stops[i]) o = prev + (target - prev) * ease((t - T.stops[i]) / 0.12);
      }
      if (t >= T.zoom) o = o + (1.08 - o) * ease((t - T.zoom) / 0.3);
      return o;
    };

    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const zoomP = t >= T.zoom ? easeIn((t - T.zoom) / T.zoomDur) : 0;
      if (zoomP >= 1) return;
      const scale = 1 + zoomP * 9;
      const fade = Math.min(1, t / T.fadeIn);
      const cx = w / 2;
      const cy = h / 2;
      const Rb = Math.min(w, h) * 0.3 * scale;
      const open = openAt(t);
      const N = 8;
      const r = Rb * (0.03 + open * 1.0);
      const rot = open * 1.1 + 0.2;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      // the barrel
      ctx.save();
      ctx.globalAlpha = fade;
      const ringOuter = Rb * 1.22;
      const g = ctx.createRadialGradient(cx, cy - Rb * 0.3, Rb * 0.2, cx, cy, ringOuter);
      g.addColorStop(0, '#2a2d33');
      g.addColorStop(0.7, '#15171b');
      g.addColorStop(1, '#050608');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, ringOuter, 0, Math.PI * 2);
      ctx.fill();
      // knurled grip
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 2 * dpr;
      for (let i = 0; i < 180; i++) {
        const a = (i / 180) * Math.PI * 2 + rot * 0.15;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * ringOuter * 0.985, cy + Math.sin(a) * ringOuter * 0.985);
        ctx.lineTo(cx + Math.cos(a) * ringOuter * 0.93, cy + Math.sin(a) * ringOuter * 0.93);
        ctx.stroke();
      }
      // rim light sweeping round the barrel
      const sweep = t * 1.4;
      const rim = ctx.createConicGradient(sweep, cx, cy);
      rim.addColorStop(0, 'rgba(255,255,255,0.0)');
      rim.addColorStop(0.08, 'rgba(255,255,255,0.35)');
      rim.addColorStop(0.18, 'rgba(255,255,255,0.0)');
      rim.addColorStop(1, 'rgba(255,255,255,0.0)');
      ctx.strokeStyle = rim;
      ctx.lineWidth = 2.5 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, ringOuter - 1 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      // engraved f-stops along the top
      const si = Math.min(nStops, fired.size);
      ctx.font = `${Math.round(13 * dpr * Math.min(1.6, scale))}px "Instrument Sans Variable", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labels = quick ? ['16', '5.6', '2.8', '1.4'] : STOPS;
      const cur = quick ? Math.min(labels.length - 1, si) : Math.min(labels.length - 1, si);
      for (let i = 0; i < labels.length; i++) {
        const a = -Math.PI / 2 + (i - cur) * 0.16;
        const rr = Rb * 1.11;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = i === cur ? '#ffd27a' : 'rgba(230,232,236,0.55)';
        ctx.fillText(labels[i], 0, 0);
        ctx.restore();
      }
      // index mark
      ctx.fillStyle = '#e2412c';
      ctx.beginPath();
      ctx.moveTo(cx, cy - Rb * 1.19);
      ctx.lineTo(cx - 5 * dpr, cy - Rb * 1.24);
      ctx.lineTo(cx + 5 * dpr, cy - Rb * 1.24);
      ctx.closePath();
      ctx.fill();
      // lens maker's engraving
      ctx.font = `${Math.round(10 * dpr * Math.min(1.6, scale))}px "Instrument Sans Variable", sans-serif`;
      ctx.fillStyle = 'rgba(230,232,236,0.38)';
      const engr = 'IRIS 1:1.4 50 mm';
      for (let i = 0; i < engr.length; i++) {
        const a = Math.PI / 2 + (i - engr.length / 2) * 0.045;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * Rb * 1.1, cy + Math.sin(a) * Rb * 1.1);
        ctx.rotate(a - Math.PI / 2);
        ctx.fillText(engr[i], 0, 0);
        ctx.restore();
      }

      // the blades
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, Rb, 0, Math.PI * 2);
      ctx.clip();
      const V: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        const a = rot + (i / N) * Math.PI * 2;
        V.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      const L = Rb * 3;
      for (let i = 0; i < N; i++) {
        const a = V[i];
        const b = V[(i + 1) % N];
        const pa = V[(i - 1 + N) % N];
        const ea = [a[0] - pa[0], a[1] - pa[1]];
        const la = Math.hypot(ea[0], ea[1]) || 1;
        const eb = [b[0] - a[0], b[1] - a[1]];
        const lb = Math.hypot(eb[0], eb[1]) || 1;
        const ang = rot + ((i + 0.5) / N) * Math.PI * 2;
        const lit = 0.5 + 0.5 * Math.cos(ang + 2.3);
        const bg = ctx.createLinearGradient(a[0], a[1], a[0] + (ea[0] / la) * Rb, a[1] + (ea[1] / la) * Rb);
        bg.addColorStop(0, `rgb(${28 + lit * 34}, ${30 + lit * 34}, ${36 + lit * 36})`);
        bg.addColorStop(1, `rgb(${10 + lit * 12}, ${11 + lit * 12}, ${13 + lit * 13})`);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(a[0] + (ea[0] / la) * L, a[1] + (ea[1] / la) * L);
        ctx.lineTo(b[0] + (eb[0] / lb) * L, b[1] + (eb[1] / lb) * L);
        ctx.lineTo(b[0], b[1]);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.06 + lit * 0.12})`;
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.moveTo(b[0], b[1]);
        ctx.lineTo(b[0] + (eb[0] / lb) * L, b[1] + (eb[1] / lb) * L);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();

      // cut the aperture open so the world shows through
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      V.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // light pouring through the opening
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = Math.pow(Math.max(0, 1 - open * 2.4), 2) * fade;
      const gr = Rb * 0.18 + r * 1.1;
      const lg = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
      lg.addColorStop(0, `rgba(255, 246, 228, ${0.95 * glow})`);
      lg.addColorStop(0.35, `rgba(255, 236, 205, ${0.35 * glow})`);
      lg.addColorStop(1, 'rgba(255, 245, 225, 0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(cx, cy, gr, 0, Math.PI * 2);
      ctx.fill();
      // anamorphic streak at the moment it opens
      const streak = t >= T.zoom - 0.1 ? Math.max(0, 1 - (t - T.zoom + 0.1) / 0.7) : 0;
      if (streak > 0) {
        const sg = ctx.createLinearGradient(0, cy, w, cy);
        sg.addColorStop(0, 'rgba(120,170,255,0)');
        sg.addColorStop(0.5, `rgba(200,225,255,${0.75 * streak})`);
        sg.addColorStop(1, 'rgba(120,170,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(0, cy - 2 * dpr, w, 4 * dpr);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const speed = appInfo.introSpeed ?? 1;
    const tick = (now: number) => {
      const t = ((now - t0) / 1000) * speed;
      // sounds and stage changes on the timeline
      T.stops.forEach((st, i) => {
        if (t >= st && !fired.has(i)) {
          fired.add(i);
          setStopIdx(i + 1);
          sound.shutter(0.75 + (i / nStops) * 0.4);
        }
      });
      if (!riser && t >= (quick ? 0.25 : 0.9)) {
        riser = true;
        sound.introRiser(T.zoom - (quick ? 0.25 : 0.9));
      }
      if (!hit && t >= T.zoom) {
        hit = true;
        sound.introHit();
      }
      if (!revealed && t >= T.out - 0.15) {
        revealed = true;
        onReveal();
      }
      if (t >= T.title) setStage((s) => (s === 'lens' ? 'title' : s));
      if (t >= T.out) setStage('out');
      draw(t);
      if (t >= T.done) {
        onDone();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const skip = () => {
      if (skipped) return;
      skipped = true;
      const now = performance.now();
      const t = ((now - t0) / 1000) * speed;
      // jump to just before the zoom so the reveal still happens, quickly
      if (t < T.zoom) {
        t0 = now - (T.zoom * 1000) / speed;
        fired = new Set(T.stops.map((_, i) => i));
        setStopIdx(nStops);
        riser = true;
      } else if (t < T.out) {
        t0 = now - (T.out * 1000) / speed;
      }
    };
    skipRef.current = skip;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      skip();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === 'off') return null;
  return (
    <div className={'intro stage-' + stage} onPointerDown={() => skipRef.current?.()}>
      <canvas ref={canvasRef} className="intro-canvas" />
      <div className="intro-title" aria-hidden={stage === 'lens'}>
        <div className="intro-flare" />
        <h1 className="intro-name">IRIS</h1>
        <p className="intro-tag">Every story, in focus.</p>
      </div>
      <div className="intro-stop" aria-hidden="true">
        {stage === 'lens' && stopIdx > 0 ? `f/${(mode === 'quick' ? ['16', '5.6', '2.8', '1.4'] : STOPS)[Math.min(stopIdx, (mode === 'quick' ? 3 : 8))]}` : ''}
      </div>
      <div className="intro-skip">Press any key to skip</div>
    </div>
  );
}
