import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, animate, type PanInfo } from 'motion/react';
import { create } from 'zustand';
import { useLibrary } from '../state/library';
import { useSettings } from '../state/settings';
import { useUi } from '../state/ui';
import { useOnline, nameOf } from '../state/online';
import { Icon } from '../components/Icon';
import { Button, Empty, Segmented, Toggle } from '../components/ui';
import { Poster } from '../components/Poster';
import { sound } from '../lib/sound';
import { addToUpNext, extFromKey } from '../lib/watch';
import { extKey, ratingOf, type MediaType } from '../shared/model';
import type { RecCard } from '../shared/ipc';

type Verdict = 'like' | 'skip' | 'seen';

interface DeckState {
  cards: Record<MediaType, RecCard[]>;
  page: Record<MediaType, number>;
  loading: Record<MediaType, boolean>;
  failed: Record<MediaType, boolean>;
  history: { card: RecCard; verdict: Verdict; watchId: string | null }[];
}
const useDeck = create<DeckState>(() => ({
  cards: { movie: [], show: [], game: [] },
  page: { movie: 0, show: 0, game: 0 },
  loading: { movie: false, show: false, game: false },
  failed: { movie: false, show: false, game: false },
  history: [],
}));

function buildRequest(type: MediaType, page: number) {
  const lib = useLibrary.getState().lib;
  const era = useSettings.getState().s.recs.era;
  const online = useOnline.getState();
  const exclude = new Set<string>(lib.swipes.map((w) => w.key));
  for (const c of lib.critiques) if (c.ext) exclude.add(extKey(c.ext)!);
  for (const w of lib.watchlist) if (w.ext) exclude.add(extKey(w.ext)!);
  for (const c of useDeck.getState().cards[type]) exclude.add(c.key);
  return {
    type,
    page,
    era,
    seeds: lib.critiques.map((c) => ({ title: c.title, type: c.type, year: c.year, rating: ratingOf(c), ext: c.ext })),
    exclude: [...exclude],
    excludeTitles: [...lib.critiques.map((c) => c.title), ...lib.watchlist.map((w) => w.title), ...lib.swipes.map((w) => w.title)],
    friends:
      online.phase === 'ready'
        ? online.feed
            .filter((c) => c.total >= 800 || c.favourite)
            .slice(0, 12)
            .map((c) => ({ title: c.title, type: c.type, rating: c.total, by: nameOf(online.people[c.owner]), ext: extFromKey(c.extKey) }))
        : [],
  };
}

async function topUp(type: MediaType) {
  const st = useDeck.getState();
  if (st.loading[type]) return;
  useDeck.setState({ loading: { ...st.loading, [type]: true }, failed: { ...st.failed, [type]: false } });
  try {
    const page = st.page[type] + 1;
    const got = await window.iris.lookup.recommend(buildRequest(type, page));
    const cur = useDeck.getState();
    const have = new Set(cur.cards[type].map((c) => c.key));
    useDeck.setState({
      cards: { ...cur.cards, [type]: [...cur.cards[type], ...got.filter((c) => !have.has(c.key))] },
      page: { ...cur.page, [type]: page },
      failed: { ...cur.failed, [type]: got.length === 0 },
    });
  } catch {
    useDeck.setState({ failed: { ...useDeck.getState().failed, [type]: true } });
  } finally {
    useDeck.setState({ loading: { ...useDeck.getState().loading, [type]: false } });
  }
}

