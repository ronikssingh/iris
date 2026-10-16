import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useOnline, onlineActions, friendIds, incoming, outgoing, nameOf, tasteMatch } from '../state/online';
import { useUi } from '../state/ui';
import { useLibrary } from '../state/library';
import { explain, type Profile, type SharedCritique, type Suggestion } from '../online/api';
import { Avatar, AvatarPicker, LikeButton, PersonRow, Replies } from '../components/social';
import { Poster } from '../components/Poster';
import { ClassBadge, CLASS_COLOR } from '../components/ClassBadge';
import { Icon } from '../components/Icon';
import { Button, Empty, Segmented, AutoTextarea } from '../components/ui';
import { relTime } from '../lib/format';
import { sound } from '../lib/sound';
import { addToUpNext, extFromKey, whereIs } from '../lib/watch';
import { ratingOf } from '../shared/model';
import { useSettings } from '../state/settings';

export function Friends({ tab }: { tab?: 'feed' | 'people' | 'suggested' }) {
  const phase = useOnline((s) => s.phase);
  useEffect(() => {
    void useOnline.getState().start();
  }, []);
  return (
    <div className="page friends">
      <header className="page-head">
        <div>
          <h1 className="page-title display">Friends</h1>
          <p className="page-sub">See what your friends are watching and playing, and how their verdicts compare with yours.</p>
        </div>
      </header>
      {phase === 'off' && (
        <Empty icon="people" title="Friends aren’t switched on in this copy of Iris">
          This version was built without an online account service, so everything stays on this computer.
        </Empty>
      )}
      {phase === 'loading' && <div className="friends-loading"><span className="pi-spinner" /></div>}
      {phase === 'signedOut' && <AuthCard />}
      {phase === 'needsProfile' && <ProfileSetup />}
      {phase === 'ready' && <Hub initial={tab} />}
    </div>
  );
}

/* ------------------------------------------------------------- Signing in */

function AuthCard() {
  const [mode, setMode] = useState<'in' | 'up' | 'code' | 'forgot' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(explain(e));
      sound.error();
    } finally {
      setBusy(false);
    }
  };
  const api = () => import('../online/api').then((m) => m.online());
  // After signing up, keep quietly trying to sign in, so clicking the link in the email is enough.
  useEffect(() => {
    if (mode !== 'code' || !email.trim() || pw.length < 6) return;
    let tries = 0;
    const h = window.setInterval(async () => {
      if (++tries > 120) return window.clearInterval(h);
      try {
        await (await api()).signIn(email.trim(), pw);
        window.clearInterval(h);
      } catch {
        /* not confirmed yet */
      }
    }, 5000);
    return () => window.clearInterval(h);
  }, [mode, email, pw]);
  const submit = () =>
    run(async () => {
      const a = await api();
      if (mode === 'in') await a.signIn(email.trim(), pw);
      else if (mode === 'up') {
        if (pw.length < 6) throw new Error('Password should be at least 6 characters');
        const r = await a.signUp(email.trim(), pw);
        if (r.needsCode) setMode('code');
      } else if (mode === 'code') await a.verifySignup(email.trim(), code);
      else if (mode === 'forgot') {
        await a.sendReset(email.trim());
        setMode('reset');
      } else if (mode === 'reset') await a.resetWithCode(email.trim(), code, pw);
    });
  const titles = {
    in: 'Sign in',
    up: 'Create your account',
    code: 'Check your email',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  };
  return (
    <motion.form
      className="auth glass"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="auth-art">
        {['sundown', 'moonwake', 'spiritgrove', 'eventhorizon', 'megacity'].map((w, i) => (
          <motion.span key={w} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
            <Avatar src={'world:' + w} size={46} />
          </motion.span>
        ))}
      </div>
      <h2 className="auth-title display">{titles[mode]}</h2>
      <p className="auth-sub">
        {mode === 'in' && 'Signing in shares your critiques with the friends you add, unless you hide them, and keeps your critiques and Up Next the same on every computer you use.'}
        {mode === 'up' && 'Use an email you can check. You’ll pick a username and a picture next.'}
        {mode === 'code' && `Iris sent an email to ${email}. Type the code from it here, or just click the link in it and Iris will sign you in. If it hasn’t arrived in a minute, check your spam folder.`}
        {mode === 'forgot' && 'Iris will email you a code so you can choose a new password.'}
        {mode === 'reset' && `Enter the code sent to ${email} and your new password.`}
      </p>
      {(mode === 'in' || mode === 'up' || mode === 'forgot') && (
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
        </label>
      )}
      {(mode === 'code' || mode === 'reset') && (
        <label className="field">
          <span className="field-label">Code from the email</span>
          <input className="input input-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))} autoFocus required />
        </label>
      )}
      {(mode === 'in' || mode === 'up' || mode === 'reset') && (
        <label className="field">
          <span className="field-label">{mode === 'reset' ? 'New password' : 'Password'}</span>
          <input className="input" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} />
        </label>
      )}
      {err && <p className="auth-err">{err}</p>}
      <Button variant="primary" type="submit" disabled={busy} className="auth-go">
        {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : mode === 'code' ? 'Confirm' : mode === 'forgot' ? 'Email me a code' : 'Save new password'}
      </Button>
      <div className="auth-switch">
        {mode === 'in' && (
          <>
            <button type="button" className="inline-link" onClick={() => setMode('up')}>
              New here? Create an account
            </button>
            <button type="button" className="inline-link" onClick={() => setMode('forgot')}>
              Forgot your password?
            </button>
          </>
        )}
        {mode === 'code' && pw.length >= 6 && (
          <button type="button" className="inline-link" onClick={() => void run(async () => (await api()).signIn(email.trim(), pw))}>
            I clicked the link, sign me in
          </button>
        )}
        {mode !== 'in' && (
          <button type="button" className="inline-link" onClick={() => setMode('in')}>
            Back to sign in
          </button>
        )}
      </div>
    </motion.form>
  );
}

