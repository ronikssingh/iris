/* Signed-in state, friends, the feed and keeping your shared critiques up to date online. */
import { create } from 'zustand';
import { online, explain, type Friendship, type Like, type Profile, type SharedCritique, type Suggestion, type SyncedWatch } from '../online/api';
import { useLibrary } from './library';
import { useUi } from './ui';
import { mediaUrl, savePosterFromUrl } from '../lib/images';
import { classOf, extKey, normalizeCritique, normalizeExt, ratingOf, type Critique, type WatchItem } from '../shared/model';

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

export // the online copy keeps at most a dozen genres (the database refuses more)
const fitGenres = (g: string[] | undefined) => (g ?? []).slice(0, 12).map((x) => x.slice(0, 60));

function toShared(c: Critique, owner: string, posterUrl: string | null): SharedCritique {
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
    scoreNotes: c.scoreNotes,
    total: ratingOf(c),
    cls: classOf(c),
    classOverride: c.classOverride,
    recommend: c.recommend,
    favourite: c.favourite,
    hidden: c.hidden,
    genres: fitGenres(c.genres),
    posterColor: c.posterColor,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function extFromKey(k: string | null) {
  if (!k) return null;
  const [source, kind, id] = k.split(':');
  return normalizeExt({ source, kind, id });
}

function toWatchRow(w: WatchItem, owner: string, posterUrl: string | null): SyncedWatch {
  return {
    owner,
    id: w.id,
    title: w.title,
    type: w.type,
    status: w.status,
    note: w.note,
    year: w.year,
    extKey: extKey(w.ext),
    posterUrl,
    director: w.director,
    studio: w.studio,
    cast: w.cast,
    description: w.description,
    genres: fitGenres(w.genres),
    from: w.from,
    order: w.order,
    addedAt: w.addedAt,
    updatedAt: w.updatedAt,
  };
}

/** Uploads a local poster once and remembers its address, so a picture travels with the item. */
async function posterAddress(file: string | null, uploads: Record<string, string>, me: string): Promise<string | null> {
  if (!file) return null;
  if (uploads[file]) return uploads[file];
  try {
    const blob = await (await fetch(mediaUrl(file)!)).blob();
    uploads[file] = await online().uploadImage('posters', `${me}/${file}`, blob);
    return uploads[file];
  } catch {
    return null; // the item still goes up, just without its picture
  }
}

/** A poster for something coming down from the account: one already on this computer, or downloaded. */
async function localPoster(url: string | null, uploads: Record<string, string>): Promise<{ name: string | null; color: string | null }> {
  if (!url) return { name: null, color: null };
  const known = Object.entries(uploads).find(([, u]) => u === url)?.[0];
  if (known) return { name: known, color: null };
  const p = await savePosterFromUrl(url).catch(() => null);
  if (!p) return { name: null, color: null };
  uploads[p.name] = url;
  return { name: p.name, color: p.color };
}

/** Up Next, kept the same on every computer: newest change wins, deletions travel too. */
async function syncWatchlist(me: string, uploads: Record<string, string>): Promise<{ pulled: number }> {
  const api = online();
  const lib = useLibrary.getState().lib;
  const remote = new Map((await api.watchItems(me)).map((w) => [w.id, w]));
  const knew = new Set(lib.meta.syncedWatchIds);
  const local = new Map(lib.watchlist.map((w) => [w.id, w]));
  const vanished = lib.watchlist.filter((w) => knew.has(w.id) && !remote.has(w.id)).map((w) => w.id);
  // if most of what this computer shared vanished at once, the account was more likely reset than emptied
  const deletedElsewhere = vanished.length >= 3 && vanished.length > knew.size / 2 ? [] : vanished;
  const toPush: SyncedWatch[] = [];
  const toPull: SyncedWatch[] = [];
  for (const w of lib.watchlist) {
    if (deletedElsewhere.includes(w.id)) continue;
    const r = remote.get(w.id);
    if (r && r.updatedAt > w.updatedAt + 1000) toPull.push(r);
    else if (!r || Math.abs(r.updatedAt - w.updatedAt) >= 1000 || (w.poster && !uploads[w.poster])) toPush.push(toWatchRow(w, me, await posterAddress(w.poster, uploads, me)));
  }
  const gone: string[] = [];
  for (const [id, r] of remote) {
    if (local.has(id)) continue;
    if (knew.has(id)) gone.push(id); // deleted on this computer
    else toPull.push(r); // added on another one
  }
  if (toPush.length) await api.pushWatch(toPush);
  if (gone.length) await api.removeWatch(me, gone);
  const pulled: WatchItem[] = [];
  for (const r of toPull) {
    const mine = local.get(r.id);
    const pic = mine?.poster && uploads[mine.poster] === r.posterUrl ? { name: mine.poster, color: mine.posterColor } : await localPoster(r.posterUrl, uploads);
    pulled.push({
      id: r.id,
      title: r.title,
      type: r.type,
      status: r.status,
      note: r.note,
      poster: pic.name,
      posterColor: pic.color,
      year: r.year,
      director: r.director,
      studio: r.studio,
      cast: r.cast,
      description: r.description,
      ext: extFromKey(r.extKey),
      genres: r.genres,
      from: r.from,
      order: r.order,
      addedAt: r.addedAt,
      updatedAt: r.updatedAt,
    });
  }
  useLibrary.getState().mergeWatch(pulled, deletedElsewhere);
  useLibrary.getState().patchMeta({ syncedWatchIds: useLibrary.getState().lib.watchlist.map((w) => w.id) });
  return { pulled: pulled.filter((w) => !local.has(w.id)).length };
}

/** Discover verdicts: a union of every computer's, latest verdict per title. */
async function syncSwipes(me: string) {
  const api = online();
  const lib = useLibrary.getState().lib;
  const remote = new Map((await api.swipes(me)).map((w) => [w.key, w]));
  const push = lib.swipes.filter((w) => {
    const r = remote.get(w.key);
    return !r || r.verdict !== w.verdict || w.at > r.at + 1000;
  });
  if (push.length) await api.pushSwipes(me, push);
  const mine = new Map(lib.swipes.map((w) => [w.key, w]));
  useLibrary.getState().mergeSwipes([...remote.values()].filter((r) => !mine.has(r.key) || r.at > mine.get(r.key)!.at + 1000));
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
    // most likely the database isn't set up yet, or there's no internet
    set({ phase: get().profile ? 'ready' : 'needsProfile', syncNote: explain(e) });
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
      if ((st.lib.critiques === prev.lib.critiques && st.lib.watchlist === prev.lib.watchlist && st.lib.swipes === prev.lib.swipes) || get().phase !== 'ready') return;
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
      const localIds = new Set(lib.critiques.map((c) => c.id));
      const trashed = new Set(lib.trash.map((t) => t.id));
      const knew = new Set(lib.meta.syncedIds);
      // Critiques this computer shared before that are no longer online were deleted on another computer.
      // If most of them vanished at once, the online copy was more likely reset, so they're shared again instead.
      const vanished = lib.critiques.filter((c) => knew.has(c.id) && !stamps.has(c.id)).map((c) => c.id);
      const reset = vanished.length >= 3 && vanished.length > knew.size / 2;
      const deletedElsewhere = reset ? [] : vanished;
      const toPush: SharedCritique[] = [];
      const pullIds: string[] = [];
      for (const c of lib.critiques) {
        if (deletedElsewhere.includes(c.id)) continue;
        const remote = stamps.get(c.id);
        if (remote !== undefined && remote > c.updatedAt + 1000) {
          pullIds.push(c.id); // changed on another computer since
          continue;
        }
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
      // online but not here: deleted here, or written on another computer
      const gone: string[] = [];
      for (const id of stamps.keys()) {
        if (localIds.has(id)) continue;
        if (trashed.has(id) || knew.has(id)) gone.push(id);
        else pullIds.push(id);
      }
      if (gone.length) await api.remove(me.id, gone);
      let pulledCount = 0;
      if (pullIds.length) {
        const rows = (await api.critiques([me.id], 5000)).filter((r) => pullIds.includes(r.id));
        const localByUrl = new Map(Object.entries(uploads).map(([file, url]) => [url, file]));
        const pulled: Critique[] = [];
        for (const r of rows) {
          let poster: string | null = null;
          let posterColor: string | null = null;
          const local = lib.critiques.find((c) => c.id === r.id);
          if (r.posterUrl && localByUrl.has(r.posterUrl)) {
            poster = localByUrl.get(r.posterUrl)!;
            posterColor = local?.poster === poster ? local.posterColor : null;
          } else if (r.posterUrl) {
            const p = await savePosterFromUrl(r.posterUrl).catch(() => null);
            if (p) {
              poster = p.name;
              posterColor = p.color;
              uploads[p.name] = r.posterUrl;
            }
          }
          const c = normalizeCritique({ ...r, poster, posterColor: posterColor ?? r.posterColor, ext: extFromKey(r.extKey), classOverride: r.classOverride, scoreNotes: r.scoreNotes });
          // rows shared by Iris 1.1 have no chosen class: keep the class exactly as it was written
          if (!r.classOverride && classOf(c) !== r.cls) c.classOverride = r.cls;
          pulled.push(c);
        }
        useLibrary.getState().mergeCritiques(pulled);
        pulledCount = pulled.filter((c) => !localIds.has(c.id)).length;
      }
      for (const id of deletedElsewhere) useLibrary.getState().removeCritique(id);
      const now = useLibrary.getState().lib;
      useLibrary.getState().patchMeta({ posterUploads: uploads, syncedIds: [...new Set(now.critiques.map((c) => c.id))] });
      // Up Next and Discover verdicts follow you between computers too
      const { pulled: watchPulled } = await syncWatchlist(me.id, uploads);
      await syncSwipes(me.id);
      useLibrary.getState().patchMeta({ posterUploads: uploads });
      if (watchPulled) useUi.getState().toast({ text: `Brought ${watchPulled} Up Next item${watchPulled === 1 ? '' : 's'} over from your account`, tone: 'good' });
      set({ lastSync: Date.now(), syncNote: null });
      if (pulledCount) useUi.getState().toast({ text: `Brought ${pulledCount} critique${pulledCount === 1 ? '' : 's'} over from your account`, tone: 'good' });
      if (deletedElsewhere.length)
        useUi.getState().toast({
          text: `${deletedElsewhere.length === 1 ? 'A critique you deleted on another computer was' : `${deletedElsewhere.length} critiques you deleted on another computer were`} moved to Recently deleted`,
        });
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
  /** Rewinding a Discover card takes the verdict back on every computer. */
  async forgetSwipe(key: string) {
    const me = get().me;
    if (!me || get().phase !== 'ready') return;
    await online().removeSwipes(me.id, [key]).catch(() => {});
  },
  async deleteAccount() {
    await online().deleteAccount();
    useLibrary.getState().patchMeta({ onlineOwner: null, syncedIds: [], syncedWatchIds: [], posterUploads: {} });
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
