import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useLibrary } from '../state/library';
import { useSettings } from '../state/settings';
import { useUi } from '../state/ui';
import { Poster } from '../components/Poster';
import { Icon } from '../components/Icon';
import { Tilt } from '../components/ui';
import { ClassBadge } from '../components/ClassBadge';
import { greeting, relTime, wordNum } from '../lib/format';
import { sound } from '../lib/sound';
import { CLASS_BY_KEY, SCORES, classOf, ratingOf, type Critique } from '../shared/model';

function summary(list: Critique[]): string {
  if (!list.length) return 'Your archive is empty for now. Every great collection starts with a single verdict.';
  const n = (t: Critique['type']) => list.filter((c) => c.type === t).length;
  const parts = [
    n('movie') && `${wordNum(n('movie'))} film${n('movie') === 1 ? '' : 's'}`,
    n('show') && `${wordNum(n('show'))} show${n('show') === 1 ? '' : 's'}`,
    n('game') && `${wordNum(n('game'))} game${n('game') === 1 ? '' : 's'}`,
  ].filter(Boolean) as string[];
  const joined = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
  const top = [...list].sort((a, b) => ratingOf(b) - ratingOf(a))[0];
  const total = list.length === 1 ? 'One critique so far' : `${wordNum(list.length).replace(/^./, (c) => c.toUpperCase())} critiques so far`;
  return `${total}: ${joined}. ${top.title} leads at ${ratingOf(top)}.`;
}

export function Lobby() {
  const lib = useLibrary((s) => s.lib);
  const name = useSettings((s) => s.s.userName);
  const go = useUi((s) => s.go);
  const crits = lib.critiques;
  const top = useMemo(() => [...crits].sort((a, b) => ratingOf(b) - ratingOf(a)).slice(0, 3), [crits]);
  const recent = useMemo(() => [...crits].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4), [crits]);
  const upnext = useMemo(() => [...lib.watchlist].sort((a, b) => (a.status === b.status ? a.order - b.order : a.status === 'watched' ? -1 : 1)).slice(0, 5), [lib.watchlist]);
  const draft = useMemo(() => [...lib.drafts].sort((a, b) => b.updatedAt - a.updatedAt)[0], [lib.drafts]);
  const masterCount = crits.filter((c) => classOf(c) === 'masterpiece').length;

  const draftLine = draft
    ? (() => {
        const scored = SCORES.filter((s) => draft.data.scores[s.key] !== null).length;
        const t = draft.data.title.trim() || 'an untitled critique';
        return `Pick up ${t} where you left it, ${scored} of 10 scores in.`;
      })()
    : null;

  return (
    <div className="page lobby">
      <section className="lobby-hero">
        <motion.h1
          className="lobby-greet display"
          initial={{ opacity: 0, filter: 'blur(18px)', letterSpacing: '0.18em' }}
          animate={{ opacity: 1, filter: 'blur(0px)', letterSpacing: 'var(--display-tracking)' }}
          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {greeting(name)}
        </motion.h1>
        <motion.p className="lobby-summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.8 }}>
          {summary(crits)}
          {masterCount > 0 && (
            <>
              {' '}
              <button type="button" className="inline-link" onClick={() => go({ name: 'masterpieces' })}>
                {masterCount === 1 ? 'One masterpiece' : `${wordNum(masterCount)} masterpieces`} on the wall.
              </button>
            </>
          )}
        </motion.p>

        <motion.div
          className="doors"
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <button type="button" className="door door-view" onPointerEnter={() => sound.hover()} onClick={() => go({ name: 'archive' })}>
            <span className="door-iris" />
            <span className="door-fan" aria-hidden="true">
              {top.slice(0, 3).map((c, i) => (
                <span key={c.id} className={`door-fan-card f${i}`}>
                  <Poster title={c.title} type={c.type} poster={c.poster} size="sm" />
                </span>
              ))}
            </span>
            <span className="door-text">
              <span className="door-title display">View your critiques</span>
              <span className="door-sub">{crits.length ? `${crits.length} in the archive, sorted and filtered however you like.` : 'Nothing here yet. Your first verdict will open the archive.'}</span>
            </span>
            <span className="door-go">
              <Icon name="right" size={20} />
            </span>
          </button>
          <button
            type="button"
            className="door door-write"
            onPointerEnter={() => sound.hover()}
            onClick={() => go(draft ? { name: 'write', draftId: draft.id } : { name: 'write' })}
          >
            <span className="door-iris" />
            <span className="door-dial" aria-hidden="true">
              <span className="door-dial-ring" />
              <span className="door-dial-num">100</span>
            </span>
            <span className="door-text">
              <span className="door-title display">{draft ? 'Continue your critique' : 'Write a critique'}</span>
              <span className="door-sub">{draftLine ?? 'Ten scores, your comments and a final verdict out of 1000.'}</span>
            </span>
            <span className="door-go">
              <Icon name="right" size={20} />
            </span>
          </button>
        </motion.div>
        {draft && (
          <motion.button type="button" className="lobby-fresh" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} onClick={() => go({ name: 'write', draftId: 'new' })}>
            <Icon name="plus" size={14} /> Start a new one instead
          </motion.button>
        )}
      </section>

      <motion.aside className="lobby-showcase" initial={{ opacity: 0, x: 40, rotateY: -12 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ delay: 0.35, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}>
        {top.length > 0 ? (
          <div className={`stack stack-${top.length}`}>
            {top.map((c, i) => (
              <Tilt key={c.id} className={`stack-card s${i}`} max={12} onClick={() => go({ name: 'detail', id: c.id })}>
                <Poster title={c.title} type={c.type} poster={c.poster} year={c.year} size="lg" />
                <span className="stack-meta">
                  <span className="stack-rank display">{ratingOf(c)}</span>
                  <ClassBadge cls={classOf(c)} size="sm" />
                </span>
              </Tilt>
            ))}
          </div>
        ) : (
          <div className="stack-empty">
            <div className="stack-frame" />
            <p>Your top three will stand here.</p>
          </div>
        )}
      </motion.aside>

      <motion.section className="lobby-strips" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0, duration: 0.8 }}>
        <div className="strip">
          <div className="strip-head">
            <h2>Up next</h2>
            <button type="button" className="inline-link" onClick={() => go({ name: 'upnext' })}>
              {upnext.length ? 'Open the list' : 'Add something to watch'}
            </button>
          </div>
          {upnext.length ? (
            <div className="strip-row">
              {upnext.map((w) => (
                <button key={w.id} type="button" className="mini" onClick={() => go({ name: 'upnext' })}>
                  <Poster title={w.title} type={w.type} poster={w.poster} size="sm" />
                  <span className="mini-title">{w.title}</span>
                  <span className="mini-sub">{w.status === 'watched' ? 'Watched, needs a critique' : 'Want to watch'}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="strip-empty">Keep a list of what you want to watch or play, and what you’ve finished but not reviewed yet.</p>
          )}
        </div>
        <div className="strip">
          <div className="strip-head">
            <h2>Latest verdicts</h2>
          </div>
          {recent.length ? (
            <div className="strip-row">
              {recent.map((c) => (
                <button key={c.id} type="button" className="mini" onClick={() => go({ name: 'detail', id: c.id })}>
                  <Poster title={c.title} type={c.type} poster={c.poster} size="sm" />
                  <span className="mini-title">{c.title}</span>
                  <span className="mini-sub">
                    <b className="mini-num">{ratingOf(c)}</b> {CLASS_BY_KEY[classOf(c)].label}, {relTime(c.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="strip-empty">Your newest critiques will appear here.</p>
          )}
        </div>
      </motion.section>
    </div>
  );
}
