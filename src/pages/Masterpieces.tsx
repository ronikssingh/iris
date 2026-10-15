import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useLibrary } from '../state/library';
import { useUi } from '../state/ui';
import { Poster } from '../components/Poster';
import { ClassBadge } from '../components/ClassBadge';
import { RatingRing, useCountUp } from '../components/RatingRing';
import { IrisChart } from '../components/IrisChart';
import { Icon } from '../components/Icon';
import { Button, Toggle } from '../components/ui';
import { mediaUrl } from '../lib/images';
import { wordNum } from '../lib/format';
import { sound } from '../lib/sound';
import { TYPE_LABEL, classOf, ratingOf, type Critique } from '../shared/model';

export function Masterpieces() {
  const crits = useLibrary((s) => s.lib.critiques);
  const go = useUi((s) => s.go);
  const [withPerfect, setWithPerfect] = useState(false);
  const [focus, setFocus] = useState(0);
  const [premiere, setPremiere] = useState(false);

  const list = useMemo(
    () =>
      crits
        .filter((c) => classOf(c) === 'masterpiece' || (withPerfect && classOf(c) === 'perfect'))
        .sort((a, b) => ratingOf(b) - ratingOf(a)),
    [crits, withPerfect],
  );
  const contenders = useMemo(
    () =>
      crits
        .filter((c) => classOf(c) !== 'masterpiece' && !(withPerfect && classOf(c) === 'perfect'))
        .sort((a, b) => ratingOf(b) - ratingOf(a))
        .slice(0, 3),
    [crits, withPerfect],
  );
  useEffect(() => setFocus((f) => Math.min(f, Math.max(0, list.length - 1))), [list.length]);
  const current = list[focus];

  return (
    <div className="page masters">
      <div className="masters-dark" aria-hidden="true" />
      <div className="spotlights" aria-hidden="true">
        <span className="spot s1" />
        <span className="spot s2" />
        <span className="spot s3" />
      </div>
      <GoldDust />

      <header className="masters-head">
        <motion.h1 className="masters-title display" initial={{ opacity: 0, letterSpacing: '0.5em', filter: 'blur(14px)' }} animate={{ opacity: 1, letterSpacing: '0.14em', filter: 'blur(0px)' }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}>
          Masterpieces
        </motion.h1>
        <p className="masters-sub">
          {list.length === 0
            ? 'Nothing has reached 960 yet. The light is waiting.'
            : `${list.length === 1 ? 'One work has' : `${wordNum(list.length).replace(/^./, (x) => x.toUpperCase())} works have`} earned a place in the light.`}
        </p>
        <div className="masters-tools">
          <Toggle on={withPerfect} onChange={setWithPerfect} label="Include Perfect" />
          {list.length > 0 && (
            <Button variant="primary" icon="play" onClick={() => setPremiere(true)}>
              Play the premiere
            </Button>
          )}
        </div>
      </header>

      {list.length === 0 ? (
        <div className="pedestal-empty">
          <div className="pedestal">
            <div className="pedestal-frame" />
            <div className="pedestal-base" />
          </div>
          {contenders[0] && (
            <p className="contender-line">
              {contenders[0].title} is closest, {960 - ratingOf(contenders[0])} point{960 - ratingOf(contenders[0]) === 1 ? '' : 's'} away.
            </p>
          )}
        </div>
      ) : (
        <Carousel list={list} focus={focus} setFocus={setFocus} onOpen={(c) => go({ name: 'detail', id: c.id })} />
      )}

      <AnimatePresence mode="wait">
        {current && (
          <motion.section
            key={current.id}
            className="plaque glass"
            initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="plaque-main">
              <h2 className="plaque-title display">{current.title}</h2>
              <p className="plaque-meta">
                <Icon name={current.type} size={14} />
                <span>
                  {TYPE_LABEL[current.type]}
                  {current.director ? `, ${current.director}` : ''}
                  {current.year ? `, ${current.year}` : ''}
                </span>
              </p>
              {current.finalRemarks.trim() && <blockquote className="plaque-quote">“{current.finalRemarks.trim()}”</blockquote>}
              <div className="plaque-actions">
                <ClassBadge cls={classOf(current)} size="md" />
                <Button variant="ghost" iconRight="right" onClick={() => go({ name: 'detail', id: current.id })}>
                  Read the critique
                </Button>
              </div>
            </div>
            <RatingRing value={ratingOf(current)} cls={classOf(current)} size={150} />
            <div className="plaque-chart">
              <IrisChart scores={current.scores} cls={classOf(current)} size={150} labels={false} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {contenders.length > 0 && list.length > 0 && (
        <section className="contenders">
          <h3>Closest to greatness</h3>
          <div className="contender-row">
            {contenders.map((c) => (
              <button key={c.id} type="button" className="contender" onClick={() => go({ name: 'detail', id: c.id })}>
                <Poster title={c.title} type={c.type} poster={c.poster} size="sm" />
                <span className="contender-text">
                  <span className="contender-title">{c.title}</span>
                  <span className="contender-sub">
                    {ratingOf(c)} now, {Math.max(0, 960 - ratingOf(c))} to go
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>{premiere && <Premiere list={list} onClose={() => setPremiere(false)} />}</AnimatePresence>
    </div>
  );
}

function Carousel({ list, focus, setFocus, onOpen }: { list: Critique[]; focus: number; setFocus: (n: number) => void; onOpen: (c: Critique) => void }) {
  const n = list.length;
  const step = 360 / Math.max(n, 1);
  const radius = n <= 1 ? 0 : n === 2 ? 260 : Math.max(330, (n * 230) / (2 * Math.PI));
  const spin = useMotionValue(0);
  const smooth = useSpring(spin, { stiffness: 60, damping: 18 });
  const drag = useRef<{ x: number; a: number; moved: boolean } | null>(null);
  const idle = useRef(0);

  useEffect(() => {
    spin.set(-focus * step);
  }, [focus, step, spin]);

  // a slow drift between masterpieces when left alone
  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => {
      if (Date.now() - idle.current < 9000) return;
      setFocus((focus + 1) % n);
    }, 6500);
    return () => clearInterval(t);
  }, [n, focus, setFocus]);

  const ringRotate = useTransform(smooth, (v) => `rotateY(${v}deg)`);

  return (
    <div
      className="carousel"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, a: spin.get(), moved: false };
        idle.current = Date.now();
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.x;
        if (Math.abs(dx) > 4) drag.current.moved = true;
        spin.set(drag.current.a + dx * 0.35);
      }}
      onPointerUp={() => {
        if (!drag.current) return;
        const moved = drag.current.moved;
        drag.current = null;
        if (moved && n > 1) {
          const idx = ((Math.round(-spin.get() / step) % n) + n) % n;
          setFocus(idx);
          spin.set(-Math.round(-spin.get() / step) * step);
          sound.whoosh();
        }
      }}
      onPointerLeave={() => {
        drag.current = null;
      }}
    >
      <motion.div className="carousel-ring" style={{ transform: ringRotate }}>
        {list.map((c, i) => {
          const on = i === focus;
          return (
            <div key={c.id} className={'carousel-item' + (on ? ' on' : '')} style={{ transform: `rotateY(${i * step}deg) translateZ(${radius}px)` }}>
              <button
                type="button"
                className={`mp-frame cls-frame-${classOf(c)}`}
                onClick={() => {
                  idle.current = Date.now();
                  if (on) onOpen(c);
                  else {
                    sound.whoosh();
                    setFocus(i);
                  }
                }}
              >
                <Poster title={c.title} type={c.type} poster={c.poster} year={c.year} size="xl" />
                <span className="gold-sheen" />
                <span className="mp-rating display">{ratingOf(c)}</span>
              </button>
              <div className="mp-reflection" aria-hidden="true">
                <Poster title={c.title} type={c.type} poster={c.poster} size="xl" />
              </div>
            </div>
          );
        })}
      </motion.div>
      {n > 1 && (
        <div className="carousel-nav">
          <Button variant="glass" icon="left" aria-label="Previous" onClick={() => { idle.current = Date.now(); setFocus((focus - 1 + n) % n); sound.whoosh(-1); }} />
          <span className="carousel-count">
            {focus + 1} of {n}
          </span>
          <Button variant="glass" icon="right" aria-label="Next" onClick={() => { idle.current = Date.now(); setFocus((focus + 1) % n); sound.whoosh(1); }} />
        </div>
      )}
    </div>
  );
}

function GoldDust() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const P = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), t: Math.random() * 10 }));
    const size = () => {
      cv.width = cv.clientWidth * dpr;
      cv.height = cv.clientHeight * dpr;
    };
    size();
    window.addEventListener('resize', size);
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of P) {
        p.t += dt;
        p.y -= dt * (0.004 + p.z * 0.012);
        p.x += Math.sin(p.t * 0.6 + p.z * 9) * dt * 0.004;
        if (p.y < -0.02) {
          p.y = 1.02;
          p.x = Math.random();
        }
        const a = (0.25 + p.z * 0.6) * (0.6 + 0.4 * Math.sin(p.t * 2.2 + p.z * 30));
        const r = (0.6 + p.z * 1.8) * dpr;
        ctx.fillStyle = `rgba(255, 214, 120, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x * cv.width, p.y * cv.height, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
    };
  }, []);
  return <canvas ref={ref} className="gold-dust" aria-hidden="true" />;
}

/** A letterboxed, trailer-style screening of every masterpiece. */
function Premiere({ list, onClose }: { list: Critique[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const c = list[i];
  useEffect(() => {
    sound.introHit();
  }, []);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => {
      if (i < list.length - 1) {
        setI(i + 1);
        sound.whoosh(1);
      } else onClose();
    }, 7000);
    return () => clearTimeout(t);
  }, [i, paused, list.length, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setI((x) => Math.min(list.length - 1, x + 1));
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list.length, onClose]);
  const url = mediaUrl(c.poster);
  return createPortal(
    <motion.div className="premiere" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
      <motion.div className="letterbox top" initial={{ height: '50vh' }} animate={{ height: '12vh' }} transition={{ duration: 1.1, ease: [0.7, 0, 0.2, 1] }} />
      <motion.div className="letterbox bottom" initial={{ height: '50vh' }} animate={{ height: '12vh' }} transition={{ duration: 1.1, ease: [0.7, 0, 0.2, 1] }} />
      <AnimatePresence mode="wait">
        <motion.div key={c.id} className="premiere-slide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }}>
          {url ? <div className="premiere-bg" style={{ backgroundImage: `url("${url}")` }} /> : <div className="premiere-bg gen" />}
          <div className="premiere-content">
            <motion.div className="premiere-poster" initial={{ scale: 1.08, opacity: 0, x: -30 }} animate={{ scale: 1, opacity: 1, x: 0 }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}>
              <Poster title={c.title} type={c.type} poster={c.poster} size="xl" />
            </motion.div>
            <div className="premiere-text">
              <motion.span className="premiere-kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                {TYPE_LABEL[c.type]}
                {c.year ? `, ${c.year}` : ''}
              </motion.span>
              <motion.h2 className="premiere-title display" initial={{ opacity: 0, letterSpacing: '0.4em', filter: 'blur(12px)' }} animate={{ opacity: 1, letterSpacing: '0.04em', filter: 'blur(0px)' }} transition={{ delay: 0.4, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}>
                {c.title}
              </motion.h2>
              {c.director && (
                <motion.p className="premiere-by" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
                  {c.type === 'game' ? 'Directed by' : c.type === 'show' ? 'From' : 'A film by'} {c.director}
                </motion.p>
              )}
              <PremiereScore value={ratingOf(c)} key={c.id + 'n'} />
              {c.finalRemarks.trim() && (
                <motion.p className="premiere-quote" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.6, duration: 1 }}>
                  “{c.finalRemarks.trim()}”
                </motion.p>
              )}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}>
                <ClassBadge cls={classOf(c)} size="lg" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="premiere-controls">
        <span>
          {i + 1} of {list.length}
        </span>
        <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>
          <Icon name={paused ? 'play' : 'pause'} size={16} />
        </button>
        <button type="button" onClick={onClose}>
          <Icon name="close" size={16} /> Leave the screening
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}

function PremiereScore({ value }: { value: number }) {
  const n = useCountUp(value, true, 2.4);
  return (
    <motion.div className="premiere-score" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>
      <span className="display">{n}</span>
      <small>out of 1000</small>
    </motion.div>
  );
}

