import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useOnline, onlineActions, nameOf, tasteMatch } from '../state/online';
import { useUi } from '../state/ui';
import { useLibrary } from '../state/library';
import type { SharedCritique } from '../online/api';
import { Avatar, LikeButton, Replies } from '../components/social';
import { Poster } from '../components/Poster';
import { ClassBadge, CLASS_COLOR } from '../components/ClassBadge';
import { IrisChart } from '../components/IrisChart';
import { Icon } from '../components/Icon';
import { Button, Empty, Popover, Segmented } from '../components/ui';
import { scoreHue } from '../components/ScoreDial';
import { longDate, relTime, splitCast } from '../lib/format';
import { sound } from '../lib/sound';
import { addToUpNext, extFromKey, whereIs } from '../lib/watch';
import { startDraft } from './editor/Start';
import { SCORES, TYPE_LABEL, ratingOf, classOf } from '../shared/model';

export function FriendProfile({ id, critique }: { id: string; critique?: string }) {
  const go = useUi((s) => s.go);
  const person = useOnline((s) => s.people[id]);
  const phase = useOnline((s) => s.phase);
  const friendship = useOnline((s) => s.friendships.find((f) => f.status === 'accepted' && (f.requester === id || f.addressee === id)));
  const [list, setList] = useState<SharedCritique[] | null>(null);
  const [sort, setSort] = useState<'recent' | 'rating'>('recent');
  const [menu, setMenu] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const mine = useLibrary((s) => s.lib.critiques);

  useEffect(() => {
    if (phase !== 'ready') return;
    let live = true;
    void onlineActions.critiquesOf(id).then((r) => live && setList(r)).catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [id, phase]);

  const match = useMemo(() => (list ? tasteMatch(mine, list) : null), [mine, list]);
  const sorted = useMemo(() => [...(list ?? [])].sort((a, b) => (sort === 'recent' ? b.updatedAt - a.updatedAt : b.total - a.total)), [list, sort]);
  const favs = (list ?? []).filter((c) => c.favourite);
  const masters = (list ?? []).filter((c) => c.cls === 'masterpiece');
  const avg = list?.length ? Math.round(list.reduce((a, c) => a + c.total, 0) / list.length) : null;
  const open = critique ? (list ?? []).find((c) => c.id === critique) : null;

  if (phase !== 'ready' || !person)
    return (
      <div className="page friend">
        <Empty icon="people" title="This profile isn’t available" action={<Button onClick={() => go({ name: 'friends' })}>Back to Friends</Button>}>
          Sign in on the Friends tab to see your friends’ critiques.
        </Empty>
      </div>
    );

  return (
    <div className="page friend">
      <div className="friend-bar">
        <Button variant="quiet" icon="back" onClick={() => go({ name: 'friends' })}>
          Friends
        </Button>
      </div>
      <header className="friend-head">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
          <Avatar src={person.avatar} size={120} ring />
        </motion.div>
        <div className="friend-id">
          <h1 className="page-title display">{person.displayName || person.username}</h1>
          <span className="me-handle">@{person.username}</span>
          {person.bio && <p className="friend-bio">{person.bio}</p>}
          <div className="friend-stats">
            <span>
              <b>{list?.length ?? '–'}</b> critiques
            </span>
            {avg !== null && (
              <span>
                <b>{avg}</b> average
              </span>
            )}
            <span>
              <b>{masters.length}</b> masterpiece{masters.length === 1 ? '' : 's'}
            </span>
            {friendship?.acceptedAt && <span>Friends since {longDate(friendship.acceptedAt)}</span>}
          </div>
        </div>
        {match && (
          <div className="taste glass" title={match.score === null ? 'Review a couple of the same titles to see how your taste lines up.' : `Based on ${match.shared.length} titles you’ve both reviewed`}>
            <span className="taste-num display">{match.score === null ? '–' : match.score + '%'}</span>
            <span className="taste-label">taste match</span>
            <span className="taste-sub">{match.shared.length ? `${match.shared.length} title${match.shared.length === 1 ? '' : 's'} in common` : 'No titles in common yet'}</span>
          </div>
        )}
        {friendship && (
          <>
            <Button ref={menuBtn} variant="glass" icon="more" aria-label="More" onClick={() => setMenu((v) => !v)} />
            <Popover open={menu} onClose={() => setMenu(false)} anchor={menuBtn} align="end" width={220}>
              <div className="menu">
                <button
                  type="button"
                  className="menu-item danger"
                  onClick={() => {
                    setMenu(false);
                    useUi.getState().openModal({
                      title: `Remove ${nameOf(person)} as a friend?`,
                      body: <p>You’ll stop seeing each other’s critiques. You can send a new request any time.</p>,
                      actions: [
                        { label: 'Cancel' },
                        {
                          label: 'Remove',
                          tone: 'danger',
                          run: async () => {
                            await onlineActions.remove(friendship);
                            go({ name: 'friends' });
                          },
                        },
                      ],
                    });
                  }}
                >
                  <Icon name="close" size={15} /> Remove friend
                </button>
              </div>
            </Popover>
          </>
        )}
      </header>

      {list === null && (
        <div className="friends-loading">
          <span className="pi-spinner" />
        </div>
      )}
      {list?.length === 0 && <Empty icon="archive" title={`${nameOf(person)} hasn’t shared any critiques yet`} />}

      {favs.length > 0 && <Shelf title="Favourites" items={favs} owner={id} />}
      {masters.length > 0 && <Shelf title="Masterpieces" items={masters} owner={id} gold />}
      {match && match.shared.length > 0 && (
        <section className="shelf">
          <h2 className="shelf-title display">You both reviewed</h2>
          <div className="both-list">
            {match.shared.slice(0, 12).map(({ mine: m, theirs: t }) => {
              const a = ratingOf(m);
              const d = t.total - a;
              return (
                <button key={t.id} type="button" className="both-row glass" onClick={() => go({ name: 'friend', id, critique: t.id }, { replace: true })}>
                  <Poster title={t.title} type={t.type} poster={m.poster} url={t.posterUrl} size="sm" />
                  <span className="both-title">{t.title}</span>
                  <span className="both-nums">
                    <span>
                      You <b>{a}</b>
                    </span>
                    <span>
                      {nameOf(person)} <b>{t.total}</b>
                    </span>
                  </span>
                  <span className={'both-diff' + (Math.abs(d) <= 30 ? ' close' : '')}>{Math.abs(d) <= 30 ? 'In sync' : d > 0 ? `+${d}` : d}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {list && list.length > 0 && (
        <section className="shelf">
          <div className="shelf-head">
            <h2 className="shelf-title display">All critiques</h2>
            <Segmented
              id="fsort"
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'recent', label: 'Newest' },
                { value: 'rating', label: 'Highest rated' },
              ]}
            />
          </div>
          <div className="friend-grid">
            {sorted.map((c, i) => (
              <motion.button
                key={c.id}
                type="button"
                className="friend-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 20) * 0.02 }}
                onClick={() => go({ name: 'friend', id, critique: c.id }, { replace: true })}
              >
                <Poster title={c.title} type={c.type} poster={null} url={c.posterUrl} size="md" />
                <span className="friend-card-meta">
                  <span className="feed-total display">{c.total}</span>
                  <ClassBadge cls={c.cls} size="sm" />
                </span>
                <span className="friend-card-title">{c.title}</span>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {createPortal(<AnimatePresence>{open && <FriendCritique key={open.id} c={open} onClose={() => go({ name: 'friend', id }, { replace: true })} />}</AnimatePresence>, document.body)}
    </div>
  );
}

function Shelf({ title, items, owner, gold }: { title: string; items: SharedCritique[]; owner: string; gold?: boolean }) {
  const go = useUi((s) => s.go);
  return (
    <section className={'shelf' + (gold ? ' gold' : '')}>
      <h2 className="shelf-title display">{title}</h2>
      <div className="shelf-row">
        {items.slice(0, 12).map((c) => (
          <button key={c.id} type="button" className="shelf-item" onClick={() => go({ name: 'friend', id: owner, critique: c.id }, { replace: true })}>
            <Poster title={c.title} type={c.type} poster={null} url={c.posterUrl} size="md" />
            <span className="shelf-item-title">{c.title}</span>
            <span className="shelf-item-num">{c.total}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** A friend's critique in full, laid over their profile. */
function FriendCritique({ c, onClose }: { c: SharedCritique; onClose: () => void }) {
  const person = useOnline((s) => s.people[c.owner]);
  const mine = useLibrary((s) => s.lib.critiques);
  const yours = useMemo(() => tasteMatch(mine, [c]).shared[0]?.mine ?? null, [mine, c]);
  const where = whereIs(c);
  const go = useUi((s) => s.go);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !useUi.getState().modal && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const color = CLASS_COLOR[c.cls];
  return (
    <motion.div className="fc-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.article
        className="fc glass"
        style={{ ['--c' as any]: color }}
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <button type="button" className="fc-close" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
        <div className="fc-top">
          <div className="fc-poster">
            <Poster title={c.title} type={c.type} poster={null} url={c.posterUrl} size="lg" />
          </div>
          <div className="fc-head">
            <span className="feed-who static">
              <Avatar src={person?.avatar} size={28} />
              <span>
                <b>{nameOf(person)}</b> <span className="feed-when">{relTime(c.updatedAt)}</span>
              </span>
            </span>
            <h2 className="fc-title display">{c.title}</h2>
            <span className="fc-meta">
              {TYPE_LABEL[c.type]}
              {c.year ? `, ${c.year}` : ''}
              {c.director ? `. ${c.type === 'show' ? 'Created by' : c.type === 'game' ? 'Led by' : 'Directed by'} ${c.director}` : ''}
              {c.studio ? `. ${c.studio}` : ''}
            </span>
            <div className="feed-verdict">
              <span className="fc-total display">{c.total}</span>
              <ClassBadge cls={c.cls} size="lg" />
              {c.recommend && <span className={'rec-pill rec-' + c.recommend}>{c.recommend === 'yes' ? 'Recommends it' : 'Doesn’t recommend it'}</span>}
            </div>
            {yours && (
              <p className="fc-yours">
                You gave it <b>{ratingOf(yours)}</b>, {classOf(yours) === c.cls ? 'the same class' : 'a different class'}. Your shape is the dashed line.
              </p>
            )}
            <div className="feed-foot">
              <LikeButton owner={c.owner} critiqueId={c.id} />
              {!yours && where !== 'watchlist' && (
                <Button
                  size="sm"
                  variant="glass"
                  icon="plus"
                  onClick={() => {
                    addToUpNext({ title: c.title, type: c.type, year: c.year, ext: extFromKey(c.extKey), posterUrl: c.posterUrl, description: c.description, genres: c.genres, from: nameOf(person) });
                    sound.confirm();
                    useUi.getState().toast({ text: `Added ${c.title} to Up Next`, tone: 'good' });
                  }}
                >
                  Add to Up Next
                </Button>
              )}
              {!yours && (
                <Button
                  size="sm"
                  variant="glass"
                  icon="pen"
                  onClick={() => {
                    const w = addToUpNext({ title: c.title, type: c.type, year: c.year, ext: extFromKey(c.extKey), posterUrl: c.posterUrl, description: c.description, genres: c.genres, from: nameOf(person) }, 'watched');
                    if (w) {
                      const d = startDraft(w);
                      go({ name: 'write', draftId: d.id });
                    }
                  }}
                >
                  Write yours
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="fc-body">
          <div className="fc-chart">
            <IrisChart scores={c.scores} cls={c.cls} size={250} compare={yours ? { scores: yours.scores, color: 'var(--ink-2)' } : null} />
          </div>
          <div className="fc-scores">
            {SCORES.map((s) => {
              const v = c.scores[s.key] ?? 0;
              const y = yours?.scores[s.key];
              return (
                <div key={s.key} className="fc-score">
                  <span className="fc-score-label">{s.label}</span>
                  <span className="fc-score-bar">
                    <span style={{ width: v + '%', background: scoreHue(v) }} />
                    {y != null && <i style={{ left: y + '%' }} title={`You: ${y}`} />}
                  </span>
                  <span className="fc-score-num">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
        {c.finalRemarks && <blockquote className="fc-remarks display">{c.finalRemarks}</blockquote>}
        {c.comments && (
          <section className="fc-text">
            <h3>Their thoughts</h3>
            <p>{c.comments}</p>
          </section>
        )}
        {c.cast && (
          <section className="fc-text">
            <h3>Cast</h3>
            <p>{splitCast(c.cast).join(', ')}</p>
          </section>
        )}
        <section className="fc-text">
          <h3>Replies</h3>
          <Replies owner={c.owner} critiqueId={c.id} />
        </section>
      </motion.article>
    </motion.div>
  );
}
