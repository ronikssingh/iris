// Runs on GitHub's build machines against a local copy of Supabase (started with the Supabase CLI and
// set up with supabase/setup.sql). It drives the app's own online code through everything friends do:
// signing up with an email code, profiles and pictures, requests, sharing, likes, replies, suggestions,
// privacy, password resets and deleting an account. Results are written as annotations.
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const env = process.env;
const URL_ = env.API_URL;
const KEY = env.PUBLISHABLE_KEY || env.ANON_KEY;
const MAIL = env.MAILPIT_URL || env.INBUCKET_URL;
if (!URL_ || !KEY || !MAIL) {
  console.log('Missing API_URL, key or mail server', { URL_: !!URL_, KEY: !!KEY, MAIL: !!MAIL });
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-sb-'));
const out = path.join(tmp, 'api.mjs');
await build({
  entryPoints: ['src/online/api.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'warning',
  define: { __SUPABASE__: JSON.stringify({ url: '', key: '' }) },
});
const { SupabaseApi, explain } = await import(out);

const results = [];
let failed = 0;
async function step(label, fn) {
  try {
    const note = await fn();
    results.push(`ok   ${label}${note ? ' (' + note + ')' : ''}`);
  } catch (e) {
    failed++;
    results.push(`FAIL ${label}: ${e?.message || e}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------ mail */
async function latestMail(to, after) {
  for (let i = 0; i < 40; i++) {
    try {
      if (env.MAILPIT_URL) {
        const r = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent('to:' + to)}`)).json();
        const msgs = (r.messages ?? []).filter((m) => Date.parse(m.Created) >= after - 2000);
        if (msgs.length) {
          const m = await (await fetch(`${MAIL}/api/v1/message/${msgs[0].ID}`)).json();
          return { subject: m.Subject, text: (m.Text || '') + '\n' + (m.HTML || '') };
        }
      } else {
        const box = to.split('@')[0];
        const list = await (await fetch(`${MAIL}/api/v1/mailbox/${box}`)).json();
        const msgs = (list ?? []).filter((m) => Date.parse(m.date) >= after - 2000);
        if (msgs.length) {
          const m = await (await fetch(`${MAIL}/api/v1/mailbox/${box}/${msgs[msgs.length - 1].id}`)).json();
          return { subject: m.subject, text: (m.body?.text || '') + '\n' + (m.body?.html || '') };
        }
      }
    } catch {
      /* not there yet */
    }
    await sleep(500);
  }
  throw new Error('no email arrived for ' + to);
}
const codeIn = (mail) => {
  const m = /code is\s*(\d{6,10})/i.exec(mail.text) || /\b(\d{6})\b/.exec(mail.text);
  if (!m) throw new Error('no code in the email: ' + mail.text.slice(0, 200));
  return m[1];
};

/* ------------------------------------------------------------ people */
const pw = 'correct-horse-42';
const stamp = Date.now().toString(36);
const people = {};
async function join(tag, username, displayName) {
  const api = new SupabaseApi(URL_, KEY, memory());
  const email = `${tag}-${stamp}@example.com`;
  const t0 = Date.now();
  const r = await api.signUp(email, pw);
  expect(r.needsCode === true, 'sign-up should wait for the email code');
  let early = '';
  try {
    await api.signIn(email, pw);
  } catch (e) {
    early = explain(e);
  }
  expect(/confirm your email/i.test(early), 'signing in before confirming should explain itself, got: ' + early);
  const mail = await latestMail(email, t0);
  await api.verifySignup(email, codeIn(mail));
  const s = await api.session();
  expect(s?.email === email, 'confirmed and signed in');
  expect((await api.profiles([s.id])).length === 0, 'no profile yet');
  await api.saveProfile({ id: s.id, username, displayName, avatar: 'world:fold', bio: `${displayName} likes big films`, createdAt: Date.now() }, true);
  people[tag] = { api, id: s.id, email, username };
  return `${username} created`;
}

const critique = (owner, id, title, hidden, posterUrl = null) => ({
  owner,
  id,
  title,
  type: 'movie',
  year: '2024',
  extKey: 'tmdb:movie:693134',
  posterUrl,
  director: 'Denis Villeneuve',
  studio: 'Legendary Pictures',
  cast: 'Timothée Chalamet, Zendaya',
  description: 'Paul joins the Fremen.',
  comments: 'The sound!',
  finalRemarks: 'Huge.',
  scores: { story: 95, screenplay: 90, characters: 92, acting: 94, visuals: 99, soundtrack: 100, production: 97, vision: 98, pacing: 88, enjoyment: 100 },
  scoreNotes: { soundtrack: 'Zimmer at full volume' },
  total: 953,
  cls: 'perfect',
  classOverride: null,
  recommend: 'yes',
  favourite: !hidden,
  hidden,
  genres: ['Science Fiction', 'Adventure'],
  posterColor: '#3a2a12',
  createdAt: Date.now() - 60000,
  updatedAt: Date.now(),
});

