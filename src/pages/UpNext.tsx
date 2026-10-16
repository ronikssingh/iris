import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLibrary } from '../state/library';
import { useUi } from '../state/ui';
import { Poster } from '../components/Poster';
import { Icon } from '../components/Icon';
import { Button, Segmented } from '../components/ui';
import { startDraft } from './editor/Start';
import { savePosterFromUrl } from '../lib/images';
import { sound } from '../lib/sound';
import { TYPE_LABEL, newId, type MediaType, type WatchItem, type WatchStatus } from '../shared/model';
import type { LookupCandidate } from '../shared/ipc';

export function UpNext() {
  const watch = useLibrary((s) => s.lib.watchlist);
  const crits = useLibrary((s) => s.lib.critiques);
  const want = useMemo(() => watch.filter((w) => w.status === 'want').sort((a, b) => a.order - b.order), [watch]);
  const watched = useMemo(() => watch.filter((w) => w.status === 'watched').sort((a, b) => a.order - b.order), [watch]);
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="page upnext">
      <header className="page-head">
        <div>
          <h1 className="page-title display">Up next</h1>
          <p className="page-sub">What you want to watch or play, and what you’ve finished but haven’t judged yet.</p>
        </div>
      </header>

      <AddBar existing={watch} critiqued={crits.map((c) => c.type + '|' + c.title.toLowerCase())} />

      <div className="columns">
        <Column status="want" title="Want to watch" empty="Add anything you’re looking forward to. Drag it across when you’ve seen it." items={want} dragId={dragId} setDragId={setDragId} />
        <Column status="watched" title="Watched, needs a critique" empty="Finished something? Move it here and it will wait in Write until you review it." items={watched} dragId={dragId} setDragId={setDragId} />
      </div>
    </div>
  );
}