/* --------------------------------------------------------- First profile */

const USERNAME = /^[a-z0-9_.]{3,20}$/;

function ProfileEditor({ initial, submitLabel, onSubmit }: { initial: Partial<Profile>; submitLabel: string; onSubmit: (p: { username: string; displayName: string; bio: string; avatar: string; file?: Blob }) => Promise<void> }) {
  const [username, setUsername] = useState(initial.username ?? '');
  const [displayName, setDisplayName] = useState(initial.displayName ?? useUiName());
  const [bio, setBio] = useState(initial.bio ?? '');
  const [avatar, setAvatar] = useState(initial.avatar ?? 'world:' + useSettings.getState().s.theme);
  const [ideas, setIdeas] = useState<string[]>([]);
  // a few usernames that are free right now; the first fills the field for a brand-new profile
  useEffect(() => {
    if (initial.username) return;
    const first = (useUiName() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const wanted = [...new Set(['projectionist', first, first && first + '.reels', first && 'the.' + first, 'final.cut', 'reel.talk'].filter((x) => x && USERNAME.test(x)))];
    let alive = true;
    void (async () => {
      const free: string[] = [];
      for (const w of wanted) {
        if (free.length >= 3) break;
        const taken = await import('../online/api').then((m) => m.online().usernameTaken(w, '')).catch(() => true);
        if (!taken) free.push(w);
      }
      if (!alive) return;
      setIdeas(free);
      setUsername((u) => u || free[0] || '');
    })();
    return () => {
      alive = false;
    };
  }, [initial.username]);
  const [file, setFile] = useState<Blob | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = USERNAME.test(username);
  return (
    <form
      className="profile-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setBusy(true);
        setErr(null);
        try {
          await onSubmit({ username, displayName: displayName.trim(), bio: bio.trim(), avatar, file });
        } catch (x) {
          setErr(explain(x));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="pe-preview">
        <Avatar src={avatar} size={96} ring />
        <div>
          <span className="pe-name display">{displayName || username || 'You'}</span>
          <span className="pe-handle">@{username || 'username'}</span>
        </div>
      </div>
      <span className="field-label">Profile picture</span>
      <AvatarPicker
        value={avatar}
        onChange={(v, f) => {
          setAvatar(v);
          setFile(f);
        }}
      />
      <div className="pe-fields">
        <label className="field">
          <span className="field-label">Username</span>
          <input className="input" value={username} maxLength={20} placeholder="ronik" onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} autoFocus required />
          <span className={'field-hint' + (username && !valid ? ' bad' : '')}>3 to 20 lowercase letters, numbers, dots or underscores. Friends search for this.</span>
          {ideas.length > 1 && (
            <span className="pe-ideas">
              {ideas.map((i) => (
                <button key={i} type="button" className={'chip' + (username === i ? ' on' : '')} onClick={() => setUsername(i)}>
                  @{i}
                </button>
              ))}
            </span>
          )}
        </label>
        <label className="field">
          <span className="field-label">Name friends see</span>
          <input className="input" value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">A line about your taste (optional)</span>
        <AutoTextarea className="input" minRows={1} maxLength={160} value={bio} placeholder="Big on sci-fi, soft spot for animated films" onChange={(e) => setBio(e.target.value)} />
      </label>
      {err && <p className="auth-err">{err}</p>}
      <div className="pe-actions">
        <Button variant="primary" type="submit" disabled={!valid || busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function useUiName() {
  return useSettings.getState().s.userName ?? '';
}

async function avatarValue(avatar: string, file?: Blob) {
  if (avatar.startsWith('world:') || avatar.startsWith('preset:') || !file) return avatar.startsWith('blob:') ? 'world:winedark' : avatar;
  return onlineActions.uploadAvatar(file);
}

function ProfileSetup() {
  return (
    <motion.div className="setup glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="auth-title display">Make your profile</h2>
      <p className="auth-sub">This is how friends find and recognise you.</p>
      <ProfileEditor
        initial={{}}
        submitLabel="Start"
        onSubmit={async (p) => {
          const avatar = await avatarValue(p.avatar, p.file);
          await onlineActions.createProfile({ username: p.username, displayName: p.displayName, bio: p.bio, avatar });
          sound.confirm();
        }}
      />
    </motion.div>
  );
}

export function editProfile() {
  const prof = useOnline.getState().profile;
  if (!prof) return;
  useUi.getState().openModal({
    title: 'Edit your profile',
    wide: true,
    actions: [],
    body: (
      <ProfileEditor
        initial={prof}
        submitLabel="Save profile"
        onSubmit={async (p) => {
          const avatar = await avatarValue(p.avatar, p.file);
          await onlineActions.updateProfile({ username: p.username, displayName: p.displayName, bio: p.bio, avatar });
          useUi.getState().closeModal();
          useUi.getState().toast({ text: 'Profile saved', tone: 'good' });
        }}
      />
    ),
  });
}

/* --------------------------------------------------------------- The hub */

function Hub({ initial }: { initial?: 'feed' | 'people' | 'suggested' }) {
  const [tab, setTab] = useState<'feed' | 'suggested'>(initial === 'suggested' ? 'suggested' : 'feed');
  const me = useOnline((s) => s.me!);
  const profile = useOnline((s) => s.profile!);
  const unseen = useOnline((s) => s.suggestions.filter((x) => x.toUser === s.me?.id && !x.seen).length);
  const syncing = useOnline((s) => s.syncing);
  const syncNote = useOnline((s) => s.syncNote);
  const paused = useOnline((s) => s.paused);
  const shared = useLibrary((s) => s.lib.critiques.filter((c) => !c.hidden).length);
  return (
    <div className="hub">
      <aside className="hub-side">
        <div className="me-card glass">
          <Avatar src={profile.avatar} size={64} ring />
          <div className="me-text">
            <span className="me-name display">{profile.displayName || profile.username}</span>
            <span className="me-handle">@{profile.username}</span>
          </div>
          <Button size="sm" variant="glass" icon="edit" onClick={editProfile} aria-label="Edit profile" />
          <p className="me-sync">
            {paused ? (
              <>
                <Icon name="warning" size={13} /> {paused}
              </>
            ) : syncNote ? (
              <>
                <Icon name="warning" size={13} /> {syncNote}
              </>
            ) : (
              <>
                <Icon name={syncing ? 'refresh' : 'cloud'} size={13} /> {syncing ? 'Sharing your critiques…' : `${shared} critique${shared === 1 ? '' : 's'} shared with friends`}
              </>
            )}
          </p>
        </div>
        <Requests />
        <FriendList />
        <FindPeople meId={me.id} />
      </aside>
      <section className="hub-main">
        <div className="hub-tabs">
          <Segmented
            id="hubtab"
            value={tab}
            onChange={(v) => setTab(v)}
            options={[
              { value: 'feed', label: 'New from friends', icon: 'sparkle' },
              { value: 'suggested', label: unseen ? `Suggested to you (${unseen})` : 'Suggested to you', icon: 'send' },
            ]}
          />
          <Button variant="quiet" icon="refresh" size="sm" onClick={() => void useOnline.getState().refresh()}>
            Refresh
          </Button>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            {tab === 'feed' ? <Feed /> : <Suggested />}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}

function Requests() {
  const s = useOnline();
  const inc = incoming(s);
  const out = outgoing(s);
  if (!inc.length && !out.length) return null;
  return (
    <div className="side-block">
      <h3>Requests</h3>
      {inc.map((f) => (
        <PersonRow key={f.requester} p={s.people[f.requester]}>
          <Button
            size="sm"
            variant="primary"
            icon="check"
            onClick={async () => {
              sound.confirm();
              await onlineActions.accept(f.requester).catch((e) => useUi.getState().toast({ text: explain(e), tone: 'bad' }));
            }}
          >
            Accept
          </Button>
          <Button size="sm" variant="quiet" icon="close" aria-label="Decline" onClick={() => void onlineActions.remove(f)} />
        </PersonRow>
      ))}
      {out.map((f) => (
        <PersonRow key={f.addressee} p={s.people[f.addressee]}>
          <span className="waiting">Waiting</span>
          <Button size="sm" variant="quiet" icon="close" aria-label="Cancel request" onClick={() => void onlineActions.remove(f)} />
        </PersonRow>
      ))}
    </div>
  );
}

function FriendList() {
  const s = useOnline();
  const go = useUi((x) => x.go);
  const ids = friendIds(s);
  return (
    <div className="side-block">
      <h3>
        Friends <span className="count">{ids.length}</span>
      </h3>
      {!ids.length && <p className="muted small">Find people below by their username to send a friend request.</p>}
      {ids.map((id) => (
        <PersonRow key={id} p={s.people[id]} onClick={() => go({ name: 'friend', id })}>
          <Icon name="right" size={16} />
        </PersonRow>
      ))}
    </div>
  );
}

function FindPeople({ meId }: { meId: string }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Profile[] | null>(null);
  const s = useOnline();
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setRes(null);
      return;
    }
    const h = setTimeout(async () => setRes(await onlineActions.search(t).catch(() => [])), 350);
    return () => clearTimeout(h);
  }, [q]);
  const relation = (id: string) => {
    const f = s.friendships.find((x) => (x.requester === meId && x.addressee === id) || (x.addressee === meId && x.requester === id));
    if (!f) return 'none';
    if (f.status === 'accepted') return 'friends';
    return f.requester === meId ? 'sent' : 'received';
  };
  return (
    <div className="side-block">
      <h3>Find people</h3>
      <div className="search small">
        <Icon name="search" size={15} />
        <input value={q} placeholder="Search by username" onChange={(e) => setQ(e.target.value)} />
      </div>
      {res?.length === 0 && <p className="muted small">Nobody by that name yet.</p>}
      {res?.map((p) => {
        const r = relation(p.id);
        return (
          <PersonRow key={p.id} p={p}>
            {r === 'none' ? (
              <Button
                size="sm"
                variant="glass"
                icon="userplus"
                onClick={async () => {
                  sound.confirm();
                  await onlineActions.request(p.id).catch((e) => useUi.getState().toast({ text: explain(e), tone: 'bad' }));
                }}
              >
                Add
              </Button>
            ) : r === 'friends' ? (
              <span className="waiting">Friends</span>
            ) : r === 'sent' ? (
              <span className="waiting">Requested</span>
            ) : (
              <Button size="sm" variant="primary" icon="check" onClick={() => void onlineActions.accept(p.id)}>
                Accept
              </Button>
            )}
          </PersonRow>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Feed */

function Feed() {
  const feed = useOnline((s) => s.feed);
  const people = useOnline((s) => s.people);
  const friends = useOnline((s) => friendIds(s).length);
  if (!friends)
    return (
      <Empty icon="people" title="Your feed fills up with friends">
        Add someone on the left. When they accept, their new critiques show up here.
      </Empty>
    );
  if (!feed.length)
    return (
      <Empty icon="sparkle" title="Nothing new yet">
        When your friends write critiques, they’ll show up here.
      </Empty>
    );
  return (
    <div className="feed">
      {feed.map((c, i) => (
        <FeedCard key={c.owner + '/' + c.id} c={c} who={people[c.owner]} index={i} />
      ))}
    </div>
  );
}

export function FeedCard({ c, who, index = 0, showWho = true }: { c: SharedCritique; who?: Profile; index?: number; showWho?: boolean }) {
  const go = useUi((s) => s.go);
  const [open, setOpen] = useState(false);
  const replies = useOnline((s) => s.replyCounts[c.owner + '/' + c.id] ?? 0);
  const mine = useLibrary((s) => s.lib.critiques);
  const yours = useMemo(() => tasteMatch(mine, [c]).shared[0]?.mine ?? null, [mine, c]);
  const where = whereIs(c);
  return (
    <motion.article
      className="feed-card glass"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      style={{ ['--c' as any]: CLASS_COLOR[c.cls] }}
    >
      <button type="button" className="feed-poster" onClick={() => go({ name: 'friend', id: c.owner, critique: c.id })}>
        <Poster title={c.title} type={c.type} poster={null} url={c.posterUrl} size="md" />
      </button>
      <div className="feed-body">
        {showWho && (
          <button type="button" className="feed-who" onClick={() => go({ name: 'friend', id: c.owner })}>
            <Avatar src={who?.avatar} size={28} />
            <span>
              <b>{nameOf(who)}</b> {Math.abs(c.createdAt - c.updatedAt) < 60000 ? 'reviewed' : 'updated a review of'} {c.type === 'movie' ? 'a film' : c.type === 'show' ? 'a show' : 'a game'}
            </span>
            <span className="feed-when">{relTime(c.updatedAt)}</span>
          </button>
        )}
        <button type="button" className="feed-title display" onClick={() => go({ name: 'friend', id: c.owner, critique: c.id })}>
          {c.title}
          {c.year && <span className="feed-year">{c.year}</span>}
        </button>
        <div className="feed-verdict">
          <span className="feed-total display">{c.total}</span>
          <ClassBadge cls={c.cls} />
          {c.recommend && <span className={'rec-pill rec-' + c.recommend}>{c.recommend === 'yes' ? 'Recommends it' : 'Doesn’t recommend it'}</span>}
          {c.favourite && (
            <span className="fav-pill">
              <Icon name="starfill" size={12} /> Favourite
            </span>
          )}
        </div>
        {c.finalRemarks && <p className="feed-remarks">“{c.finalRemarks}”</p>}
        <div className="feed-foot">
          <LikeButton owner={c.owner} critiqueId={c.id} />
          <button type="button" className={'reply-btn' + (open ? ' on' : '')} onClick={() => setOpen((v) => !v)}>
            <Icon name="reply" size={16} /> {replies > 0 ? replies : ''} {replies === 1 ? 'reply' : replies > 1 ? 'replies' : 'Reply'}
          </button>
          <span className="feed-spacer" />
          {yours ? (
            <span className="feed-compare">
              You gave it <b>{ratingOf(yours)}</b>
            </span>
          ) : where === 'watchlist' ? (
            <span className="feed-compare">On your Up Next</span>
          ) : (
            <Button
              size="sm"
              variant="glass"
              icon="plus"
              onClick={() => {
                addToUpNext({ title: c.title, type: c.type, year: c.year, ext: extFromKey(c.extKey), posterUrl: c.posterUrl, description: c.description, genres: c.genres, from: who ? nameOf(who) : '' });
                sound.confirm();
                useUi.getState().toast({ text: `Added ${c.title} to Up Next`, tone: 'good' });
              }}
            >
              Up Next
            </Button>
          )}
        </div>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
              <Replies owner={c.owner} critiqueId={c.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

/* ------------------------------------------------------------ Suggestions */

function Suggested() {
  const me = useOnline((s) => s.me!.id);
  const list = useOnline(useShallow((s) => s.suggestions.filter((x) => x.toUser === me)));
  const sent = useOnline(useShallow((s) => s.suggestions.filter((x) => x.fromUser === me)));
  const people = useOnline((s) => s.people);
  useEffect(() => {
    // opening this tab counts as seeing them
    const t = setTimeout(() => list.filter((x) => !x.seen).forEach((x) => void onlineActions.markSeen(x.id)), 1500);
    return () => clearTimeout(t);
  }, [list.length]);
  if (!list.length && !sent.length)
    return (
      <Empty icon="send" title="Nothing suggested yet">
        When a friend sends you a title, it lands here. You can send one from any critique with More, then Suggest to a friend.
      </Empty>
    );
  return (
    <div className="suggested">
      {list.map((s) => (
        <SuggestionCard key={s.id} s={s} from={people[s.fromUser]} />
      ))}
      {sent.length > 0 && (
        <>
          <h3 className="sent-head">You suggested</h3>
          {sent.map((s) => (
            <div key={s.id} className="sent-row">
              <Poster title={s.title} type={s.type} poster={null} url={s.posterUrl} size="sm" />
              <span>
                <b>{s.title}</b> to {nameOf(people[s.toUser])} <span className="feed-when">{relTime(s.createdAt)}</span>
              </span>
              <Button size="sm" variant="quiet" icon="close" aria-label="Remove" onClick={() => void onlineActions.dismissSuggestion(s.id)} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function SuggestionCard({ s, from }: { s: Suggestion; from?: Profile }) {
  const where = whereIs(s);
  return (
    <motion.div className={'sugg-card glass' + (s.seen ? '' : ' fresh')} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <Poster title={s.title} type={s.type} poster={null} url={s.posterUrl} size="md" />
      <div className="sugg-body">
        <span className="feed-who static">
          <Avatar src={from?.avatar} size={26} />
          <span>
            <b>{nameOf(from)}</b> thinks you should {s.type === 'game' ? 'play' : 'watch'}
          </span>
          <span className="feed-when">{relTime(s.createdAt)}</span>
        </span>
        <span className="feed-title display static">
          {s.title}
          {s.year && <span className="feed-year">{s.year}</span>}
        </span>
        {s.note && <p className="feed-remarks">“{s.note}”</p>}
        <div className="feed-foot">
          {where === 'critiqued' ? (
            <span className="feed-compare">You’ve already reviewed it</span>
          ) : where === 'watchlist' ? (
            <span className="feed-compare">Already on your Up Next</span>
          ) : (
            <Button
              size="sm"
              variant="primary"
              icon="plus"
              onClick={() => {
                addToUpNext({ title: s.title, type: s.type, year: s.year, ext: extFromKey(s.extKey), posterUrl: s.posterUrl, from: nameOf(from), note: s.note ? `${nameOf(from)}: ${s.note}` : `Suggested by ${nameOf(from)}` });
                sound.confirm();
                useUi.getState().toast({ text: `Added ${s.title} to Up Next`, tone: 'good' });
              }}
            >
              Add to Up Next
            </Button>
          )}
          <Button size="sm" variant="quiet" onClick={() => void onlineActions.dismissSuggestion(s.id)}>
            Dismiss
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