await step('Ronik signs up with the code from his email and makes a profile', () => join('a', `ronik_${stamp}`.slice(0, 20), 'Ronik'));
await step('Sam signs up', () => join('b', `sam_${stamp}`.slice(0, 20), 'Sam'));
await step('Cleo signs up (a stranger to both)', () => join('c', `cleo_${stamp}`.slice(0, 20), 'Cleo'));
const { a, b, c } = people;

await step('usernames are unique, ignoring case', async () => {
  expect(await b.api.usernameTaken(a.username.toUpperCase(), b.id), 'taken check');
  let err = '';
  try {
    await b.api.saveProfile({ id: b.id, username: a.username, displayName: 'Sam', avatar: 'preset:1', bio: '', createdAt: 0 }, false);
  } catch (e) {
    err = explain(e);
  }
  expect(/taken/i.test(err), 'duplicate username should be explained, got: ' + err);
});

let avatarUrl = '';
await step('profile picture uploads and can be seen', async () => {
  const jpeg = fs.readFileSync('build/icon.png');
  avatarUrl = await a.api.uploadImage('avatars', `${a.id}/avatar-1.png`, new Blob([jpeg], { type: 'image/png' }));
  const r = await fetch(avatarUrl);
  expect(r.ok, 'avatar address answered ' + r.status);
  await a.api.saveProfile({ id: a.id, username: a.username, displayName: 'Ronik', avatar: avatarUrl, bio: 'Sci-fi first', createdAt: 0 }, false);
  let blocked = false;
  try {
    await c.api.uploadImage('avatars', `${a.id}/sneaky.png`, new Blob([jpeg], { type: 'image/png' }));
  } catch {
    blocked = true;
  }
  expect(blocked, 'someone else must not write into Ronik’s folder');
});

let posterUrl = '';
await step('critiques are shared, one hidden', async () => {
  posterUrl = await a.api.uploadImage('posters', `${a.id}/poster-dune.png`, new Blob([fs.readFileSync('build/icon.png')], { type: 'image/png' }));
  await a.api.push([critique(a.id, 'c1', 'Dune: Part Two', false, posterUrl), critique(a.id, 'c2', 'A private one', true)]);
  const stamps = await a.api.myStamps(a.id);
  expect(stamps.length === 2, 'two critiques online, got ' + stamps.length);
  await a.api.push([{ ...critique(a.id, 'c1', 'Dune: Part Two', false, posterUrl), finalRemarks: 'Even better the second time.', updatedAt: Date.now() + 5 }]);
  const mine = await a.api.critiques([a.id], 10);
  expect(mine.find((x) => x.id === 'c1')?.finalRemarks === 'Even better the second time.', 'update in place');
  return `${mine.length} online`;
});

await step('strangers see a username and picture only', async () => {
  const found = await c.api.searchProfiles(a.username.slice(0, 6), c.id);
  const hit = found.find((p) => p.id === a.id);
  expect(hit, 'search by username finds Ronik');
  expect(hit.displayName === '' && hit.bio === '', 'name and bio stay private: ' + JSON.stringify(hit));
  expect(hit.avatar === avatarUrl, 'picture is visible');
  expect((await c.api.critiques([a.id], 10)).length === 0, 'no critiques for strangers');
});

await step('friend request, accept', async () => {
  await b.api.request(b.id, a.id);
  const inc = (await a.api.friendships()).filter((f) => f.addressee === a.id && f.status === 'pending');
  expect(inc.length === 1, 'Ronik sees the request');
  let dup = false;
  try {
    await a.api.request(a.id, b.id);
  } catch {
    dup = true;
  }
  expect(dup, 'a second request the other way is refused');
  await a.api.accept(b.id, a.id);
  const f = (await b.api.friendships()).find((x) => x.requester === b.id);
  expect(f?.status === 'accepted' && f.acceptedAt, 'accepted with a time');
});

await step('friends see names, bios and shared critiques, never hidden ones', async () => {
  const [p] = await b.api.profiles([a.id]);
  expect(p.displayName === 'Ronik' && p.bio === 'Sci-fi first', 'friend details: ' + JSON.stringify(p));
  const seen = await b.api.critiques([a.id], 10);
  expect(seen.length === 1 && seen[0].id === 'c1', 'only the shared critique: ' + seen.map((x) => x.id));
  expect(seen[0].posterUrl === posterUrl && seen[0].scores.visuals === 99 && seen[0].cls === 'perfect', 'fields come through');
  expect(seen[0].scoreNotes.soundtrack === 'Zimmer at full volume' && seen[0].posterColor === '#3a2a12', 'score notes and colour come through');
  const r = await fetch(posterUrl);
  expect(r.ok, 'poster address answered ' + r.status);
});

