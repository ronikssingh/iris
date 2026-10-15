/* Signed-in state, friends, the feed and keeping your shared critiques up to date online. */
import { create } from 'zustand';
import { online, explain, type Friendship, type Like, type Profile, type SharedCritique, type Suggestion } from '../online/api';
import { useLibrary } from './library';
import { useUi } from './ui';
import { mediaUrl, savePosterFromUrl } from '../lib/images';
import { classOf, extKey, normalizeCritique, ratingOf, type Critique } from '../shared/model';

export type Phase = 'off' | 'loading' | 'signedOut' | 'needsProfile' | 'ready';

interface OnlineState {
  phase: Phase;
  me: { id: string; email: string } | null;
  profile: Profile | null;
  people: Record<string, Profile>;
  friendships: Friendship[];
  feed: SharedCritique[];
  likes: Like[];
  replyCounts: Record<string, number>;
  suggestions: Suggestion[];
  syncing: boolean;
  lastSync: number | null;
  syncNote: string | null;
  paused: string | null; // why sharing is paused, if it is
  start: () => Promise<void>;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
}

export const useOnline = create<OnlineState>(() => ({
  phase: 'loading',
  me: null,
  profile: null,
  people: {},
  friendships: [],
  feed: [],
  likes: [],
  replyCounts: {},
  suggestions: [],
  syncing: false,
  lastSync: null,
  syncNote: null,
  paused: null,
  start: async () => {},
  refresh: async () => {},
  sync: async () => {},
}));

const set = useOnline.setState;
const get = useOnline.getState;

/* ------------------------------------------------------------- helpers */

export const friendIds = (s = get()) =>
  s.friendships.filter((f) => f.status === 'accepted').map((f) => (f.requester === s.me?.id ? f.addressee : f.requester));
export const incoming = (s = get()) => s.friendships.filter((f) => f.status === 'pending' && f.addressee === s.me?.id);
export const outgoing = (s = get()) => s.friendships.filter((f) => f.status === 'pending' && f.requester === s.me?.id);
export const nameOf = (p: Profile | undefined | null) => (p ? p.displayName || '@' + p.username : 'Someone');

async function rememberPeople(ids: string[]) {
  const have = get().people;
  const need = [...new Set(ids)].filter((i) => i && !have[i]);
  if (!need.length) return;
  const ps = await online().profiles(need);
  set({ people: { ...get().people, ...Object.fromEntries(ps.map((p) => [p.id, p])) } });
}

