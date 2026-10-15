import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../../components/Icon';
import { AutoTextarea } from '../../components/ui';
import { ScoreDial } from '../../components/ScoreDial';
import { IrisChart } from '../../components/IrisChart';
import { RatingRing } from '../../components/RatingRing';
import { ClassBadge, CLASS_COLOR } from '../../components/ClassBadge';
import { Poster } from '../../components/Poster';
import { PosterInput } from './PosterInput';
import { savePosterFromUrl } from '../../lib/images';
import { splitCast } from '../../lib/format';
import { sound } from '../../lib/sound';
import {
  CLASSES,
  CLASS_BY_KEY,
  SCORES,
  SCORE_BY_KEY,
  TYPES,
  TYPE_LABEL,
  missingRequired,
  suggestClass,
  totalOf,
  type DraftData,
  type MediaType,
  type ScoreKey,
} from '../../shared/model';
import type { LookupCandidate } from '../../shared/ipc';

export type Patch = (p: Partial<DraftData>) => void;

/* --------------------------------------------------------- Title & type */

export function WorkSection({ d, set, autoFocus }: { d: DraftData; set: Patch; autoFocus?: boolean }) {
  const [results, setResults] = useState<LookupCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (autoFocus) setTimeout(() => titleRef.current?.focus(), 200);
  }, [autoFocus]);

  useEffect(() => {
    const q = d.title.trim();
    if (q.length < 2 || q === dismissed) {
      setResults(null);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await window.iris.lookup.search(q, d.type);
        if (id === reqId.current) setResults(r);
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [d.title, d.type, dismissed]);

  const apply = async (c: LookupCandidate) => {
    setApplying(c.id);
    sound.click();
    try {
      const det = await window.iris.lookup.details(c);
      const patch: Partial<DraftData> = {};
      if (det.title) patch.title = det.title;
      if (det.type) patch.type = det.type;
      if (det.year) patch.year = det.year;
      if (det.director && !d.director.trim()) patch.director = det.director;
      if (det.studio && !d.studio.trim()) patch.studio = det.studio;
      if (det.cast && !d.cast.trim()) patch.cast = det.cast;
      if (det.description && !d.description.trim()) patch.description = det.description;
      if (det.ext) patch.ext = det.ext;
      if (det.genres?.length) patch.genres = det.genres;
      set(patch);
      setDismissed(patch.title ?? d.title);
      if (det.image && !d.poster) {
        const p = await savePosterFromUrl(det.image).catch(() => null);
        if (p) set({ poster: p.name, posterColor: p.color });
      }
      sound.confirm();
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="sec sec-work">
      <div className="work-main">
        <label className="field field-hero">
          <span className="field-label">Title</span>
          <input
            ref={titleRef}
            className="input-hero display"
            value={d.title}
            placeholder="What did you watch or play?"
            onChange={(e) => set({ title: e.target.value })}
            spellCheck={false}
          />
        </label>
        <div className="field">
          <span className="field-label">Type</span>
          <div className="type-tiles" role="radiogroup" aria-label="Type">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={d.type === t}
                className={'type-tile' + (d.type === t ? ' on' : '')}
                onClick={() => {
                  sound.click();
                  set({ type: t });
                }}
              >
                <Icon name={t} size={26} stroke={1.4} />
                <span>{TYPE_LABEL[t]}</span>
                {d.type === t && <motion.span layoutId="type-ring" className="type-ring" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence>
          {(loading || (results && results.length > 0)) && (
            <motion.div className="lookup" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="lookup-head">
                <Icon name="wand" size={15} />
                <span>{loading ? 'Looking it up…' : 'Pick the right one to fill in the poster, credits and description'}</span>
                {!loading && (
                  <button type="button" className="inline-link" onClick={() => setDismissed(d.title.trim())}>
                    No thanks
                  </button>
                )}
              </div>
              <div className="lookup-row">
                {(results ?? []).slice(0, 6).map((c) => (
                  <button key={c.id} type="button" className="lookup-card" disabled={!!applying} onClick={() => apply(c)}>
                    <span className="lookup-thumb">{c.thumb ? <img src={c.thumb} alt="" referrerPolicy="no-referrer" /> : <Icon name={c.type ?? 'movie'} size={20} />}</span>
                    <span className="lookup-text">
                      <span className="lookup-title">{c.title}</span>
                      <span className="lookup-desc">{c.description}</span>
                    </span>
                    {applying === c.id && <span className="pi-spinner small" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {results && results.length === 0 && !loading && d.title.trim().length > 2 && d.title.trim() !== dismissed && (
          <p className="lookup-none">No match online. Fill in the details yourself on the next step.</p>
        )}
      </div>
      <PosterInput title={d.title} type={d.type} poster={d.poster} onChange={(p) => set(p)} />
    </div>
  );
}

/* --------------------------------------------------------------- Credits */

export function CreditsSection({ d, set, autoFocus }: { d: DraftData; set: Patch; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus(), 200);
  }, [autoFocus]);
  const cast = splitCast(d.cast);
  return (
    <div className="sec sec-credits">
      <label className="field">
        <span className="field-label">{d.type === 'show' ? 'Director or creator' : d.type === 'game' ? 'Game director' : 'Director'}</span>
        <input ref={ref} className="input" value={d.director} placeholder={d.type === 'game' ? 'Who led the game?' : 'Who directed it?'} onChange={(e) => set({ director: e.target.value })} />
      </label>
      <label className="field">
        <span className="field-label">{d.type === 'game' ? 'Studio' : 'Producing studio'}</span>
        <input className="input" value={d.studio} placeholder={d.type === 'game' ? 'Which studio made it?' : 'Which studio produced it?'} onChange={(e) => set({ studio: e.target.value })} />
      </label>
      <label className="field">
        <span className="field-label">Cast</span>
        <AutoTextarea className="input" minRows={2} value={d.cast} placeholder="Names separated by commas" onChange={(e) => set({ cast: e.target.value })} />
        {cast.length > 0 && (
          <span className="cast cast-preview">
            {cast.map((p) => (
              <span key={p} className="cast-chip">
                {p}
              </span>
            ))}
          </span>
        )}
      </label>
    </div>
  );
}

/* ------------------------------------------------------------ Free text */

export function TextSection({
  value,
  onChange,
  label,
  placeholder,
  hint,
  autoFocus,
  big,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  hint?: string;
  autoFocus?: boolean;
  big?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus)
      setTimeout(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }, 200);
  }, [autoFocus]);
  return (
    <div className={'sec sec-text' + (big ? ' big' : '')}>
      <label className="field">
        <span className="field-label">{label}</span>
        <AutoTextarea ref={ref as any} className="input input-prose" minRows={big ? 8 : 5} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {hint && <span className="field-hint">{hint}</span>}
      </label>
    </div>
  );
}

/* ----------------------------------------------------------------- Score */

export function ScoreSection({ d, set, k, autoFocus, compact }: { d: DraftData; set: Patch; k: ScoreKey; autoFocus?: boolean; compact?: boolean }) {
  const def = SCORE_BY_KEY[k];
  const idx = SCORES.findIndex((s) => s.key === k);
  const v = d.scores[k];
  const total = totalOf(d.scores);
  const scored = SCORES.filter((s) => d.scores[s.key] !== null).length;
  const hint = def.hint[d.type ?? 'movie'];
  return (
    <div className={'sec sec-score' + (compact ? ' compact' : '')}>
      <div className="score-stage">
        <div className="score-head">
          <span className="score-count">
            {idx + 1} of 10
          </span>
          <h2 className="score-name display">{def.label}</h2>
          <p className="score-hint">{hint}</p>
        </div>
        <ScoreDial value={v} onChange={(n) => set({ scores: { ...d.scores, [k]: n } })} label={def.label} size={compact ? 300 : 360} autoFocus={autoFocus} />
        <p className="dial-help">Turn the ring, scroll, use the arrow keys, or type the number.</p>
        <label className="field note-field">
          <span className="field-label">Notes on {def.short.toLowerCase()}, if you like</span>
          <AutoTextarea
            className="input"
            minRows={2}
            value={d.scoreNotes[k] ?? ''}
            placeholder="A line to remember why you gave this score"
            onChange={(e) => set({ scoreNotes: { ...d.scoreNotes, [k]: e.target.value } })}
          />
        </label>
      </div>
      {!compact && (
        <aside className="score-side">
          <IrisChart scores={d.scores} cls={suggestClass(Math.round((total / Math.max(1, scored)) * 10))} size={220} highlight={k} animate={false} />
          <p className="score-side-total">
            <span className="display">{total}</span> so far, with {scored} of 10 scored
          </p>
        </aside>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Verdict */

export function VerdictSection({ d, set }: { d: DraftData; set: Patch }) {
  const total = totalOf(d.scores);
  const missing = SCORES.filter((s) => d.scores[s.key] === null);
  const suggested = suggestClass(total);
  const cls = d.classOverride ?? suggested;
  return (
    <div className="sec sec-verdict">
      <div className="vd-block vd-rating">
        <span className="field-label">Rating</span>
        <RatingRing value={total} cls={cls} size={220} />
        <p className="vd-note">
          {missing.length ? `${missing.length} score${missing.length === 1 ? ' is' : 's are'} still empty, so this isn’t final yet.` : 'All ten scores added up.'}
        </p>
      </div>
      <div className="vd-block vd-class">
        <span className="field-label">Class</span>
        <div className="vd-suggest">
          <ClassBadge cls={cls} size="lg" chosen={!!d.classOverride} />
          <p className="vd-note">
            {d.classOverride
              ? `You chose ${CLASS_BY_KEY[cls].label}. The rating suggests ${CLASS_BY_KEY[suggested].label}.`
              : `Suggested from the rating. ${CLASS_BY_KEY[suggested].label} covers ${suggested === 'masterpiece' ? '960 and up' : suggested === 'terrible' ? 'under 300' : `${CLASS_BY_KEY[suggested].min} to ${CLASS_BY_KEY[suggested].max}`}.`}
          </p>
        </div>
        <div className="class-picker">
          {CLASSES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`class-opt cls-opt-${c.key}` + (cls === c.key ? ' on' : '') + (suggested === c.key ? ' suggested' : '')}
              style={{ ['--c' as any]: CLASS_COLOR[c.key] }}
              onClick={() => {
                sound.click();
                set({ classOverride: c.key === suggested ? null : c.key });
              }}
            >
              <span className="class-opt-name">{c.label}</span>
              <span className="class-opt-range">{c.key === 'masterpiece' ? '960+' : c.key === 'terrible' ? '< 300' : `${c.min}–${c.max}`}</span>
            </button>
          ))}
        </div>
        {d.classOverride && (
          <button type="button" className="inline-link" onClick={() => set({ classOverride: null })}>
            <Icon name="undo" size={13} /> Go back to the suggested class
          </button>
        )}
      </div>
      <div className="vd-block vd-rec">
        <span className="field-label">Would you recommend it?</span>
        <div className="rec-pick">
          {(['yes', 'no'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={`rec-btn rec-${r}` + (d.recommend === r ? ' on' : '')}
              onClick={() => {
                sound.toggle(r === 'yes');
                set({ recommend: d.recommend === r ? null : r });
              }}
            >
              <Icon name={r === 'yes' ? 'thumbUp' : 'thumbDown'} size={26} stroke={1.5} />
              <span>{r === 'yes' ? 'Yes' : 'No'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Review */

export function ReviewSection({ d, onJump }: { d: DraftData; onJump: (field: string) => void }) {
  const total = totalOf(d.scores);
  const cls = d.classOverride ?? suggestClass(total);
  const missing = missingRequired(d);
  return (
    <div className="sec sec-review">
      <div className="review-card glass">
        <div className="review-poster">
          <Poster title={d.title || 'Untitled'} type={d.type ?? 'movie'} poster={d.poster} year={d.year} size="lg" />
        </div>
        <div className="review-info">
          <h2 className="review-title display">{d.title.trim() || 'Untitled'}</h2>
          <p className="review-type">
            <Icon name={d.type ?? 'movie'} size={15} /> {d.type ? TYPE_LABEL[d.type as MediaType] : 'Type not chosen'}
            {d.director && <span> directed by {d.director}</span>}
          </p>
          <div className="review-verdict">
            <span className="review-rating display" style={{ color: CLASS_COLOR[cls] }}>
              {total}
            </span>
            <ClassBadge cls={cls} size="md" chosen={!!d.classOverride} />
            {d.recommend && (
              <span className={'rec rec-' + d.recommend}>
                <Icon name={d.recommend === 'yes' ? 'thumbUp' : 'thumbDown'} size={18} /> {d.recommend === 'yes' ? 'Recommended' : 'Not recommended'}
              </span>
            )}
          </div>
          {d.finalRemarks.trim() && <p className="review-remarks">“{d.finalRemarks.trim()}”</p>}
          {missing.length > 0 ? (
            <div className="review-missing">
              <p>
                <Icon name="warning" size={15} /> To save, add:
              </p>
              <div className="chips">
                {missing.map((m) => (
                  <button key={m.field} type="button" className="chip chip-warn" onClick={() => onJump(m.field)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="review-ready">
              <Icon name="check" size={15} /> Everything needed is here.
            </p>
          )}
        </div>
        <div className="review-chart">
          <IrisChart scores={d.scores} cls={cls} size={200} />
        </div>
      </div>
    </div>
  );
}