await step('likes and replies', async () => {
  await b.api.like(a.id, 'c1', b.id);
  await b.api.like(a.id, 'c1', b.id); // twice is fine
  await b.api.reply(a.id, 'c1', b.id, 'The sandworm ride!');
  const likes = await a.api.likes([a.id]);
  expect(likes.length === 1 && likes[0].userId === b.id, 'one like from Sam');
  const counts = await a.api.replyCounts([a.id]);
  expect(counts[`${a.id}/c1`] === 1, 'one reply counted');
  const rs = await a.api.replies(a.id, 'c1');
  expect(rs[0]?.body === 'The sandworm ride!', 'reply text');
  let blocked = false;
  try {
    await c.api.like(a.id, 'c1', c.id);
  } catch {
    blocked = true;
  }
  expect(blocked, 'strangers can’t like');
  await b.api.unlike(a.id, 'c1', b.id);
  expect((await a.api.likes([a.id])).length === 0, 'like taken back');
  await a.api.deleteReply(rs[0].id); // the critique's owner can remove replies on it
  expect((await a.api.replies(a.id, 'c1')).length === 0, 'reply removed');
});

await step('suggesting a title to a friend', async () => {
  await b.api.suggest({ fromUser: b.id, toUser: a.id, title: 'Arrival', type: 'movie', year: '2016', extKey: 'tmdb:movie:329865', posterUrl: null, note: 'You will love the ending' });
  const got = await a.api.suggestions();
  expect(got.length === 1 && !got[0].seen && got[0].note === 'You will love the ending', 'Ronik gets it');
  await a.api.markSeen(got[0].id);
  expect((await a.api.suggestions())[0].seen, 'marked seen');
  let blocked = false;
  try {
    await c.api.suggest({ fromUser: c.id, toUser: a.id, title: 'Spam', type: 'movie', year: '', extKey: null, posterUrl: null, note: '' });
  } catch {
    blocked = true;
  }
  expect(blocked, 'only friends can suggest');
  await a.api.removeSuggestion(got[0].id);
  expect((await b.api.suggestions()).length === 0, 'removed for both');
});

await step('Up Next and Discover swipes follow you, and nobody else sees them', async () => {
  const item = (id, title, order) => ({ owner: a.id, id, title, type: 'movie', status: 'want', note: '', year: '2016', extKey: 'tmdb:movie:329865', posterUrl: null, director: '', studio: '', cast: '', description: '', genres: [], from: 'Sam', order, addedAt: Date.now(), updatedAt: Date.now() });
  await a.api.pushWatch([item('w1', 'Arrival', 0), item('w2', 'Heat', 1)]);
  await a.api.pushSwipes(a.id, [{ key: 'tmdb:movie:949', title: 'Heat', type: 'movie', verdict: 'like', at: Date.now() }, { key: 'tmdb:movie:11', title: 'Star Wars', type: 'movie', verdict: 'seen', at: Date.now() }]);
  await a.api.pushSwipes(a.id, [{ key: 'tmdb:movie:949', title: 'Heat', type: 'movie', verdict: 'seen', at: Date.now() }]); // a change of mind replaces the old one
  const list = await a.api.watchItems(a.id);
  expect(list.length === 2 && list.find((w) => w.id === 'w1')?.from === 'Sam', 'two items with who sent them');
  const sw = await a.api.swipes(a.id);
  expect(sw.length === 2 && sw.find((w) => w.key === 'tmdb:movie:949')?.verdict === 'seen', 'swipes: ' + JSON.stringify(sw));
  expect((await b.api.watchItems(a.id)).length === 0 && (await b.api.swipes(a.id)).length === 0, 'even a friend sees none of it');
  await a.api.removeWatch(a.id, ['w2']);
  expect((await a.api.watchItems(a.id)).length === 1, 'removed');
});

await step('removing a critique online', async () => {
  await a.api.remove(a.id, ['c2']);
  expect((await a.api.myStamps(a.id)).length === 1, 'one left');
});

await step('password reset with the emailed code', async () => {
  const t0 = Date.now();
  await a.api.sendReset(a.email);
  const mail = await latestMail(a.email, t0);
  await a.api.resetWithCode(a.email, codeIn(mail), pw + '-new');
  await a.api.signOut();
  expect(!(await a.api.session()), 'signed out');
  await a.api.signIn(a.email, pw + '-new');
  expect((await a.api.session())?.id === a.id, 'signed back in with the new password');
});

await step('unfriending hides critiques again', async () => {
  await b.api.removeFriendship(b.id, a.id);
  expect((await b.api.critiques([a.id], 10)).length === 0, 'gone');
  const [p] = await b.api.profiles([a.id]);
  expect(p.displayName === '', 'name private again');
});

await step('deleting an account removes it everywhere', async () => {
  await a.api.deleteAccount();
  expect(!(await a.api.session()), 'signed out');
  expect((await c.api.profiles([a.id])).length === 0, 'profile gone');
  const r = await fetch(avatarUrl);
  expect(r.status >= 400, 'picture removed, answered ' + r.status);
});

const report = results.join('\n');
console.log(report);
fs.writeFileSync('supabase-integration.txt', report);
if (env.GITHUB_ACTIONS) {
  const msg = report.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::notice title=Online features ${failed ? 'FAILED ' + failed : 'all passed'}::${msg}`);
}
process.exit(failed ? 1 : 0);
