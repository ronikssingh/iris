import { useEffect, useRef, useState } from 'react';
import { StageEngine } from './engine';
import { ParticleField } from './particles';
import { THEMES, THEME_BY_ID } from './themes';
import { attachEngine, currentTheme, onThemePhase } from './controller';
import { useSettings } from '../state/settings';
import { sound } from '../lib/sound';
import type { ThemeId } from '../shared/settings';

const QUALITY = {
  full: { scale: 0.62, fps: 60, timeScale: 1 },
  balanced: { scale: 0.48, fps: 30, timeScale: 1 },
  calm: { scale: 0.42, fps: 20, timeScale: 0.45 },
};

export function Stage() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const motion = useSettings((s) => s.s.motion);
  const engineRef = useRef<StageEngine | null>(null);
  const motionRef = useRef(motion);
  motionRef.current = motion;

  useEffect(() => {
    const canvas = glRef.current!;
    const fx = fxRef.current!;
    const ctx = fx.getContext('2d')!;
    let engine: StageEngine | null = null;
    const initial = currentTheme().id as ThemeId;
    try {
      engine = new StageEngine(canvas, initial);
      engine.vignette = Object.fromEntries(THEMES.map((t) => [t.id, t.ui.vignette]));
      engine.onError = (m) => console.warn('[stage]', m);
      engine.setQuality(QUALITY[motionRef.current]);
      engineRef.current = engine;
      attachEngine(engine);
      engine.warmUp(THEMES.map((t) => t.id).filter((t) => t !== initial));
    } catch (e) {
      console.warn('WebGL unavailable, using a still background', e);
      setFallback(true);
    }

    let fields: ParticleField[] = [];
    const density = () => (motionRef.current === 'full' ? 1 : motionRef.current === 'balanced' ? 0.6 : 0.3);
    const addField = (id: ThemeId, instant: boolean) => {
      const f = new ParticleField(THEME_BY_ID[id].particles, density());
      f.resize(window.innerWidth, window.innerHeight);
      f.alpha = instant ? 1 : 0;
      f.target = 1;
      fields.forEach((o) => (o.target = 0));
      fields.push(f);
    };
    addField(initial, true);

    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);
    const sizeFx = () => {
      const d = dpr();
      fx.width = Math.round(window.innerWidth * d);
      fx.height = Math.round(window.innerHeight * d);
      fields.forEach((f) => f.resize(window.innerWidth, window.innerHeight));
    };
    sizeFx();

    const mouse = { x: -9999, y: -9999, active: false };
    let flashLevel = 0;
    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
      engine?.setMouse((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    const onLeave = () => {
      mouse.active = false;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    let last = performance.now();
    const drawFx = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const d = dpr();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, fx.width, fx.height);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      flashLevel *= Math.pow(0.02, dt);
      for (const f of fields) f.step(ctx, dt, mouse, flashLevel);
      fields = fields.filter((f) => !(f.target === 0 && f.alpha < 0.01));
    };

    let fallbackRaf = 0;
    if (engine) {
      engine.onFrame = () => drawFx();
      engine.start();
    } else {
      const loop = () => {
        fallbackRaf = requestAnimationFrame(loop);
        drawFx();
      };
      loop();
    }

    const offPhase = onThemePhase((t, phase) => {
      if (phase === 'mid') addField(t.id, false);
    });

    // storms and glitches
    let stormTimer = 0;
    const scheduleStorm = () => {
      const t = currentTheme();
      const wait = t.storms ? 9000 + Math.random() * 16000 : t.glitches ? 5000 + Math.random() * 8000 : 6000;
      stormTimer = window.setTimeout(() => {
        const th = currentTheme();
        if (!document.hidden && engine && !engine.transitioning) {
          if (th.storms) {
            const strength = 0.6 + Math.random() * 0.6;
            engine.flash(strength);
            flashLevel = strength;
            sound.thunder(0.4 + Math.random() * 2.2, Math.min(1, strength));
          } else if (th.glitches) {
            engine.flash(0.85);
          }
        }
        scheduleStorm();
      }, wait);
    };
    scheduleStorm();

    const onResize = () => {
      sizeFx();
      engine?.resize();
    };
    const onVis = () => {
      if (document.hidden) {
        engine?.stop();
        sound.setFocus(0);
      } else {
        engine?.start();
        sound.setFocus(document.hasFocus() ? 1 : 0.45);
      }
    };
    const onFocus = () => {
      engine?.setFocused(true);
      sound.setFocus(1);
    };
    const onBlur = () => {
      engine?.setFocused(false);
      sound.setFocus(0.45);
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      offPhase();
      clearTimeout(stormTimer);
      cancelAnimationFrame(fallbackRaf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      engine?.destroy();
      attachEngine(null);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setQuality(QUALITY[motion]);
  }, [motion]);

  return (
    <div className="stage" aria-hidden="true">
      <canvas ref={glRef} className="stage-gl" style={{ display: fallback ? 'none' : undefined }} />
      {fallback && <div className="stage-fallback" />}
      <canvas ref={fxRef} className="stage-fx" />
      <div className="stage-grain" />
      <div className="stage-vignette" />
    </div>
  );
}
