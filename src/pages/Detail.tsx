import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { useLibrary } from '../state/library';
import { useSettings } from '../state/settings';
import { useUi } from '../state/ui';
import { Poster } from '../components/Poster';
import { ClassBadge, CLASS_COLOR } from '../components/ClassBadge';
import { RatingRing } from '../components/RatingRing';
import { IrisChart } from '../components/IrisChart';
import { Icon } from '../components/Icon';
import { Button, Empty, Popover } from '../components/ui';
import { scoreHue } from '../components/ScoreDial';
import { mediaUrl } from '../lib/images';
import { longDate, splitCast } from '../lib/format';
import { groupCritiques, matches } from '../lib/sorting';
import { sound } from '../lib/sound';
import { CLASS_BY_KEY, SCORES, TYPE_LABEL, classOf, draftFromCritique, newId, ratingOf, suggestClass, type Critique } from '../shared/model';

export function Detail({ id }: { id: string }) {
  const crits = useLibrary((s) => s.lib.critiques);
  const c = crits.find((x) => x.id === id);
  const prefs = useSettings((s) => s.s.archive);
  const filters = useUi((s) => s.filters);
  const go = useUi((s) => s.go);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtn = useRef<HTMLButtonElement>(null);

  const order = useMemo(() => {
    const vis = crits.filter((x) => matches(x, filters));
    const list = vis.some((x) => x.id === id) ? vis : crits;
    return groupCritiques(list, prefs.groupBy, prefs.sort).flatMap((g) => g.items);
  }, [crits, filters, prefs, id]);
  const pos = order.findIndex((x) => x.id === id);
  const prev = pos > 0 ? order[pos - 1] : null;
  const next = pos >= 0 && pos < order.length - 1 ? order[pos + 1] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || useUi.getState().modal) return;
      if (e.key === 'ArrowLeft' && prev) go({ name: 'detail', id: prev.id }, { replace: true });
      else if (e.key === 'ArrowRight' && next) go({ name: 'detail', id: next.id }, { replace: true });
      else if (e.key === 'Escape') go({ name: 'archive' });
      else if (e.key.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey && c) edit(c);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!c)
    return (
      <div className="page detail">
        <Empty icon="info" title="This critique isn’t here any more" action={<Button onClick={() => go({ name: 'archive' })}>Back to your critiques</Button>}>
          It may have been deleted. Deleted critiques stay in Settings, under Recently deleted, for 30 days.
        </Empty>
      </div>
    );

  const cls = classOf(c);
  const rating = ratingOf(c);
  const suggested = suggestClass(rating);
  const color = c.posterColor ?? CLASS_COLOR[cls];
  const cast = splitCast(c.cast);

  function edit(cr: Critique) {
    const lib = useLibrary.getState();
    const existing = lib.lib.drafts.find((d) => d.editingId === cr.id);
    if (existing) return go({ name: 'write', draftId: existing.id });
    const d = { id: newId('d'), data: draftFromCritique(cr), step: 0, editingId: cr.id, watchId: null, createdAt: Date.now(), updatedAt: Date.now() };
    lib.upsertDraft(d);
    go({ name: 'write', draftId: d.id });
  }

  const remove = () => {
    setMoreOpen(false);
    useUi.getState().openModal({
      title: `Delete ${c.title}?`,
      body: <p>It moves to Recently deleted in Settings, where you can bring it back for 30 days.</p>,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Delete',
          tone: 'danger',
          run: () => {
            const entry = useLibrary.getState().removeCritique(c.id);
            sound.remove();
            go({ name: 'archive' });
            useUi.getState().toast({
              text: `Deleted ${c.title}`,
              action: entry ? { label: 'Undo', run: () => useLibrary.getState().restoreTrash(entry.id) } : undefined,
            });
          },
        },
      ],
    });
  };

  const duplicate = () => {
    setMoreOpen(false);
    const d = { id: newId('d'), data: { ...draftFromCritique(c), title: c.title + ' (copy)' }, step: 0, editingId: null, watchId: null, createdAt: Date.now(), updatedAt: Date.now() };
    useLibrary.getState().upsertDraft(d);
    go({ name: 'write', draftId: d.id });
  };

  const poster = mediaUrl(c.poster);

  return (
    <div className={`page detail detail-${cls}`} style={{ ['--tint' as any]: color }}>
      {poster && <div className="detail-backdrop" style={{ backgroundImage: `url("${poster}")` }} />}
      <div className="detail-bar">
        <Button variant="quiet" icon="back" onClick={() => go({ name: 'archive' })}>
          Critiques
        </Button>
        <div className="detail-bar-right">
          <span className="detail-pos">{pos >= 0 ? `${pos + 1} of ${order.length}` : ''}</span>
          <Button variant="glass" icon="left" disabled={!prev} title={prev ? `Previous: ${prev.title}` : undefined} onClick={() => prev && go({ name: 'detail', id: prev.id }, { replace: true })} />
          <Button variant="glass" icon="right" disabled={!next} title={next ? `Next: ${next.title}` : undefined} onClick={() => next && go({ name: 'detail', id: next.id }, { replace: true })} />
          <Button variant="glass" icon="edit" onClick={() => edit(c)}>
            Edit
          </Button>
          <Button ref={moreBtn} variant="glass" icon="more" aria-label="More" onClick={() => setMoreOpen((v) => !v)} />
          <Popover open={moreOpen} onClose={() => setMoreOpen(false)} anchor={moreBtn} align="end" width={230}>
            <div className="menu">
              <button type="button" className="menu-item" onClick={duplicate}>
                <Icon name="copy" size={15} /> Duplicate as a new draft
              </button>
              <button type="button" className="menu-item danger" onClick={remove}>
                <Icon name="trash" size={15} /> Delete
              </button>
            </div>
          </Popover>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-poster-col">
          <motion.div layoutId={'poster-' + c.id} className={`detail-poster cls-frame-${cls}`} transition={{ type: 'spring', stiffness: 260, damping: 32 }}>
            <Poster title={c.title} type={c.type} poster={c.poster} year={c.year} size="xl" />
            {cls === 'masterpiece' && <span className="gold-sheen" />}
          </motion.div>
        </div>

        <article className="detail-body">
          <header className="detail-head">
            <motion.h1 className="detail-title display" initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
              {c.title}
            </motion.h1>
            <p className="detail-type">
              <Icon name={c.type} size={16} /> {TYPE_LABEL[c.type]}
              {c.year && <span className="detail-year">{c.year}</span>}
            </p>
          </header>

          <dl className="credits">
            <Field label={c.type === 'show' ? 'Director or creator' : c.type === 'game' ? 'Game director' : 'Director'} value={c.director} />
            <Field label={c.type === 'game' ? 'Studio' : 'Producing studio'} value={c.studio} />
            <div className="credit">
              <dt>Cast</dt>
              <dd>{cast.length ? <span className="cast">{cast.map((p) => <span key={p} className="cast-chip">{p}</span>)}</span> : <span className="none">Not added</span>}</dd>
            </div>
          </dl>

          <Prose label="Description" text={c.description} />
          <Prose label="Personal comments" text={c.comments} big />

          <section className="scores-block">
            <h2 className="block-title display">The scores</h2>
            <div className="scores-layout">
              <div className="scores-chart">
                <IrisChart scores={c.scores} cls={cls} size={260} />
              </div>
              <ol className="score-rows">
                {SCORES.map((s, i) => (
                  <ScoreRow key={s.key} label={s.label} value={c.scores[s.key]} note={c.scoreNotes[s.key]} index={i} />
                ))}
              </ol>
            </div>
          </section>

          <section className="verdict">
            <div className="verdict-item verdict-rating">
              <h3>Rating</h3>
              <InViewRing value={rating} cls={cls} />
            </div>
            <div className="verdict-item">
              <h3>Class</h3>
              <ClassBadge cls={cls} size="lg" chosen={!!c.classOverride} />
              <p className="verdict-note">
                {c.classOverride
                  ? suggested === cls
                    ? 'Chosen by you, and the rating agrees.'
                    : `Chosen by you. The rating alone would make it ${CLASS_BY_KEY[suggested].label}.`
                  : `Suggested by the rating: ${CLASS_BY_KEY[cls].label} covers ${CLASS_BY_KEY[cls].min}${cls === 'masterpiece' ? ' and up' : `–${CLASS_BY_KEY[cls].max}`}.`}
              </p>
            </div>
            <div className="verdict-item">
              <h3>Recommend</h3>
              {c.recommend ? (
                <span className={'rec rec-' + c.recommend}>
                  <Icon name={c.recommend === 'yes' ? 'thumbUp' : 'thumbDown'} size={22} /> {c.recommend === 'yes' ? 'Yes' : 'No'}
                </span>
              ) : (
                <span className="none">Not answered</span>
              )}
            </div>
          </section>

          <section className="remarks">
            <h3>Final remarks</h3>
            {c.finalRemarks.trim() ? (
              <blockquote className="remarks-quote display">
                <Icon name="quote" size={34} className="remarks-mark" />
                {c.finalRemarks}
              </blockquote>
            ) : (
              <p className="none">No final remarks.</p>
            )}
          </section>

          <footer className="detail-foot">
            Added {longDate(c.createdAt)}
            {c.updatedAt - c.createdAt > 60000 && `, last edited ${longDate(c.updatedAt)}`}.
          </footer>
        </article>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="credit">
      <dt>{label}</dt>
      <dd>{value.trim() ? value : <span className="none">Not added</span>}</dd>
    </div>
  );
}

function Prose({ label, text, big }: { label: string; text: string; big?: boolean }) {
  return (
    <section className={'prose-block' + (big ? ' big' : '')}>
      <h3>{label}</h3>
      {text.trim() ? <p className="prose">{text}</p> : <p className="none">Nothing written.</p>}
    </section>
  );
}

function ScoreRow({ label, value, note, index }: { label: string; value: number; note?: string; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const seen = useInView(ref, { once: true, margin: '-40px' });
  return (
    <li ref={ref} className="score-row">
      <div className="score-line">
        <span className="score-label">{label}</span>
        <span className="score-val" style={{ color: scoreHue(value) }}>
          {value}
        </span>
      </div>
      <div className="score-bar">
        <motion.span
          style={{ background: scoreHue(value) }}
          initial={{ width: 0 }}
          animate={{ width: seen ? `${value}%` : 0 }}
          transition={{ duration: 0.9, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      {note && <p className="score-note">{note}</p>}
    </li>
  );
}

function InViewRing({ value, cls }: { value: number; cls: ReturnType<typeof classOf> }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: '-60px' });
  return (
    <div ref={ref}>
      <RatingRing value={value} cls={cls} size={190} run={seen} />
    </div>
  );
}
