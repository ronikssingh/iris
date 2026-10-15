import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLibrary } from '../state/library';
import { useUi } from '../state/ui';
import { Icon } from '../components/Icon';
import { AutoTextarea, Button, Segmented } from '../components/ui';
import { CLASS_COLOR } from '../components/ClassBadge';
import { sound } from '../lib/sound';
import { Start, startDraft } from './editor/Start';
import { COMMENTS_STEP, STEPS, STEP_INDEX, stepDone, stepRequiredMissing, type StepId } from './editor/steps';
import { CreditsSection, ReviewSection, ScoreSection, TextSection, VerdictSection, WorkSection } from './editor/Sections';
import { SCORES, critiqueFromDraft, missingRequired, newId, suggestClass, totalOf, type Draft, type DraftData } from '../shared/model';

export function Editor({ draftId }: { draftId?: string }) {
  const drafts = useLibrary((s) => s.lib.drafts);
  const go = useUi((s) => s.go);

  useEffect(() => {
    if (draftId === 'new') {
      const d = startDraft();
      go({ name: 'write', draftId: d.id }, { replace: true });
    }
  }, [draftId, go]);

  // Once a critique is saved its draft is gone, but this page is still on screen while it slides away.
  // Holding on to the last copy keeps the writer in place instead of flashing the start screen.
  const last = useRef<Draft | null>(null);
  if (draftId === 'new') return null;
  if (!draftId) return <Start />;
  const draft = drafts.find((d) => d.id === draftId) ?? (last.current?.id === draftId ? last.current : null);
  if (!draft) return <Start />;
  last.current = draft;
  return <Writer key={draft.id} draft={draft} />;
}

