/* Everything Iris says to the online service. One real implementation (Supabase) and one pretend
   server used by the automated tests, both behind the same small interface. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ClassKey, MediaType, ScoreKey } from '../shared/model';
import { appInfo } from '../lib/appInfo';

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  avatar: string; // 'preset:N' or an https address
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
  total: number;
  cls: ClassKey;
  recommend: 'yes' | 'no' | null;
  favourite: boolean;
  hidden: boolean;
  genres: string[];
  createdAt: number;
  updatedAt: number;
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
}

/** Turns service errors into a sentence a person can act on. */
export function explain(e: any): string {
  const m = String(e?.message || e || '');
  if (/invalid login credentials/i.test(m)) return 'That email and password don’t match an account.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first. Enter the code from the email Iris sent you.';
  if (/user already registered/i.test(m)) return 'There’s already an account with that email. Sign in instead.';
  if (/password should be at least/i.test(m)) return 'Use a password with at least 6 characters.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries in a row. Wait a minute and try again.';
  if (/token has expired|invalid.*otp|otp.*invalid/i.test(m)) return 'That code didn’t work. Check it, or ask for a new one.';
  if (/failed to fetch|network|fetch failed/i.test(m)) return 'Iris can’t reach the internet right now.';
  if (/duplicate key.*username|profiles_username_key/i.test(m)) return 'That username is taken. Try another.';
  if (/check constraint.*username/i.test(m)) return 'Usernames use 3 to 20 lowercase letters, numbers, dots or underscores.';
  return m || 'Something went wrong. Try again.';
}

/* --------------------------------------------------------------- Supabase */

const t = (v: any) => (v ? Date.parse(v) : 0);
const fromProfile = (r: any): Profile => ({
  id: r.id,
  username: String(r.username),
  displayName: r.display_name ?? '',
  avatar: r.avatar ?? 'preset:1',
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
  total: r.total ?? 0,
  cls: r.class,
  recommend: r.recommend ?? null,
  favourite: !!r.favourite,
  hidden: !!r.hidden,
  genres: r.genres ?? [],
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
  total: c.total,
  class: c.cls,
  recommend: c.recommend,
  favourite: c.favourite,
  hidden: c.hidden,
  genres: c.genres,
  created_at: new Date(c.createdAt).toISOString(),
  updated_at: new Date(c.updatedAt).toISOString(),
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

class SupabaseApi implements OnlineApi {
  readonly configured = true;
  private sb: SupabaseClient;
  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'iris-online' } });
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
    check(await this.sb.rpc('delete_my_account'));
    await this.sb.auth.signOut();
  }
  async profiles(ids: string[]) {
    if (!ids.length) return [];
    return (check(await this.sb.from('profiles').select('*').in('id', ids)) as any[]).map(fromProfile);
  }
  async saveProfile(p: Profile, isNew: boolean) {
    const row = { id: p.id, username: p.username.toLowerCase(), display_name: p.displayName, avatar: p.avatar, bio: p.bio, updated_at: new Date().toISOString() };
    if (isNew) check(await this.sb.from('profiles').insert(row));
    else check(await this.sb.from('profiles').update(row).eq('id', p.id));
  }
  async usernameTaken(name: string, exceptId: string) {
    const rows = check(await this.sb.from('profiles').select('id').eq('username', name.toLowerCase()).neq('id', exceptId).limit(1)) as any[];
    return rows.length > 0;
  }
  async searchProfiles(q: string, exceptId: string) {
    const clean = q.replace(/[^a-zA-Z0-9_. ]/g, '').trim();
    if (clean.length < 2) return [];
    const rows = check(
      await this.sb.from('profiles').select('*').or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`).neq('id', exceptId).limit(12),
    ) as any[];
    return rows.map(fromProfile);
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
  constructor() {
    const now = Date.now();
    const people: Profile[] = [
      { id: 'u-sam', username: 'sam.k', displayName: 'Sam', avatar: 'preset:4', bio: 'Will watch anything with a heist in it.', createdAt: now - 9e9 },
      { id: 'u-maya', username: 'maya_reels', displayName: 'Maya', avatar: 'preset:9', bio: 'Slow cinema, loud soundtracks.', createdAt: now - 8e9 },
      { id: 'u-jo', username: 'jo.plays', displayName: 'Jo', avatar: 'preset:14', bio: 'Mostly games. Some anime.', createdAt: now - 7e9 },
      { id: 'u-lee', username: 'leewatches', displayName: 'Lee', avatar: 'preset:2', bio: '', createdAt: now - 6e9 },
    ];
    for (const p of people) this.profilesById.set(p.id, p);
    const mk = (owner: string, id: string, title: string, type: MediaType, base: number, ago: number, extra: Partial<SharedCritique> = {}): SharedCritique => {
      const keys: ScoreKey[] = ['story', 'screenplay', 'characters', 'acting', 'visuals', 'soundtrack', 'production', 'vision', 'pacing', 'enjoyment'];
      const scores = Object.fromEntries(keys.map((k, i) => [k, Math.max(0, Math.min(100, Math.round(base + Math.sin(i * 1.7 + title.length) * 6)))])) as Record<ScoreKey, number>;
      const total = Object.values(scores).reduce((a, b) => a + b, 0);
      const cls: ClassKey = total >= 960 ? 'masterpiece' : total >= 900 ? 'perfect' : total >= 800 ? 'great' : total >= 650 ? 'good' : total >= 500 ? 'average' : total >= 300 ? 'below' : 'terrible';
      return { owner, id, title, type, year: '', extKey: null, posterUrl: null, director: '', studio: '', cast: '', description: '', comments: '', finalRemarks: '', scores, total, cls, recommend: total > 700 ? 'yes' : 'no', favourite: false, hidden: false, genres: [], createdAt: now - ago, updatedAt: now - ago, ...extra };
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
  async profiles(ids: string[]) {
    return ids.map((i) => this.profilesById.get(i)).filter(Boolean) as Profile[];
  }
  async saveProfile(p: Profile) {
    this.profilesById.set(p.id, p);
  }
  async usernameTaken(name: string, exceptId: string) {
    return [...this.profilesById.values()].some((p) => p.username === name.toLowerCase() && p.id !== exceptId);
  }
  async searchProfiles(q: string, exceptId: string) {
    const n = q.toLowerCase();
    return [...this.profilesById.values()].filter((p) => p.id !== exceptId && (p.username.includes(n) || p.displayName.toLowerCase().includes(n)));
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