function AddBar({ existing, critiqued }: { existing: WatchItem[]; critiqued: string[] }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MediaType>('movie');
  const [status, setStatus] = useState<WatchStatus>('want');
  const [results, setResults] = useState<LookupCandidate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const req = useRef(0);
  const upsert = useLibrary((s) => s.upsertWatch);
  const toast = useUi((s) => s.toast);

  useEffect(() => {
    const f = () => inputRef.current?.focus();
    window.addEventListener('iris:add-watch', f);
    return () => window.removeEventListener('iris:add-watch', f);
  }, []);

  useEffect(() => {
    const q = title.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const id = ++req.current;
    const t = setTimeout(async () => {
      const r = await window.iris.lookup.search(q, type).catch(() => []);
      if (id === req.current) setResults(r.slice(0, 5));
    }, 600);
    return () => clearTimeout(t);
  }, [title, type]);

  const add = async (c?: LookupCandidate) => {
    const t = (c ? c.title.replace(/\s*\([^)]*\)\s*$/, '') : title).trim();
    if (!t) return;
    const key = (c?.type ?? type) + '|' + t.toLowerCase();
    if (existing.some((w) => w.type + '|' + w.title.toLowerCase() === key)) {
      toast({ text: `${t} is already on the list` });
      return;
    }
    if (critiqued.includes(key)) toast({ text: `Heads up: you’ve already critiqued ${t}` });
    setBusy(c?.id ?? 'plain');
    const order = Math.max(-1, ...existing.filter((w) => w.status === status).map((w) => w.order)) + 1;
    const item: WatchItem = {
      id: newId('w'),
      title: t,
      type: c?.type ?? type,
      status,
      note: '',
      poster: null,
      posterColor: null,
      year: c?.year ?? '',
      director: '',
      studio: '',
      cast: '',
      description: '',
      order,
      addedAt: Date.now(),
      updatedAt: Date.now(),
    };
    upsert(item);
    sound.confirm();
    setTitle('');
    setResults([]);
    setBusy(null);
    if (c) {
      // fetch the details in the background so the critique can start pre-filled later
      try {
        const det = await window.iris.lookup.details(c);
        const poster = det.image ? await savePosterFromUrl(det.image).catch(() => null) : null;
        const cur = useLibrary.getState().lib.watchlist.find((w) => w.id === item.id);
        if (cur)
          upsert({
            ...cur,
            title: det.title || cur.title,
            year: det.year || cur.year,
            director: det.director,
            studio: det.studio,
            cast: det.cast,
            description: det.description,
            poster: poster?.name ?? null,
            posterColor: poster?.color ?? null,
          });
      } catch {
        /* the plain entry is still there */
      }
    }
  };

  return (
    <div className="addbar glass">
      <div className="addbar-row">
        <Icon name="plus" size={18} />
        <input
          ref={inputRef}
          className="addbar-input"
          value={title}
          placeholder="Add a movie, show or game"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void add();
            }
          }}
        />
        <Segmented
          id="addtype"
          size="sm"
          value={type}
          onChange={setType}
          options={[
            { value: 'movie', label: 'Movie', icon: 'movie' },
            { value: 'show', label: 'Show', icon: 'show' },
            { value: 'game', label: 'Game', icon: 'game' },
          ]}
        />
        <Segmented
          id="addstatus"
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'want', label: 'Want to watch' },
            { value: 'watched', label: 'Watched' },
          ]}
        />
        <Button variant="primary" onClick={() => void add()} disabled={!title.trim() || !!busy}>
          Add
        </Button>
      </div>
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div className="addbar-results" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {results.map((c) => (
              <button key={c.id} type="button" className="lookup-card" disabled={!!busy} onClick={() => void add(c)}>
                <span className="lookup-thumb">{c.thumb ? <img src={c.thumb} alt="" referrerPolicy="no-referrer" /> : <Icon name={c.type ?? 'movie'} size={18} />}</span>
                <span className="lookup-text">
                  <span className="lookup-title">{c.title}</span>
                  <span className="lookup-desc">{c.description}</span>
                </span>
                {busy === c.id && <span className="pi-spinner small" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Column({
  status,
  title,
  empty,
  items,
  dragId,
  setDragId,
}: {
  status: WatchStatus;
  title: string;
  empty: string;
  items: WatchItem[];
  dragId: string | null;
  setDragId: (id: string | null) => void;
}) {
  const move = useLibrary((s) => s.moveWatch);
  const [over, setOver] = useState(false);
  return (
    <section
      className={`column column-${status}` + (over ? ' over' : '')}
      onDragOver={(e) => {
        if (!dragId) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (dragId) {
          move(dragId, status, null);
          sound.whoosh(status === 'watched' ? 1 : -1);
        }
        setDragId(null);
      }}
    >
      <header className="column-head">
        <h2 className="display">{title}</h2>
        <span className="column-count">{items.length}</span>
      </header>
      <div className="column-list">
        <AnimatePresence initial={false}>
          {items.map((w) => (
            <WatchCard key={w.id} w={w} dragId={dragId} setDragId={setDragId} />
          ))}
        </AnimatePresence>
        {items.length === 0 && <p className="column-empty">{empty}</p>}
      </div>
    </section>
  );
}

function WatchCard({ w, dragId, setDragId }: { w: WatchItem; dragId: string | null; setDragId: (id: string | null) => void }) {
  const move = useLibrary((s) => s.moveWatch);
  const upsert = useLibrary((s) => s.upsertWatch);
  const remove = useLibrary((s) => s.removeWatch);
  const restore = useLibrary((s) => s.restoreTrash);
  const go = useUi((s) => s.go);
  const toast = useUi((s) => s.toast);
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(w.note);
  const hasDraft = useLibrary((s) => s.lib.drafts.some((d) => d.watchId === w.id && !d.editingId));

  return (
    <motion.div
      layout
      className={'watch' + (dragId === w.id ? ' dragging' : '')}
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: 40 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      draggable
      onDragStart={(e: any) => {
        setDragId(w.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setDragId(null)}
      onDragOver={(e: any) => {
        if (dragId && dragId !== w.id) e.preventDefault();
      }}
      onDrop={(e: any) => {
        if (!dragId || dragId === w.id) return;
        e.preventDefault();
        e.stopPropagation();
        move(dragId, w.status, w.id);
        setDragId(null);
      }}
    >
      <span className="watch-grip" aria-hidden="true">
        <Icon name="grip" size={14} />
      </span>
      <Poster title={w.title} type={w.type} poster={w.poster} size="sm" />
      <div className="watch-text">
        <span className="watch-title">{w.title}</span>
        <span className="watch-meta">
          <Icon name={w.type} size={13} />
          <span>
            {TYPE_LABEL[w.type]}
            {w.year ? `, ${w.year}` : ''}
          </span>
        </span>
        {editingNote ? (
          <input
            className="watch-note-input"
            autoFocus
            value={note}
            placeholder="A note, like who recommended it"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              setEditingNote(false);
              if (note !== w.note) upsert({ ...w, note, updatedAt: Date.now() });
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <button type="button" className="watch-note" onClick={() => setEditingNote(true)}>
            {w.note || 'Add a note'}
          </button>
        )}
      </div>
      <div className="watch-actions">
        <Button
          size="sm"
          variant="primary"
          icon="pen"
          onClick={() => {
            const d = startDraft(w);
            go({ name: 'write', draftId: d.id });
          }}
        >
          {hasDraft ? 'Continue critique' : 'Write critique'}
        </Button>
        <Button
          size="sm"
          variant="glass"
          icon={w.status === 'want' ? 'check' : 'undo'}
          title={w.status === 'want' ? 'Mark as watched' : 'Move back to want to watch'}
          onClick={() => {
            move(w.id, w.status === 'want' ? 'watched' : 'want');
            sound.whoosh(w.status === 'want' ? 1 : -1);
          }}
        >
          {w.status === 'want' ? 'Watched it' : 'Not yet'}
        </Button>
        <Button
          size="sm"
          variant="quiet"
          icon="trash"
          aria-label="Remove"
          onClick={() => {
            const entry = remove(w.id);
            sound.remove();
            toast({ text: `Removed ${w.title}`, action: entry ? { label: 'Undo', run: () => restore(entry.id) } : undefined });
          }}
        />
      </div>
    </motion.div>
  );
}