function Writer({ draft }: { draft: Draft }) {
  const upsertDraft = useLibrary((s) => s.upsertDraft);
  const go = useUi((s) => s.go);
  const [step, setStep] = useState(Math.min(draft.step, STEPS.length - 1));
  const [mode, setMode] = useState<'steps' | 'page'>(draft.editingId ? 'page' : 'steps');
  const [drawer, setDrawer] = useState(false);
  const [returnTo, setReturnTo] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [dir, setDir] = useState(1);
  const [savedFlash, setSavedFlash] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);
  const d = draft.data;
  const editing = useLibrary((s) => (draft.editingId ? s.lib.critiques.find((c) => c.id === draft.editingId) : null));

  const set = useCallback(
    (p: Partial<DraftData>) => {
      const cur = useLibrary.getState().lib.drafts.find((x) => x.id === draft.id) ?? draft;
      upsertDraft({ ...cur, data: { ...cur.data, ...p }, updatedAt: Date.now() });
      setSavedFlash(Date.now());
    },
    [draft, upsertDraft],
  );

  const goStep = useCallback(
    (i: number, opts: { fromRail?: boolean } = {}) => {
      const n = Math.max(0, Math.min(STEPS.length - 1, i));
      if (n === step) return;
      if (opts.fromRail && n === COMMENTS_STEP && STEPS[step].score) setReturnTo(step);
      else if (n !== COMMENTS_STEP) setReturnTo(null);
      setDir(n > step ? 1 : -1);
      setStep(n);
      const cur = useLibrary.getState().lib.drafts.find((x) => x.id === draft.id);
      if (cur) upsertDraft({ ...cur, step: n });
      sound.whoosh(n > step ? 0.6 : -0.6);
      if (mode === 'page') document.getElementById('sec-' + STEPS[n].id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [step, draft.id, upsertDraft, mode],
  );

  const missing = useMemo(() => missingRequired(d), [d]);
  const total = totalOf(d.scores);
  const scored = SCORES.filter((s) => d.scores[s.key] !== null).length;

  const save = useCallback(() => {
    const miss = missingRequired(d);
    if (miss.length) {
      setTried(true);
      sound.error();
      useUi.getState().toast({ text: `Still needed: ${miss.map((m) => m.label).join(', ')}`, tone: 'bad' });
      const first = miss[0].field;
      goStep(first === 'title' || first === 'type' ? 0 : STEP_INDEX[first as StepId]);
      return;
    }
    const lib = useLibrary.getState();
    const existing = draft.editingId ? lib.lib.critiques.find((c) => c.id === draft.editingId) : null;
    const c = critiqueFromDraft(d, existing?.id ?? newId('c'), existing?.createdAt ?? Date.now());
    lib.upsertCritique(c);
    lib.removeDraft(draft.id);
    if (draft.watchId) {
      const w = lib.lib.watchlist.find((x) => x.id === draft.watchId);
      if (w) useLibrary.getState().removeWatch(w.id);
      useLibrary.setState((st) => ({ lib: { ...st.lib, trash: st.lib.trash.filter((t) => t.id !== draft.watchId) } }));
    }
    const cls = c.classOverride ?? suggestClass(total);
    sound.verdict(cls);
    useUi.setState({ celebrate: { id: c.id, title: c.title, total, cls, poster: c.poster, type: c.type, edited: !!existing } });
    go({ name: 'detail', id: c.id }, { replace: true });
  }, [d, draft, goStep, total, go]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUi.getState().celebrate || useUi.getState().modal) return;
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const inText = target.tagName === 'TEXTAREA';
      const inInput = target.tagName === 'INPUT';
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      } else if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setDrawer((v) => !v);
      } else if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (step === STEPS.length - 1) save();
        else goStep(step + 1);
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goStep(step + 1);
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goStep(step - 1);
      } else if (e.key === 'Enter' && inInput && mode === 'steps' && (target as HTMLInputElement).type !== 'url') {
        e.preventDefault();
        goStep(step + 1);
      } else if (e.key === 'Enter' && !inText && !inInput && STEPS[step].score && target.classList.contains('dial')) {
        e.preventDefault();
        goStep(step + 1);
      } else if (e.key === 'Escape' && drawer) {
        setDrawer(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, goStep, save, drawer, mode]);

  // one-page mode: keep the rail in sync with the section in view
  useEffect(() => {
    if (mode !== 'page') return;
    const root = pageRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) {
          const id = vis.target.id.replace('sec-', '') as StepId;
          setStep(STEP_INDEX[id]);
        }
      },
      { root, rootMargin: '-20% 0px -60% 0px' },
    );
    root.querySelectorAll('.page-sec').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [mode]);

  const s = STEPS[step];
  const jumpField = (field: string) => goStep(field === 'title' || field === 'type' ? 0 : STEP_INDEX[field as StepId]);

  const section = (id: StepId, autoFocus: boolean, compact = false) => {
    switch (id) {
      case 'work':
        return <WorkSection d={d} set={set} autoFocus={autoFocus} />;
      case 'credits':
        return <CreditsSection d={d} set={set} autoFocus={autoFocus} />;
      case 'description':
        return (
          <TextSection
            label="Description"
            value={d.description}
            onChange={(v) => set({ description: v })}
            placeholder="What is it about?"
            hint="A short synopsis. If you filled it from Wikipedia, trim it to taste."
            autoFocus={autoFocus}
          />
        );
      case 'comments':
        return (
          <TextSection
            label="Personal comments"
            value={d.comments}
            onChange={(v) => set({ comments: v })}
            placeholder="Your thoughts, as messy as you like. You can come back here from any score."
            hint="Press ⌘J on any score to open these comments beside the ring."
            autoFocus={autoFocus}
            big
          />
        );
      case 'verdict':
        return <VerdictSection d={d} set={set} />;
      case 'remarks':
        return (
          <TextSection
            label="Final remarks"
            value={d.finalRemarks}
            onChange={(v) => set({ finalRemarks: v })}
            placeholder="Your verdict in a sentence or two."
            autoFocus={autoFocus}
          />
        );
      case 'review':
        return <ReviewSection d={d} onJump={jumpField} />;
      default:
        return <ScoreSection d={d} set={set} k={id as any} autoFocus={autoFocus} compact={compact} />;
    }
  };

  const nextLabel = step < STEPS.length - 1 ? STEPS[step + 1].label : null;
  const saveLabel = draft.editingId ? 'Save changes' : 'Save critique';

  return (
    <div className={'page editor mode-' + mode + (drawer ? ' drawer-open' : '')}>
      <header className="editor-head">
        <Button variant="quiet" icon="close" aria-label="Close" onClick={() => {
          useUi.getState().toast({ text: 'Draft kept. Continue it any time from Write.' });
          go(editing ? { name: 'detail', id: editing.id } : { name: 'lobby' });
        }} />
        <div className="editor-title">
          <span className="editor-kicker">{editing ? 'Editing' : 'New critique'}</span>
          <span className="editor-name">{d.title.trim() || 'Untitled'}</span>
        </div>
        <SavedDot k={savedFlash} />
        <div className="editor-head-right">
          <Segmented
            id="emode"
            size="sm"
            value={mode}
            onChange={(m) => {
              setMode(m);
              if (m === 'page') setTimeout(() => document.getElementById('sec-' + STEPS[step].id)?.scrollIntoView({ block: 'start' }), 60);
            }}
            options={[
              { value: 'steps', label: 'Step by step' },
              { value: 'page', label: 'One page' },
            ]}
          />
          <Button variant={drawer ? 'primary' : 'glass'} icon="note" onClick={() => setDrawer((v) => !v)} title="Personal comments (⌘J)">
            Comments
          </Button>
          <Button variant="primary" icon="check" onClick={save} disabled={false}>
            {saveLabel}
          </Button>
        </div>
      </header>

      <div className="editor-body">
        <nav className="rail" aria-label="Steps">
          {(['about', 'scores', 'verdict'] as const).map((g) => (
            <div key={g} className="rail-group">
              <span className="rail-group-label">{g === 'about' ? 'About it' : g === 'scores' ? 'The ten scores' : 'Verdict'}</span>
              {STEPS.map((st, i) =>
                st.group !== g ? null : (
                  <button
                    key={st.id}
                    type="button"
                    className={'rail-step' + (i === step ? ' on' : '') + (stepDone(d, st) ? ' done' : '') + (tried && stepRequiredMissing(d, st) ? ' missing' : '')}
                    onClick={() => goStep(i, { fromRail: true })}
                  >
                    {i === step && <motion.span layoutId="rail-on" className="rail-on" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <span className="rail-dot" />
                    <span className="rail-label" title={st.label}>{st.score ? SCORES.find((x) => x.key === st.score)!.short : st.short ?? st.label}</span>
                    {st.score && d.scores[st.score] !== null && <span className="rail-val">{d.scores[st.score]}</span>}
                  </button>
                ),
              )}
            </div>
          ))}
        </nav>

        {mode === 'steps' ? (
          <div className="stepper">
            <AnimatePresence mode="popLayout" custom={dir} initial={false}>
              <motion.div
                key={s.id}
                className="step"
                custom={dir}
                initial={{ opacity: 0, x: dir * 60, filter: 'blur(10px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -dir * 60, filter: 'blur(10px)', pointerEvents: 'none' }}
                transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {section(s.id, true)}
              </motion.div>
            </AnimatePresence>
            <AnimatePresence>
              {returnTo !== null && step === COMMENTS_STEP && (
                <motion.button
                  type="button"
                  className="return-pill"
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  onClick={() => {
                    const r = returnTo;
                    setReturnTo(null);
                    goStep(r);
                  }}
                >
                  <Icon name="undo" size={15} /> Back to {SCORES.find((x) => x.key === STEPS[returnTo].score)?.label}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="onepage" ref={pageRef}>
            {STEPS.map((st) => (
              <section key={st.id} id={'sec-' + st.id} className={'page-sec' + (st.score ? ' is-score' : '')}>
                {!st.score && <h2 className="page-sec-title">{st.label}</h2>}
                {section(st.id, false, true)}
              </section>
            ))}
          </div>
        )}

        <AnimatePresence>
          {drawer && (
            <motion.aside
              className="drawer glass"
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            >
              <div className="drawer-head">
                <h3>Personal comments</h3>
                <Button variant="quiet" icon="close" size="sm" aria-label="Close comments" onClick={() => setDrawer(false)} />
              </div>
              <AutoTextarea
                className="input input-prose"
                minRows={14}
                autoFocus
                value={d.comments}
                placeholder="Jot thoughts down while you score. They live in Personal comments."
                onChange={(e) => set({ comments: e.target.value })}
              />
              {STEPS[step].score && <p className="drawer-hint">You’re on {SCORES.find((x) => x.key === STEPS[step].score)?.label}. Close this to keep scoring right where you were.</p>}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {mode === 'steps' && (
        <footer className="editor-foot glass">
          <Button variant="ghost" icon="left" disabled={step === 0} onClick={() => goStep(step - 1)}>
            Back
          </Button>
          <div className="foot-meter">
            <span className="foot-step">
              Step {step + 1} of {STEPS.length}
            </span>
            <div className="foot-track">
              <motion.span className="foot-fill" animate={{ width: `${(scored / 10) * 100}%` }} style={{ background: scored === 10 ? CLASS_COLOR[d.classOverride ?? suggestClass(total)] : 'var(--accent)' }} />
            </div>
            <span className="foot-total">
              <b className="display">{total}</b> / 1000 with {scored} of 10 scored
              {missing.length === 0 && <span className="foot-ready"> ready to save</span>}
            </span>
          </div>
          {nextLabel ? (
            <Button variant="primary" iconRight="right" onClick={() => goStep(step + 1)}>
              {nextLabel.length > 22 ? 'Next' : `Next: ${nextLabel}`}
            </Button>
          ) : (
            <Button variant="primary" icon="check" onClick={save}>
              {saveLabel}
            </Button>
          )}
        </footer>
      )}

    </div>
  );
}

function SavedDot({ k }: { k: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!k) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1600);
    return () => clearTimeout(t);
  }, [k]);
  return (
    <span className={'saved-dot' + (show ? ' on' : '')}>
      <Icon name="check" size={13} /> Draft saved
    </span>
  );
}
