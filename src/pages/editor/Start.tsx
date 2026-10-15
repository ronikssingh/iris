import { motion } from 'motion/react';
import { useLibrary } from '../../state/library';
import { useUi } from '../../state/ui';
import { Poster } from '../../components/Poster';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/ui';
import { relTime } from '../../lib/format';
import { sound } from '../../lib/sound';
import { SCORES, TYPE_LABEL, draftFromWatch, emptyDraftData, newId, type Draft, type WatchItem } from '../../shared/model';

export function startDraft(from?: WatchItem): Draft {
  // one draft per Up Next item: picking it again carries on where you left off
  if (from) {
    const open = useLibrary.getState().lib.drafts.find((x) => x.watchId === from.id && !x.editingId);
    if (open) return open;
  }
  const d: Draft = {
    id: newId('d'),
    data: from ? draftFromWatch(from) : emptyDraftData(),
    step: from ? 1 : 0,
    editingId: null,
    watchId: from?.id ?? null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  useLibrary.getState().upsertDraft(d);
  return d;
}

export function Start() {
  const lib = useLibrary((s) => s.lib);
  const go = useUi((s) => s.go);
  // anything already being written shows up once, under drafts
  const drafting = new Set(lib.drafts.map((d) => d.watchId).filter(Boolean));
  const watched = lib.watchlist.filter((w) => w.status === 'watched' && !drafting.has(w.id)).sort((a, b) => a.order - b.order);
  const want = lib.watchlist.filter((w) => w.status === 'want' && !drafting.has(w.id)).sort((a, b) => a.order - b.order);
  const drafts = [...lib.drafts].sort((a, b) => b.updatedAt - a.updatedAt);

  const begin = (w?: WatchItem) => {
    sound.click();
    const d = startDraft(w);
    go({ name: 'write', draftId: d.id }, { replace: true });
  };

  const discard = (d: Draft) => {
    useUi.getState().openModal({
      title: 'Discard this draft?',
      body: <p>{d.data.title.trim() ? `Your unfinished critique of ${d.data.title.trim()} will be removed.` : 'This unfinished critique will be removed.'}</p>,
      actions: [{ label: 'Keep it' }, { label: 'Discard', tone: 'danger', run: () => useLibrary.getState().removeDraft(d.id) }],
    });
  };

  return (
    <div className="page write-start">
      <header className="page-head">
        <div>
          <h1 className="page-title display">Write a critique</h1>
          <p className="page-sub">Start from nothing, or pick something you’ve already lined up.</p>
        </div>
      </header>

      <div className="start-grid">
        <motion.button type="button" className="start-new glass" whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} onPointerEnter={() => sound.hover()} onClick={() => begin()}>
          <span className="start-new-icon">
            <Icon name="plus" size={30} stroke={1.3} />
          </span>
          <span className="start-new-title display">New critique</span>
          <span className="start-new-sub">Title, credits, your thoughts, ten scores and the verdict.</span>
        </motion.button>

        <div className="start-lists">
          {drafts.length > 0 && (
            <section className="start-list">
              <h2>Drafts in progress</h2>
              {drafts.map((d) => {
                const n = SCORES.filter((s) => d.data.scores[s.key] !== null).length;
                return (
                  <div key={d.id} className="start-item">
                    <Poster title={d.data.title || 'Untitled'} type={d.data.type ?? 'movie'} poster={d.data.poster} size="sm" />
                    <div className="start-item-text">
                      <span className="start-item-title">{d.data.title.trim() || 'Untitled critique'}</span>
                      <span className="start-item-sub">
                        {d.editingId ? 'Editing a saved critique' : `${n} of 10 scores`}, last touched {relTime(d.updatedAt)}
                      </span>
                    </div>
                    <Button size="sm" variant="primary" onClick={() => go({ name: 'write', draftId: d.id }, { replace: true })}>
                      Continue
                    </Button>
                    <Button size="sm" variant="quiet" icon="trash" aria-label="Discard draft" onClick={() => discard(d)} />
                  </div>
                );
              })}
            </section>
          )}
          <section className="start-list">
            <h2>Watched, waiting for a critique</h2>
            {watched.length ? (
              watched.map((w) => <WatchPick key={w.id} w={w} onPick={() => begin(w)} />)
            ) : (
              <p className="start-empty">When you finish something on your Up Next list, mark it watched and it will wait here.</p>
            )}
          </section>
          <section className="start-list">
            <h2>Want to watch</h2>
            {want.length ? (
              want.map((w) => <WatchPick key={w.id} w={w} onPick={() => begin(w)} />)
            ) : (
              <p className="start-empty">
                Nothing lined up.{' '}
                <button type="button" className="inline-link" onClick={() => go({ name: 'upnext' })}>
                  Add something to Up Next
                </button>
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function WatchPick({ w, onPick }: { w: WatchItem; onPick: () => void }) {
  return (
    <button type="button" className="start-item pick" onPointerEnter={() => sound.hover()} onClick={onPick}>
      <Poster title={w.title} type={w.type} poster={w.poster} size="sm" />
      <span className="start-item-text">
        <span className="start-item-title">{w.title}</span>
        <span className="start-item-sub">
          <Icon name={w.type} size={13} /> {TYPE_LABEL[w.type]}
          {w.year ? `, ${w.year}` : ''}
          {w.note ? `. ${w.note}` : ''}
        </span>
      </span>
      <span className="start-item-go">
        Write about it <Icon name="right" size={15} />
      </span>
    </button>
  );
}
