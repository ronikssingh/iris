/* Everything Iris says to the online service. One real implementation (Supabase) and one pretend
   server used by the automated tests, both behind the same small interface. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ClassKey, MediaType, ScoreKey } from '../shared/model';
import { appInfo } from '../lib/appInfo';

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  avatar: string; // 'world:<id>' for a world picture, an https address for an uploaded one ('preset:N' from 1.1 still works)
  bio: string;
  createdAt: number;
}

export interface SharedCritique {
  owner: string;
  id: string;
  title: string;
  type: MediaType;
  year: string;
  extKey: string | null;
  posterUrl: string | null;
  director: string;
  studio: string;
  cast: string;
  description: string;
  comments: string;
  finalRemarks: string;
  scores: Record<ScoreKey, number>;
  scoreNotes: Partial<Record<ScoreKey, string>>;
  total: number;
  cls: ClassKey;
  classOverride: ClassKey | null;
  recommend: 'yes' | 'no' | null;
  favourite: boolean;
  hidden: boolean;
  genres: string[];
  posterColor: string | null;
  createdAt: number;
  updatedAt: number;
}

/** An Up Next item, kept in step across your own computers. Nobody else can see these. */
export interface SyncedWatch {
  owner: string;
  id: string;
  title: string;
  type: MediaType;
  status: 'want' | 'watched';
  note: string;
  year: string;
  extKey: string | null;
  posterUrl: string | null;
  director: string;
  studio: string;
  cast: string;
  description: string;
  genres: string[];
  from: string;
  order: number;
  addedAt: number;
  updatedAt: number;
}

/** A Discover verdict, so a title never comes round again on any of your computers. */
export interface SyncedSwipe {
  key: string;
  title: string;
  type: MediaType;
  verdict: 'like' | 'skip' | 'seen';
  at: number;
}

export interface Friendship {
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
  createdAt: number;
  acceptedAt: number | null;
}

export interface Like {
  owner: string;
  critiqueId: string;
  userId: string;
}

export interface Reply {
  id: string;
  owner: string;
  critiqueId: string;
  userId: string;
  body: string;
  createdAt: number;
}

export interface Suggestion {
  id: string;
  fromUser: string;
  toUser: string;
  title: string;
  type: MediaType;
  year: string;
  extKey: string | null;
  posterUrl: string | null;
  note: string;
  seen: boolean;
  createdAt: number;
}