export function toShared(c: Critique, owner: string, posterUrl: string | null): SharedCritique {
  return {
    owner,
    id: c.id,
    title: c.title,
    type: c.type,
    year: c.year,
    extKey: extKey(c.ext),
    posterUrl,
    director: c.director,
    studio: c.studio,
    cast: c.cast,
    description: c.description,
    comments: c.comments,
    finalRemarks: c.finalRemarks,
    scores: c.scores,
    total: ratingOf(c),
    cls: classOf(c),
    recommend: c.recommend,
    favourite: c.favourite,
    hidden: c.hidden,
    genres: c.genres,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function extFromKey(k: string | null) {
  if (!k) return null;
  const [source, kind, id] = k.split(':');
  return { source, kind, id };
}

/* ------------------------------------------------------------- lifecycle */

let started = false;
let unsub: (() => void) | null = null;
let syncTimer: number | null = null;
let pollTimer: number | null = null;

async function afterSignIn(me: { id: string; email: string }) {
  set({ me, phase: 'loading' });
  try {
    const [p] = await online().profiles([me.id]);
    if (!p) {
      set({ phase: 'needsProfile', profile: null });
      return;
    }
    set({ profile: p, people: { ...get().people, [p.id]: p }, phase: 'ready' });
    await get().refresh();
    void get().sync();
  } catch (e) {
    set({ phase: 'ready', syncNote: explain(e) });
  }
}

useOnline.setState({
  start: async () => {
    if (started) return;
    started = true;
    const api = online();
    if (!api.configured) {
      set({ phase: 'off' });
      return;
    }
    unsub = api.onAuth((s) => {
      if (!s) {
        set({ phase: 'signedOut', me: null, profile: null, friendships: [], feed: [], suggestions: [], likes: [] });
      } else if (s.id !== get().me?.id) void afterSignIn(s);
    });
    const s = await api.session().catch(() => null);
    if (s) await afterSignIn(s);
    else set({ phase: 'signedOut' });
    // keep shared critiques current as you write
    useLibrary.subscribe((st, prev) => {
      if (st.lib.critiques === prev.lib.critiques || get().phase !== 'ready') return;
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => void get().sync(), 4000);
    });
    pollTimer = window.setInterval(() => {
      if (get().phase === 'ready' && document.visibilityState === 'visible') void get().refresh();
    }, 90_000);
    window.addEventListener('focus', () => {
      if (get().phase === 'ready') void get().refresh();
    });
  },

  refresh: async () => {
    const me = get().me;
    if (!me) return;
    const api = online();
    try {
      const friendships = await api.friendships();
      set({ friendships });
      const ids = friendIds();
      const [feed, likes, replyCounts, suggestions] = await Promise.all([
        api.critiques(ids, 80),
        api.likes([...ids, me.id]),
        api.replyCounts([...ids, me.id]),
        api.suggestions(),
      ]);
      const before = get().suggestions;
      set({ feed, likes, replyCounts, suggestions });
      await rememberPeople([
        ...friendships.flatMap((f) => [f.requester, f.addressee]),
        ...likes.map((l) => l.userId),
        ...suggestions.flatMap((s) => [s.fromUser, s.toUser]),
      ]);
      const fresh = suggestions.filter((s) => s.toUser === me.id && !s.seen && !before.some((b) => b.id === s.id));
      if (before.length && fresh.length) useUi.getState().toast({ text: `${nameOf(get().people[fresh[0].fromUser])} suggested ${fresh[0].title}`, tone: 'good' });
    } catch (e) {
      set({ syncNote: explain(e) });
    }
  },

  sync: async () => {
    const me = get().me;
    if (!me || get().phase !== 'ready' || get().syncing) return;
    const libState = useLibrary.getState();
    const lib = libState.lib;
    if (lib.meta.onlineOwner && lib.meta.onlineOwner !== me.id) {
      set({ paused: 'This library is shared from a different account, so Iris won’t mix the two. Sign in with that account to keep sharing.' });
      return;
    }
    set({ syncing: true, paused: null });
    const api = online();
    try {
      if (!lib.meta.onlineOwner) libState.patchMeta({ onlineOwner: me.id });
      const stamps = new Map((await api.myStamps(me.id)).map((s) => [s.id, s.updatedAt]));
      const uploads = { ...useLibrary.getState().lib.meta.posterUploads };
      const toPush: SharedCritique[] = [];
      for (const c of lib.critiques) {
        const remote = stamps.get(c.id);
        const needsPoster = !!c.poster && !uploads[c.poster];
        if (remote !== undefined && Math.abs(remote - c.updatedAt) < 1000 && !needsPoster) continue;
        if (c.poster && !uploads[c.poster]) {
          try {
            const blob = await (await fetch(mediaUrl(c.poster)!)).blob();
            uploads[c.poster] = await api.uploadImage('posters', `${me.id}/${c.poster}`, blob);
          } catch {
            /* the critique still goes up, just without its poster */
          }
        }
        toPush.push(toShared(c, me.id, c.poster ? (uploads[c.poster] ?? null) : null));
      }
      if (toPush.length) await api.push(toPush);
      // anything online that isn't here: deleted here, or written on your other computer
      const localIds = new Set(lib.critiques.map((c) => c.id));
      const trashed = new Set(lib.trash.map((t) => t.id));
      const knew = new Set(lib.meta.syncedIds);
      const gone: string[] = [];
      const pullIds: string[] = [];
      for (const id of stamps.keys()) {
        if (localIds.has(id)) continue;
        if (trashed.has(id) || knew.has(id)) gone.push(id);
        else pullIds.push(id);
      }
      if (gone.length) await api.remove(me.id, gone);
      if (pullIds.length) {
        const rows = (await api.critiques([me.id], 5000)).filter((r) => pullIds.includes(r.id));
        const pulled: Critique[] = [];
        for (const r of rows) {
          let poster: string | null = null;
          let posterColor: string | null = null;
          if (r.posterUrl) {
            const p = await savePosterFromUrl(r.posterUrl).catch(() => null);
            if (p) {
              poster = p.name;
              posterColor = p.color;
              uploads[p.name] = r.posterUrl;
            }
          }
          pulled.push(
            normalizeCritique({
              ...r,
              cast: r.cast,
              poster,
              posterColor,
              ext: extFromKey(r.extKey),
              classOverride: null,
            }),
          );
        }
        // keep the class exactly as it was written
        for (const c of pulled) {
          const r = rows.find((x) => x.id === c.id)!;
          if (classOf(c) !== r.cls) c.classOverride = r.cls;
        }
        useLibrary.getState().mergeCritiques(pulled);
        if (pulled.length) useUi.getState().toast({ text: `Brought ${pulled.length} critique${pulled.length === 1 ? '' : 's'} over from your account`, tone: 'good' });
      }
      const now = useLibrary.getState().lib;
      useLibrary.getState().patchMeta({ posterUploads: uploads, syncedIds: [...new Set([...now.critiques.map((c) => c.id)])] });
      set({ lastSync: Date.now(), syncNote: null });
    } catch (e) {
      set({ syncNote: explain(e) });
    } finally {
      set({ syncing: false });
    }
  },
});

/* ------------------------------------------------------------- actions */

export const onlineActions = {
  async createProfile(p: Omit<Profile, 'id' | 'createdAt'>) {
    const me = get().me!;
    const prof: Profile = { ...p, id: me.id, createdAt: Date.now() };
    if (await online().usernameTaken(p.username, me.id)) throw new Error('That username is taken. Try another.');
    await online().saveProfile(prof, true);
    set({ profile: prof, people: { ...get().people, [me.id]: prof }, phase: 'ready' });
    await get().refresh();
    void get().sync();
  },
  async updateProfile(p: Partial<Profile>) {
    const cur = get().profile!;
    const next = { ...cur, ...p };
    if (p.username && p.username !== cur.username && (await online().usernameTaken(p.username, cur.id))) throw new Error('That username is taken. Try another.');
    await online().saveProfile(next, false);
    set({ profile: next, people: { ...get().people, [next.id]: next } });
  },
  async uploadAvatar(blob: Blob): Promise<string> {
    const me = get().me!;
    const url = await online().uploadImage('avatars', `${me.id}/avatar-${Date.now()}.jpg`, blob);
    return url;
  },
  async search(q: string) {
    const me = get().me!;
    const ps = await online().searchProfiles(q, me.id);
    set({ people: { ...get().people, ...Object.fromEntries(ps.map((p) => [p.id, p])) } });
    return ps;
  },
  async request(to: string) {
    await online().request(get().me!.id, to);
    await get().refresh();
  },
  async accept(from: string) {
    await online().accept(from, get().me!.id);
    await get().refresh();
  },
  async remove(f: Friendship) {
    await online().removeFriendship(f.requester, f.addressee);
    await get().refresh();
  },
  async toggleLike(owner: string, critiqueId: string) {
    const me = get().me!.id;
    const liked = get().likes.some((l) => l.owner === owner && l.critiqueId === critiqueId && l.userId === me);
    // answer instantly, then tell the server
    set({ likes: liked ? get().likes.filter((l) => !(l.owner === owner && l.critiqueId === critiqueId && l.userId === me)) : [...get().likes, { owner, critiqueId, userId: me }] });
    try {
      if (liked) await online().unlike(owner, critiqueId, me);
      else await online().like(owner, critiqueId, me);
    } catch (e) {
      useUi.getState().toast({ text: explain(e), tone: 'bad' });
      await get().refresh();
    }
  },
  async replies(owner: string, critiqueId: string) {
    const rs = await online().replies(owner, critiqueId);
    await rememberPeople(rs.map((r) => r.userId));
    return rs;
  },
  async reply(owner: string, critiqueId: string, body: string) {
    await online().reply(owner, critiqueId, get().me!.id, body.trim().slice(0, 500));
    const k = owner + '/' + critiqueId;
    set({ replyCounts: { ...get().replyCounts, [k]: (get().replyCounts[k] ?? 0) + 1 } });
  },
  async deleteReply(owner: string, critiqueId: string, id: string) {
    await online().deleteReply(id);
    const k = owner + '/' + critiqueId;
    set({ replyCounts: { ...get().replyCounts, [k]: Math.max(0, (get().replyCounts[k] ?? 1) - 1) } });
  },
  async critiquesOf(userId: string) {
    return online().critiques([userId], 1000);
  },
  async suggest(to: string, item: { title: string; type: Critique['type']; year: string; extKey: string | null; posterUrl: string | null }, note: string) {
    await online().suggest({ fromUser: get().me!.id, toUser: to, ...item, note });
  },
  async markSeen(id: string) {
    set({ suggestions: get().suggestions.map((s) => (s.id === id ? { ...s, seen: true } : s)) });
    await online().markSeen(id).catch(() => {});
  },
  async dismissSuggestion(id: string) {
    set({ suggestions: get().suggestions.filter((s) => s.id !== id) });
    await online().removeSuggestion(id).catch(() => {});
  },
  async signOut() {
    await online().signOut();
    set({ phase: 'signedOut', me: null, profile: null });
  },
  async deleteAccount() {
    await online().deleteAccount();
    useLibrary.getState().patchMeta({ onlineOwner: null, syncedIds: [], posterUploads: {} });
    set({ phase: 'signedOut', me: null, profile: null, friendships: [], feed: [], suggestions: [], likes: [] });
  },
  stop() {
    unsub?.();
    if (pollTimer) clearInterval(pollTimer);
  },
};

/** How closely two people's ratings agree on the titles they've both reviewed (0..100), or null with too little overlap. */
export function tasteMatch(mine: Critique[], theirs: SharedCritique[]): { score: number | null; shared: { mine: Critique; theirs: SharedCritique }[] } {
  const key = (t: string, type: string) => type + '|' + t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const byExt = new Map(theirs.filter((t) => t.extKey).map((t) => [t.extKey!, t]));
  const byTitle = new Map(theirs.map((t) => [key(t.title, t.type), t]));
  const shared: { mine: Critique; theirs: SharedCritique }[] = [];
  for (const c of mine) {
    const t = (c.ext && byExt.get(extKey(c.ext)!)) || byTitle.get(key(c.title, c.type));
    if (t) shared.push({ mine: c, theirs: t });
  }
  if (shared.length < 2) return { score: null, shared };
  const diff = shared.reduce((a, s) => a + Math.abs(ratingOf(s.mine) - s.theirs.total), 0) / shared.length;
  return { score: Math.max(0, Math.round(100 - diff / 3)), shared };
}