export function ForYou() {
  const [type, setType] = useState<MediaType>('movie');
  const [status, setStatus] = useState<{ tmdb: boolean; igdb: boolean } | null>(null);
  const cards = useDeck((s) => s.cards[type]);
  const loading = useDeck((s) => s.loading[type]);
  const failed = useDeck((s) => s.failed[type]);
  const history = useDeck((s) => s.history);
  const era = useSettings((s) => s.s.recs.era);
  const setS = useSettings((s) => s.set);
  const [lastVerdict, setLastVerdict] = useState<Verdict>('skip');

  useEffect(() => {
    void window.iris.lookup.status().then(setStatus);
  }, []);
  const available = status ? (type === 'game' ? status.igdb : status.tmdb) : true;
  useEffect(() => {
    if (available && cards.length < 4 && !loading && !failed) void topUp(type);
  }, [type, cards.length, loading, failed, available]);

  const decide = useCallback(
    (verdict: Verdict) => {
      const card = useDeck.getState().cards[type][0];
      if (!card) return;
      setLastVerdict(verdict);
      const lib = useLibrary.getState();
      lib.addSwipe({ key: card.key, title: card.title, type: card.type, verdict, at: Date.now() });
      let watchId: string | null = null;
      if (verdict !== 'skip') {
        const w = addToUpNext(
          { title: card.title, type: card.type, year: card.year, ext: card.ext, posterUrl: card.poster, description: card.overview, genres: card.genres },
          verdict === 'seen' ? 'watched' : 'want',
        );
        watchId = w?.id ?? null;
        sound.confirm();
      } else sound.whoosh(-0.6);
      const st = useDeck.getState();
      useDeck.setState({ cards: { ...st.cards, [type]: st.cards[type].slice(1) }, history: [...st.history.slice(-30), { card, verdict, watchId }] });
    },
    [type],
  );

  const rewind = useCallback(() => {
    const st = useDeck.getState();
    const last = st.history[st.history.length - 1];
    if (!last) return;
    useLibrary.getState().undoSwipe(last.card.key);
    if (last.watchId) useLibrary.getState().removeWatch(last.watchId);
    useDeck.setState({
      history: st.history.slice(0, -1),
      cards: { ...st.cards, [last.card.type]: [last.card, ...st.cards[last.card.type]] },
    });
    if (last.card.type !== type) setType(last.card.type);
    sound.whoosh(0.6);
  }, [type]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || useUi.getState().modal) return;
      if (e.key === 'ArrowRight') decide('like');
      else if (e.key === 'ArrowLeft') decide('skip');
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        decide('seen');
      } else if (e.key === 'Backspace' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z')) rewind();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, rewind]);

  const top = cards[0];
  return (
    <div className="page foryou">
      <AnimatePresence>
        {top?.backdrop && (
          <motion.div key={top.key} className="foryou-backdrop" style={{ backgroundImage: `url("${top.backdrop}")` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} />
        )}
      </AnimatePresence>
      <header className="page-head foryou-head">
        <div>
          <h1 className="page-title display">For You</h1>
          <p className="page-sub">Well-known picks based on what you rate highly. Swipe right for Up Next, left to skip, up if you’ve already seen it.</p>
        </div>
        <div className="foryou-controls">
          <Segmented
            id="fytype"
            value={type}
            onChange={(v) => setType(v)}
            options={[
              { value: 'movie', label: 'Movies', icon: 'movie' },
              { value: 'show', label: 'Shows', icon: 'show' },
              { value: 'game', label: 'Games', icon: 'game' },
            ]}
          />
          <div className="foryou-era">
            <Toggle
              on={era === 'recent'}
              onChange={(on) => {
                setS({ recs: { ...useSettings.getState().s.recs, era: on ? 'recent' : 'all' } });
                useDeck.setState({ cards: { movie: [], show: [], game: [] }, page: { movie: 0, show: 0, game: 0 }, failed: { movie: false, show: false, game: false } });
              }}
              label="2000 and newer only"
            />
          </div>
        </div>
      </header>

      {!available ? (
        <Empty icon="flame" title="Recommendations need the online catalogue">
          This copy of Iris was built without the {type === 'game' ? 'IGDB' : 'TMDB'} key, so it can’t look up {type === 'game' ? 'games' : type === 'show' ? 'shows' : 'movies'}.
        </Empty>
      ) : (
        <div className="deck-wrap">
          <div className="deck">
            <AnimatePresence custom={lastVerdict}>
              {cards.slice(0, 3).reverse().map((c, i, arr) => {
                const depth = arr.length - 1 - i;
                return <SwipeCard key={c.key} card={c} depth={depth} onDecide={decide} />;
              })}
            </AnimatePresence>
            {!cards.length && (
              <div className="deck-empty">
                {loading ? (
                  <>
                    <span className="pi-spinner" />
                    <p>Finding picks you’ll like…</p>
                  </>
                ) : failed ? (
                  <>
                    <Icon name="cloud" size={30} />
                    <p>Iris couldn’t fetch picks right now. Check your internet connection.</p>
                    <Button
                      variant="glass"
                      icon="refresh"
                      onClick={() => {
                        useDeck.setState({ failed: { ...useDeck.getState().failed, [type]: false } });
                      }}
                    >
                      Try again
                    </Button>
                  </>
                ) : null}
              </div>
            )}
          </div>
          <div className="deck-buttons">
            <motion.button type="button" className="deck-btn rewind" whileTap={{ scale: 0.88 }} disabled={!history.length} onClick={rewind} title="Undo (Backspace)">
              <Icon name="undo" size={20} />
            </motion.button>
            <motion.button type="button" className="deck-btn skip" whileTap={{ scale: 0.88 }} disabled={!top} onClick={() => decide('skip')} title="Skip (←)">
              <Icon name="close" size={28} />
            </motion.button>
            <motion.button type="button" className="deck-btn seen" whileTap={{ scale: 0.88 }} disabled={!top} onClick={() => decide('seen')} title="Already seen it (↑)">
              <Icon name="eye" size={22} />
            </motion.button>
            <motion.button type="button" className="deck-btn like" whileTap={{ scale: 0.88 }} disabled={!top} onClick={() => decide('like')} title="Add to Up Next (→)">
              <Icon name="heartfill" size={28} />
            </motion.button>
          </div>
          <p className="deck-hint">Use the arrow keys, or drag the card.</p>
        </div>
      )}
    </div>
  );
}

function SwipeCard({ card, depth, onDecide }: { card: RecCard; depth: number; onDecide: (v: Verdict) => void }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 320], [-16, 16]);
  const likeO = useTransform(x, [30, 140], [0, 1]);
  const skipO = useTransform(x, [-140, -30], [1, 0]);
  const seenO = useTransform(y, [-140, -30], [1, 0]);
  const isTop = depth === 0;
  const onEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.y < -120 && Math.abs(offset.x) < 160) return fly('seen');
    if (offset.x > 120 || velocity.x > 700) return fly('like');
    if (offset.x < -120 || velocity.x < -700) return fly('skip');
    void animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    void animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 });
  };
  const fly = (v: Verdict) => onDecide(v);
  const genres = useMemo(() => card.genres.join(', '), [card.genres]);
  return (
    <motion.div
      className={'swipe' + (isTop ? ' top' : '')}
      style={{ x, y, rotate, zIndex: 10 - depth }}
      drag={isTop}
      dragElastic={0.7}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={onEnd}
      variants={{
        exit: (v: Verdict) =>
          v === 'like'
            ? { x: 760, rotate: 24, opacity: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.6, 1] } }
            : v === 'skip'
              ? { x: -760, rotate: -24, opacity: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.6, 1] } }
              : { y: -760, opacity: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.6, 1] } },
      }}
      initial={{ scale: 0.9, opacity: 0, y: 30 }}
      animate={{ scale: 1 - depth * 0.05, opacity: 1, y: depth * 18 }}
      exit="exit"
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      whileDrag={{ cursor: 'grabbing' }}
    >
      <div className="swipe-poster">
        <Poster title={card.title} type={card.type} poster={null} url={card.poster} size="xl" />
        <div className="swipe-shade" />
        <motion.span className="stamp like" style={{ opacity: likeO }}>
          Up Next
        </motion.span>
        <motion.span className="stamp skip" style={{ opacity: skipO }}>
          Skip
        </motion.span>
        <motion.span className="stamp seen" style={{ opacity: seenO }}>
          Seen it
        </motion.span>
        <div className="swipe-info">
          <span className="swipe-reason">
            <Icon name="sparkle" size={13} /> {card.reason}
          </span>
          <h2 className="swipe-title display">{card.title}</h2>
          <span className="swipe-meta">
            {[card.year, genres].filter(Boolean).join('. ')}
            {card.score ? <b className="swipe-score">{card.score}% audience score</b> : null}
          </span>
          {card.overview && <p className="swipe-overview">{card.overview}</p>}
        </div>
      </div>
    </motion.div>
  );
}