export interface OnlineApi {
  readonly configured: boolean;
  session(): Promise<{ id: string; email: string } | null>;
  onAuth(cb: (s: { id: string; email: string } | null) => void): () => void;
  signUp(email: string, password: string): Promise<{ needsCode: boolean }>;
  verifySignup(email: string, code: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  sendReset(email: string): Promise<void>;
  resetWithCode(email: string, code: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  profiles(ids: string[]): Promise<Profile[]>;
  saveProfile(p: Profile, isNew: boolean): Promise<void>;
  usernameTaken(name: string, exceptId: string): Promise<boolean>;
  searchProfiles(q: string, exceptId: string): Promise<Profile[]>;
  uploadImage(bucket: 'avatars' | 'posters', path: string, blob: Blob): Promise<string>;
  friendships(): Promise<Friendship[]>;
  request(from: string, to: string): Promise<void>;
  accept(requester: string, addressee: string): Promise<void>;
  removeFriendship(requester: string, addressee: string): Promise<void>;
  myStamps(owner: string): Promise<{ id: string; updatedAt: number }[]>;
  push(rows: SharedCritique[]): Promise<void>;
  remove(owner: string, ids: string[]): Promise<void>;
  critiques(owners: string[], limit: number, since?: number): Promise<SharedCritique[]>;
  likes(owners: string[]): Promise<Like[]>;
  like(owner: string, critiqueId: string, userId: string): Promise<void>;
  unlike(owner: string, critiqueId: string, userId: string): Promise<void>;
  replies(owner: string, critiqueId: string): Promise<Reply[]>;
  replyCounts(owners: string[]): Promise<Record<string, number>>;
  reply(owner: string, critiqueId: string, userId: string, body: string): Promise<void>;
  deleteReply(id: string): Promise<void>;
  suggestions(): Promise<Suggestion[]>;
  suggest(s: Omit<Suggestion, 'id' | 'seen' | 'createdAt'>): Promise<void>;
  markSeen(id: string): Promise<void>;
  removeSuggestion(id: string): Promise<void>;
  watchItems(owner: string): Promise<SyncedWatch[]>;
  pushWatch(rows: SyncedWatch[]): Promise<void>;
  removeWatch(owner: string, ids: string[]): Promise<void>;
  swipes(owner: string): Promise<SyncedSwipe[]>;
  pushSwipes(owner: string, rows: SyncedSwipe[]): Promise<void>;
  removeSwipes(owner: string, keys: string[]): Promise<void>;
}

/** Turns service errors into a sentence a person can act on. */
export function explain(e: any): string {
  const m = String(e?.message || e || '');
  if (/invalid login credentials/i.test(m)) return 'That email and password don’t match an account.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first: click the link or type the code from the email Iris sent you.';
  if (/email address not authorized|error sending (confirmation|recovery|magic link)? ?email|smtp/i.test(m))
    return 'The confirmation email couldn’t be sent. Whoever runs this copy of Iris needs to finish the email step in supabase/README.md.';
  if (/signups? not allowed|signup.*disabled/i.test(m)) return 'New accounts are switched off for this copy of Iris.';
  if (/email.*invalid|invalid.*email|unable to validate email/i.test(m)) return 'That doesn’t look like an email address.';
  if (/user already registered/i.test(m)) return 'There’s already an account with that email. Sign in instead.';
  if (/password should be at least/i.test(m)) return 'Use a password with at least 6 characters.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries in a row. Wait a minute and try again.';
  if (/token has expired|invalid.*otp|otp.*invalid/i.test(m)) return 'That code didn’t work. Check it, or ask for a new one.';
  if (/failed to fetch|network|fetch failed/i.test(m)) return 'Iris can’t reach the internet right now.';
  if (/relation .* does not exist|schema cache|could not find the (table|function)/i.test(m)) return 'The online database isn’t set up yet. Run supabase/setup.sql in Supabase’s SQL Editor, then try again.';
  if (/duplicate key.*username|profiles_username_key/i.test(m)) return 'That username is taken. Try another.';
  if (/check constraint.*username/i.test(m)) return 'Usernames use 3 to 20 lowercase letters, numbers, dots or underscores.';
  return m || 'Something went wrong. Try again.';
}

/* --------------------------------------------------------------- Supabase */

const t = (v: any) => (v ? Date.parse(v) : 0);
const PUBLIC_PROFILE = 'id, username, avatar, created_at';
const fromProfile = (r: any): Profile => ({
  id: r.id,
  username: String(r.username),
  displayName: r.display_name ?? '',
  avatar: r.avatar ?? 'world:winedark',
  bio: r.bio ?? '',
  createdAt: t(r.created_at),
});
const fromCritique = (r: any): SharedCritique => ({
  owner: r.user_id,
  id: r.id,
  title: r.title,
  type: r.type,
  year: r.year ?? '',
  extKey: r.ext_key ?? null,
  posterUrl: r.poster_url ?? null,
  director: r.director ?? '',
  studio: r.studio ?? '',
  cast: r.cast_list ?? '',
  description: r.description ?? '',
  comments: r.comments ?? '',
  finalRemarks: r.final_remarks ?? '',
  scores: r.scores ?? {},
  scoreNotes: r.score_notes ?? {},
  total: r.total ?? 0,
  cls: r.class,
  classOverride: r.class_override ?? null,
  recommend: r.recommend ?? null,
  favourite: !!r.favourite,
  hidden: !!r.hidden,
  genres: r.genres ?? [],
  posterColor: r.poster_color ?? null,
  createdAt: t(r.created_at),
  updatedAt: t(r.updated_at),
});
const toCritique = (c: SharedCritique) => ({
  user_id: c.owner,
  id: c.id,
  title: c.title.slice(0, 300),
  type: c.type,
  year: c.year.slice(0, 12),
  ext_key: c.extKey,
  poster_url: c.posterUrl,
  director: c.director.slice(0, 400),
  studio: c.studio.slice(0, 400),
  cast_list: c.cast.slice(0, 2000),
  description: c.description.slice(0, 6000),
  comments: c.comments.slice(0, 20000),
  final_remarks: c.finalRemarks.slice(0, 6000),
  scores: c.scores,
  score_notes: c.scoreNotes ?? {},
  total: c.total,
  class: c.cls,
  class_override: c.classOverride ?? null,
  recommend: c.recommend,
  favourite: c.favourite,
  hidden: c.hidden,
  genres: c.genres,
  poster_color: c.posterColor ?? null,
  created_at: new Date(c.createdAt).toISOString(),
  updated_at: new Date(c.updatedAt).toISOString(),
});
const fromWatch = (r: any): SyncedWatch => ({
  owner: r.user_id,
  id: r.id,
  title: r.title,
  type: r.type,
  status: r.status === 'watched' ? 'watched' : 'want',
  note: r.note ?? '',
  year: r.year ?? '',
  extKey: r.ext_key ?? null,
  posterUrl: r.poster_url ?? null,
  director: r.director ?? '',
  studio: r.studio ?? '',
  cast: r.cast_list ?? '',
  description: r.description ?? '',
  genres: r.genres ?? [],
  from: r.from_name ?? '',
  order: Number(r.sort_order) || 0,
  addedAt: t(r.added_at),
  updatedAt: t(r.updated_at),
});
const toWatch = (w: SyncedWatch) => ({
  user_id: w.owner,
  id: w.id,
  title: w.title.slice(0, 300),
  type: w.type,
  status: w.status,
  note: w.note.slice(0, 300),
  year: w.year.slice(0, 12),
  ext_key: w.extKey,
  poster_url: w.posterUrl,
  director: w.director.slice(0, 400),
  studio: w.studio.slice(0, 400),
  cast_list: w.cast.slice(0, 2000),
  description: w.description.slice(0, 6000),
  genres: w.genres,
  from_name: w.from.slice(0, 40),
  sort_order: w.order,
  added_at: new Date(w.addedAt).toISOString(),
  updated_at: new Date(w.updatedAt).toISOString(),
});
const fromSuggestion = (r: any): Suggestion => ({
  id: r.id,
  fromUser: r.from_user,
  toUser: r.to_user,
  title: r.title,
  type: r.type,
  year: r.year ?? '',
  extKey: r.ext_key ?? null,
  posterUrl: r.poster_url ?? null,
  note: r.note ?? '',
  seen: !!r.seen,
  createdAt: t(r.created_at),
});

function check<T>(r: { data: T; error: any } | { data: any; error: any }): T {
  if (r.error) throw r.error;
  return r.data;
}

export class SupabaseApi implements OnlineApi {
  readonly configured = true;
  private sb: SupabaseClient;
  constructor(url: string, key: string, storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }) {
    this.sb = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'iris-online', ...(storage ? { storage } : {}) },
    });
  }
  async session() {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    return u ? { id: u.id, email: u.email ?? '' } : null;
  }
  onAuth(cb: (s: { id: string; email: string } | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_e, s) => cb(s?.user ? { id: s.user.id, email: s.user.email ?? '' } : null));
    return () => data.subscription.unsubscribe();
  }
  async signUp(email: string, password: string) {
    const r = check(await this.sb.auth.signUp({ email, password }));
    return { needsCode: !r.session };
  }
  async verifySignup(email: string, code: string) {
    check(await this.sb.auth.verifyOtp({ email, token: code.trim(), type: 'signup' }));
  }
  async signIn(email: string, password: string) {
    check(await this.sb.auth.signInWithPassword({ email, password }));
  }
  async sendReset(email: string) {
    check(await this.sb.auth.resetPasswordForEmail(email));
  }
  async resetWithCode(email: string, code: string, password: string) {
    check(await this.sb.auth.verifyOtp({ email, token: code.trim(), type: 'recovery' }));
    check(await this.sb.auth.updateUser({ password }));
  }
  async signOut() {
    await this.sb.auth.signOut();
  }
  async deleteAccount() {
    // pictures first, while this account can still reach its own folders
    const me = (await this.sb.auth.getUser()).data.user?.id;
    if (me) {
      for (const bucket of ['avatars', 'posters'] as const) {
        try {
          const files = check(await this.sb.storage.from(bucket).list(me, { limit: 1000 })) as any[];
          const paths = (files ?? []).map((f) => `${me}/${f.name}`);
          for (let i = 0; i < paths.length; i += 100) await this.sb.storage.from(bucket).remove(paths.slice(i, i + 100));
        } catch {
          /* leftover pictures are harmless */
        }
      }
    }
    check(await this.sb.rpc('delete_my_account'));
    await this.sb.auth.signOut();
  }
  async profiles(ids: string[]) {
    if (!ids.length) return [];
    // Anyone signed in may see a username and picture. Names and bios come back only for yourself and friends.
    const rows = check(await this.sb.from('profiles').select(PUBLIC_PROFILE).in('id', ids)) as any[];
    const extra = check(await this.sb.rpc('profile_details', { ids })) as any[];
    const byId = new Map((extra ?? []).map((r) => [r.id, r]));
    return rows.map((r) => fromProfile({ ...r, ...(byId.get(r.id) ?? {}) }));
  }
  async saveProfile(p: Profile, isNew: boolean) {
    const row = { username: p.username.toLowerCase(), display_name: p.displayName, avatar: p.avatar, bio: p.bio, updated_at: new Date().toISOString() };
    // an update names only the columns a person may change (the database refuses anything else)
    if (isNew) check(await this.sb.from('profiles').insert({ id: p.id, ...row }));
    else check(await this.sb.from('profiles').update(row).eq('id', p.id));
  }
  async usernameTaken(name: string, exceptId: string) {
    const rows = check(await this.sb.from('profiles').select('id').eq('username', name.toLowerCase()).neq('id', exceptId).limit(1)) as any[];
    return rows.length > 0;
  }
  async searchProfiles(q: string, exceptId: string) {
    const clean = q.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_.]/g, '');
    if (clean.length < 2) return [];
    const rows = check(await this.sb.from('profiles').select(PUBLIC_PROFILE).ilike('username', `%${clean}%`).neq('id', exceptId).limit(12)) as any[];
    // closest usernames first
    return rows
      .map(fromProfile)
      .sort((a, b) => Number(b.username === clean) - Number(a.username === clean) || Number(b.username.startsWith(clean)) - Number(a.username.startsWith(clean)) || a.username.localeCompare(b.username));
  }
  async uploadImage(bucket: 'avatars' | 'posters', path: string, blob: Blob) {
    check(await this.sb.storage.from(bucket).upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg', cacheControl: '31536000' }));
    return this.sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  async friendships() {
    return (check(await this.sb.from('friendships').select('*')) as any[]).map((r) => ({
      requester: r.requester,
      addressee: r.addressee,
      status: r.status,
      createdAt: t(r.created_at),
      acceptedAt: r.accepted_at ? t(r.accepted_at) : null,
    }));
  }
  async request(from: string, to: string) {
    check(await this.sb.from('friendships').insert({ requester: from, addressee: to }));
  }
  async accept(requester: string, addressee: string) {
    check(await this.sb.from('friendships').update({ status: 'accepted' }).eq('requester', requester).eq('addressee', addressee));
  }
  async removeFriendship(requester: string, addressee: string) {
    check(await this.sb.from('friendships').delete().eq('requester', requester).eq('addressee', addressee));
  }
  async myStamps(owner: string) {
    const rows = check(await this.sb.from('critiques').select('id, updated_at').eq('user_id', owner).limit(5000)) as any[];
    return rows.map((r) => ({ id: r.id, updatedAt: t(r.updated_at) }));
  }
  async push(rows: SharedCritique[]) {
    for (let i = 0; i < rows.length; i += 50) check(await this.sb.from('critiques').upsert(rows.slice(i, i + 50).map(toCritique), { onConflict: 'user_id,id' }));
  }
  async remove(owner: string, ids: string[]) {
    for (let i = 0; i < ids.length; i += 100) check(await this.sb.from('critiques').delete().eq('user_id', owner).in('id', ids.slice(i, i + 100)));
  }
  async critiques(owners: string[], limit: number, since?: number) {
    if (!owners.length) return [];
    let q = this.sb.from('critiques').select('*').in('user_id', owners).order('updated_at', { ascending: false }).limit(limit);
    if (since) q = q.gt('updated_at', new Date(since).toISOString());
    return (check(await q) as any[]).map(fromCritique);
  }
  async likes(owners: string[]) {
    if (!owners.length) return [];
    const rows = check(await this.sb.from('likes').select('owner, critique_id, user_id').in('owner', owners).limit(5000)) as any[];
    return rows.map((r) => ({ owner: r.owner, critiqueId: r.critique_id, userId: r.user_id }));
  }
  async like(owner: string, critiqueId: string, userId: string) {
    check(await this.sb.from('likes').upsert({ owner, critique_id: critiqueId, user_id: userId }, { onConflict: 'owner,critique_id,user_id', ignoreDuplicates: true }));
  }
  async unlike(owner: string, critiqueId: string, userId: string) {
    check(await this.sb.from('likes').delete().eq('owner', owner).eq('critique_id', critiqueId).eq('user_id', userId));
  }
  async replies(owner: string, critiqueId: string) {
    const rows = check(await this.sb.from('comments').select('*').eq('owner', owner).eq('critique_id', critiqueId).order('created_at', { ascending: true })) as any[];
    return rows.map((r) => ({ id: r.id, owner: r.owner, critiqueId: r.critique_id, userId: r.user_id, body: r.body, createdAt: t(r.created_at) }));
  }
  async replyCounts(owners: string[]) {
    if (!owners.length) return {};
    const rows = check(await this.sb.from('comments').select('owner, critique_id').in('owner', owners).limit(5000)) as any[];
    const out: Record<string, number> = {};
    for (const r of rows) out[r.owner + '/' + r.critique_id] = (out[r.owner + '/' + r.critique_id] ?? 0) + 1;
    return out;
  }
  async reply(owner: string, critiqueId: string, userId: string, body: string) {
    check(await this.sb.from('comments').insert({ owner, critique_id: critiqueId, user_id: userId, body }));
  }
  async deleteReply(id: string) {
    check(await this.sb.from('comments').delete().eq('id', id));
  }
  async suggestions() {
    return (check(await this.sb.from('suggestions').select('*').order('created_at', { ascending: false }).limit(200)) as any[]).map(fromSuggestion);
  }
  async suggest(s: Omit<Suggestion, 'id' | 'seen' | 'createdAt'>) {
    check(
      await this.sb.from('suggestions').insert({
        from_user: s.fromUser,
        to_user: s.toUser,
        title: s.title,
        type: s.type,
        year: s.year,
        ext_key: s.extKey,
        poster_url: s.posterUrl,
        note: s.note.slice(0, 200),
      }),
    );
  }
  async markSeen(id: string) {
    check(await this.sb.from('suggestions').update({ seen: true }).eq('id', id));
  }
  async removeSuggestion(id: string) {
    check(await this.sb.from('suggestions').delete().eq('id', id));
  }
  async watchItems(owner: string) {
    return (check(await this.sb.from('watchlist').select('*').eq('user_id', owner).limit(5000)) as any[]).map(fromWatch);
  }
  async pushWatch(rows: SyncedWatch[]) {
    for (let i = 0; i < rows.length; i += 100) check(await this.sb.from('watchlist').upsert(rows.slice(i, i + 100).map(toWatch), { onConflict: 'user_id,id' }));
  }
  async removeWatch(owner: string, ids: string[]) {
    for (let i = 0; i < ids.length; i += 100) check(await this.sb.from('watchlist').delete().eq('user_id', owner).in('id', ids.slice(i, i + 100)));
  }
  async swipes(owner: string) {
    const rows = check(await this.sb.from('swipes').select('key, title, type, verdict, at').eq('user_id', owner).limit(10000)) as any[];
    return rows.map((r) => ({ key: r.key, title: r.title ?? '', type: r.type, verdict: r.verdict, at: t(r.at) }));
  }
  async pushSwipes(owner: string, rows: SyncedSwipe[]) {
    const body = rows.map((w) => ({ user_id: owner, key: w.key.slice(0, 80), title: w.title.slice(0, 300), type: w.type, verdict: w.verdict, at: new Date(w.at).toISOString() }));
    for (let i = 0; i < body.length; i += 200) check(await this.sb.from('swipes').upsert(body.slice(i, i + 200), { onConflict: 'user_id,key' }));
  }
  async removeSwipes(owner: string, keys: string[]) {
    for (let i = 0; i < keys.length; i += 100) check(await this.sb.from('swipes').delete().eq('user_id', owner).in('key', keys.slice(i, i + 100)));
  }
}

/* ------------------------------------------------- Pretend server for tests */

class FakeApi implements OnlineApi {
  readonly configured = true;
  private me: { id: string; email: string } | null = null;
  private listeners = new Set<(s: { id: string; email: string } | null) => void>();
  private profilesById = new Map<string, Profile>();
  private friends: Friendship[] = [];
  private rows: SharedCritique[] = [];
  private likeRows: Like[] = [];
  private replyRows: Reply[] = [];
  private sugg: Suggestion[] = [];
  private watch: SyncedWatch[] = [];
  private swipeRows: (SyncedSwipe & { owner: string })[] = [];
  constructor() {
    const now = Date.now();
    const people: Profile[] = [
      { id: 'u-sam', username: 'sam.k', displayName: 'Sam', avatar: 'world:sundown', bio: 'Will watch anything with a heist in it.', createdAt: now - 9e9 },
      { id: 'u-maya', username: 'maya_reels', displayName: 'Maya', avatar: 'world:spiritgrove', bio: 'Slow cinema, loud soundtracks.', createdAt: now - 8e9 },
      { id: 'u-jo', username: 'jo.plays', displayName: 'Jo', avatar: 'world:megacity', bio: 'Mostly games. Some anime.', createdAt: now - 7e9 },
      { id: 'u-lee', username: 'leewatches', displayName: 'Lee', avatar: 'world:moonwake', bio: '', createdAt: now - 6e9 },
    ];
    for (const p of people) this.profilesById.set(p.id, p);
    const mk = (owner: string, id: string, title: string, type: MediaType, base: number, ago: number, extra: Partial<SharedCritique> = {}): SharedCritique => {
      const keys: ScoreKey[] = ['story', 'screenplay', 'characters', 'acting', 'visuals', 'soundtrack', 'production', 'vision', 'pacing', 'enjoyment'];
      const scores = Object.fromEntries(keys.map((k, i) => [k, Math.max(0, Math.min(100, Math.round(base + Math.sin(i * 1.7 + title.length) * 6)))])) as Record<ScoreKey, number>;
      const total = Object.values(scores).reduce((a, b) => a + b, 0);
      const cls: ClassKey = total >= 960 ? 'masterpiece' : total >= 900 ? 'perfect' : total >= 800 ? 'great' : total >= 650 ? 'good' : total >= 500 ? 'average' : total >= 300 ? 'below' : 'terrible';
      return { owner, id, title, type, year: '', extKey: null, posterUrl: null, director: '', studio: '', cast: '', description: '', comments: '', finalRemarks: '', scores, scoreNotes: {}, total, cls, classOverride: null, recommend: total > 700 ? 'yes' : 'no', favourite: false, hidden: false, genres: [], posterColor: null, createdAt: now - ago, updatedAt: now - ago, ...extra };
    };
    this.rows.push(
      mk('u-sam', 's1', 'Dune: Part Two', 'movie', 96, 3.6e6, { year: '2024', director: 'Denis Villeneuve', finalRemarks: 'The sound alone is worth the ticket. Rewatching in IMAX this weekend.', favourite: true }),
      mk('u-maya', 'm1', 'Past Lives', 'movie', 91, 2.2e7, { year: '2023', finalRemarks: 'Quietly devastating. The bar scene will stay with me.' }),
      mk('u-jo', 'j1', 'Elden Ring', 'game', 97, 5e7, { year: '2022', finalRemarks: 'Every corner hides something. Best open world I have played.', favourite: true }),
      mk('u-sam', 's2', 'The Bear', 'show', 90, 9e7, { year: '2022', finalRemarks: 'Stressful in the best way.' }),
      mk('u-maya', 'm2', 'Interstellar', 'movie', 93, 1.4e8, { year: '2014', finalRemarks: 'Cried at the docking scene again.', favourite: true }),
      mk('u-jo', 'j2', 'Hades', 'game', 92, 2e8, { year: '2020', finalRemarks: 'One more run. Always one more run.' }),
    );
    this.friends.push(
      { requester: 'u-sam', addressee: 'me', status: 'accepted', createdAt: now - 1e9, acceptedAt: now - 1e9 },
      { requester: 'me', addressee: 'u-maya', status: 'accepted', createdAt: now - 1e9, acceptedAt: now - 1e9 },
      { requester: 'u-jo', addressee: 'me', status: 'accepted', createdAt: now - 1e9, acceptedAt: now - 1e9 },
      { requester: 'u-lee', addressee: 'me', status: 'pending', createdAt: now - 3e6, acceptedAt: null },
    );
    this.likeRows.push({ owner: 'u-sam', critiqueId: 's1', userId: 'u-maya' }, { owner: 'u-jo', critiqueId: 'j1', userId: 'u-sam' });
    this.replyRows.push({ id: 'r1', owner: 'u-sam', critiqueId: 's1', userId: 'u-maya', body: 'The sandworm ride!!', createdAt: now - 3e6 });
    this.sugg.push({ id: 'g1', fromUser: 'u-maya', toUser: 'me', title: 'Arrival', type: 'movie', year: '2016', extKey: null, posterUrl: null, note: 'You will love the ending.', seen: false, createdAt: now - 6e6 });
  }
  private uid() {
    return this.me?.id === 'me' ? 'me' : (this.me?.id ?? '');
  }
  private emit() {
    for (const l of this.listeners) l(this.me);
  }
  private wait() {
    return new Promise((r) => setTimeout(r, 120));
  }
  async session() {
    return this.me;
  }
  onAuth(cb: (s: { id: string; email: string } | null) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  async signUp(email: string) {
    await this.wait();
    this.me = { id: 'me', email };
    this.emit();
    return { needsCode: false };
  }
  async verifySignup() {}
  async signIn(email: string) {
    await this.wait();
    this.me = { id: 'me', email };
    this.emit();
  }
  async sendReset() {}
  async resetWithCode() {}
  async signOut() {
    this.me = null;
    this.emit();
  }
  async deleteAccount() {
    this.profilesById.delete('me');
    this.me = null;
    this.emit();
  }
  /** Same rule as the real server: names and bios only for yourself and friends. */
  private visible(p: Profile): Profile {
    const me = this.uid();
    const friend = this.friends.some((f) => f.status === 'accepted' && ((f.requester === me && f.addressee === p.id) || (f.addressee === me && f.requester === p.id)));
    return p.id === me || friend ? p : { ...p, displayName: '', bio: '' };
  }
  async profiles(ids: string[]) {
    return (ids.map((i) => this.profilesById.get(i)).filter(Boolean) as Profile[]).map((p) => this.visible(p));
  }
  async saveProfile(p: Profile) {
    this.profilesById.set(p.id, p);
  }
  async usernameTaken(name: string, exceptId: string) {
    return [...this.profilesById.values()].some((p) => p.username === name.toLowerCase() && p.id !== exceptId);
  }
  async searchProfiles(q: string, exceptId: string) {
    const n = q.toLowerCase().replace(/^@/, '');
    return [...this.profilesById.values()].filter((p) => p.id !== exceptId && p.username.includes(n)).map((p) => this.visible(p));
  }
  async uploadImage(_b: string, _p: string, blob: Blob) {
    return URL.createObjectURL(blob);
  }
  async friendships() {
    return this.friends.filter((f) => f.requester === this.uid() || f.addressee === this.uid());
  }
  async request(from: string, to: string) {
    this.friends.push({ requester: from, addressee: to, status: 'pending', createdAt: Date.now(), acceptedAt: null });
  }
  async accept(requester: string, addressee: string) {
    const f = this.friends.find((x) => x.requester === requester && x.addressee === addressee);
    if (f) {
      f.status = 'accepted';
      f.acceptedAt = Date.now();
    }
  }
  async removeFriendship(requester: string, addressee: string) {
    this.friends = this.friends.filter((x) => !(x.requester === requester && x.addressee === addressee));
  }
  async myStamps(owner: string) {
    return this.rows.filter((r) => r.owner === owner).map((r) => ({ id: r.id, updatedAt: r.updatedAt }));
  }
  async push(rows: SharedCritique[]) {
    for (const r of rows) {
      this.rows = this.rows.filter((x) => !(x.owner === r.owner && x.id === r.id));
      this.rows.push(r);
    }
  }
  async remove(owner: string, ids: string[]) {
    this.rows = this.rows.filter((x) => !(x.owner === owner && ids.includes(x.id)));
  }
  async critiques(owners: string[], limit: number) {
    return this.rows
      .filter((r) => owners.includes(r.owner) && (r.owner === this.uid() || !r.hidden))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }
  async likes(owners: string[]) {
    return this.likeRows.filter((l) => owners.includes(l.owner));
  }
  async like(owner: string, critiqueId: string, userId: string) {
    if (!this.likeRows.some((l) => l.owner === owner && l.critiqueId === critiqueId && l.userId === userId)) this.likeRows.push({ owner, critiqueId, userId });
  }
  async unlike(owner: string, critiqueId: string, userId: string) {
    this.likeRows = this.likeRows.filter((l) => !(l.owner === owner && l.critiqueId === critiqueId && l.userId === userId));
  }
  async replies(owner: string, critiqueId: string) {
    return this.replyRows.filter((r) => r.owner === owner && r.critiqueId === critiqueId);
  }
  async replyCounts(owners: string[]) {
    const out: Record<string, number> = {};
    for (const r of this.replyRows) if (owners.includes(r.owner)) out[r.owner + '/' + r.critiqueId] = (out[r.owner + '/' + r.critiqueId] ?? 0) + 1;
    return out;
  }
  async reply(owner: string, critiqueId: string, userId: string, body: string) {
    this.replyRows.push({ id: 'r' + Math.random(), owner, critiqueId, userId, body, createdAt: Date.now() });
  }
  async deleteReply(id: string) {
    this.replyRows = this.replyRows.filter((r) => r.id !== id);
  }
  async suggestions() {
    return this.sugg.filter((s) => s.toUser === this.uid() || s.fromUser === this.uid());
  }
  async suggest(s: Omit<Suggestion, 'id' | 'seen' | 'createdAt'>) {
    this.sugg.push({ ...s, id: 'g' + Math.random(), seen: false, createdAt: Date.now() });
  }
  async markSeen(id: string) {
    const s = this.sugg.find((x) => x.id === id);
    if (s) s.seen = true;
  }
  async removeSuggestion(id: string) {
    this.sugg = this.sugg.filter((x) => x.id !== id);
  }
  async watchItems(owner: string) {
    return this.watch.filter((w) => w.owner === owner);
  }
  async pushWatch(rows: SyncedWatch[]) {
    for (const r of rows) {
      this.watch = this.watch.filter((x) => !(x.owner === r.owner && x.id === r.id));
      this.watch.push(r);
    }
  }
  async removeWatch(owner: string, ids: string[]) {
    this.watch = this.watch.filter((x) => !(x.owner === owner && ids.includes(x.id)));
  }
  async swipes(owner: string) {
    return this.swipeRows.filter((w) => w.owner === owner);
  }
  async pushSwipes(owner: string, rows: SyncedSwipe[]) {
    for (const r of rows) {
      this.swipeRows = this.swipeRows.filter((x) => !(x.owner === owner && x.key === r.key));
      this.swipeRows.push({ ...r, owner });
    }
  }
  async removeSwipes(owner: string, keys: string[]) {
    this.swipeRows = this.swipeRows.filter((x) => !(x.owner === owner && keys.includes(x.key)));
  }
}

class OfflineApi implements OnlineApi {
  readonly configured = false;
  private no = async (): Promise<never> => {
    throw new Error('Online features aren’t set up in this copy of Iris.');
  };
  session = async () => null;
  onAuth = () => () => {};
  signUp = this.no;
  verifySignup = this.no;
  signIn = this.no;
  sendReset = this.no;
  resetWithCode = this.no;
  signOut = async () => {};
  deleteAccount = this.no;
  profiles = this.no;
  saveProfile = this.no;
  usernameTaken = this.no;
  searchProfiles = this.no;
  uploadImage = this.no;
  friendships = this.no;
  request = this.no;
  accept = this.no;
  removeFriendship = this.no;
  myStamps = this.no;
  push = this.no;
  remove = this.no;
  critiques = this.no;
  likes = this.no;
  like = this.no;
  unlike = this.no;
  replies = this.no;
  replyCounts = this.no;
  reply = this.no;
  deleteReply = this.no;
  suggestions = this.no;
  suggest = this.no;
  markSeen = this.no;
  removeSuggestion = this.no;
  watchItems = this.no;
  pushWatch = this.no;
  removeWatch = this.no;
  swipes = this.no;
  pushSwipes = this.no;
  removeSwipes = this.no;
}

let api: OnlineApi | null = null;
export function online(): OnlineApi {
  if (api) return api;
  const cfg = typeof __SUPABASE__ !== 'undefined' ? __SUPABASE__ : { url: '', key: '' };
  if (appInfo.fakeOnline) api = new FakeApi();
  else if (cfg.url && cfg.key) api = new SupabaseApi(cfg.url, cfg.key);
  else api = new OfflineApi();
  return api;
}
