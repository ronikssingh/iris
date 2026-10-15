import { useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useUi, type CelebrateSpec } from '../state/ui';
import { ClassBadge, CLASS_COLOR } from '../components/ClassBadge';
import { Poster } from '../components/Poster';
import { useCountUp } from '../components/RatingRing';
import { CLASS_BY_KEY } from '../shared/model';

/**
 * Lives above every page, so the verdict can play while the app is already
 * moving to the saved critique underneath it.
 */
export function CelebrationHost() {
  const spec = useUi((s) => s.celebrate);
  const done = useCallback(() => useUi.setState({ celebrate: null }), []);
  return <AnimatePresence>{spec && <Celebration key={spec.id + spec.total + spec.cls} spec={spec} onDone={done} />}</AnimatePresence>;
}

function Celebration({ spec, onDone }: { spec: CelebrateSpec; onDone: () => void }) {
  const { title, total, cls, poster, type, edited } = spec;
  const n = useCountUp(total, true, edited ? 1 : 1.6);

  useEffect(() => {
    if ((window as any).__irisHoldCelebration) return; // automated screenshots hold the moment still
    const t = setTimeout(onDone, edited ? 2200 : cls === 'masterpiece' ? 3600 : 2800);
    return () => clearTimeout(t);
  }, [onDone, cls, edited]);

  // While the verdict is up, keys belong to it: Escape, Enter or Space skip it, anything else is held back
  // so it can't reach the page underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onDone]);

  const sparks = useMemo(
    () =>
      Array.from({ length: edited ? 18 : cls === 'masterpiece' ? 70 : cls === 'perfect' ? 46 : 26 }, (_, i) => ({
        i,
        x: (Math.random() - 0.5) * 900,
        y: (Math.random() - 0.7) * 700,
        s: 3 + Math.random() * 7,
        d: Math.random() * 0.5,
      })),
    [cls, edited],
  );

  const sub = edited
    ? `Changes saved. It stands as ${CLASS_BY_KEY[cls].label}.`
    : cls === 'masterpiece'
      ? 'A new masterpiece joins the wall.'
      : `Saved as ${CLASS_BY_KEY[cls].label}.`;

  return (
    <motion.div
      className={`celebrate celebrate-${cls}`}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', transition: { duration: 0.5 } }}
      onClick={onDone}
      style={{ ['--c' as any]: CLASS_COLOR[cls] }}
    >
      <div className="celebrate-burst" />
      {sparks.map((p) => (
        <motion.span
          key={p.i}
          className="spark"
          style={{ width: p.s, height: p.s }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
          transition={{ duration: 2.2, delay: 0.5 + p.d, ease: [0.1, 0.8, 0.3, 1] }}
        />
      ))}
      <motion.div
        className="celebrate-poster"
        initial={{ scale: 0.6, rotateY: -50, opacity: 0 }}
        animate={{ scale: 1, rotateY: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <Poster title={title} type={type ?? 'movie'} poster={poster} size="lg" />
      </motion.div>
      <motion.div className="celebrate-text" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <span className="celebrate-title">{title}</span>
        <span className="celebrate-num display">{n}</span>
        <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: edited ? 0.9 : 1.5, type: 'spring', stiffness: 300, damping: 16 }}>
          <ClassBadge cls={cls} size="lg" />
        </motion.span>
        <span className="celebrate-sub">{sub}</span>
      </motion.div>
    </motion.div>
  );
}
