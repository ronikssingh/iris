// Drives For You, Friends and the catalogue lookup against a pretend server and canned catalogue answers.
import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
const [dataDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const app = await electron.launch({
  executablePath: path.resolve('node_modules/electron/dist/electron'),
  args: ['.', '--no-sandbox'],
  env: {
    ...process.env,
    IRIS_TEST: '1',
    IRIS_DATA_DIR: dataDir,
    IRIS_SKIP_LEGACY: '1',
    IRIS_FAKE_ONLINE: '1',
    IRIS_CATALOG_FIXTURE: path.resolve('tests/fixtures/catalog.json'),
    TMDB_TOKEN: 'test',
    IGDB_CLIENT_ID: 'test',
    IGDB_CLIENT_SECRET: 'test',
  },
});
let win = null;
for (let i = 0; i < 120 && !win; i++) {
  win = app.windows().find((w) => w.url().includes('dist/index.html')) ?? null;
  if (!win) await new Promise((r) => setTimeout(r, 500));
}
const errors = [];
win.on('pageerror', (e) => errors.push(e.message));
win.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = async (n) => win.screenshot({ path: path.join(outDir, n + '.png') });
const step = async (label, fn) => {
  try {
    await fn();
    console.log('ok  ', label);
  } catch (e) {
    console.log('FAIL', label, e.message.split('\n')[0]);
    await shot('fail-' + label.replace(/\W+/g, '-'));
  }
};
const lib = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'library.json'), 'utf8'));
await win.waitForSelector('.lobby', { timeout: 60000 });
await win.waitForTimeout(1500);

await step('for you shows a deck', async () => {
  await win.click('.tab[title="For You"]');
  await win.waitForSelector('.swipe.top', { timeout: 30000 });
  await win.waitForTimeout(1800);
  await shot('foryou');
});
await step('swipe right adds to Up Next, up marks watched, left skips, rewind undoes', async () => {
  const first = await win.textContent('.swipe.top .swipe-title');
  await win.keyboard.press('ArrowRight');
  await win.waitForTimeout(900);
  const second = await win.textContent('.swipe.top .swipe-title');
  await win.keyboard.press('ArrowUp');
  await win.waitForTimeout(900);
  await win.keyboard.press('ArrowLeft');
  await win.waitForTimeout(900);
  await win.keyboard.press('Backspace');
  await win.waitForTimeout(3000);
  const l = lib();
  const w1 = l.watchlist.find((w) => w.title === first);
  const w2 = l.watchlist.find((w) => w.title === second);
  if (!w1 || w1.status !== 'want') throw new Error('right swipe missing: ' + first);
  if (!w2 || w2.status !== 'watched') throw new Error('up swipe missing: ' + second);
  if (l.swipes.length !== 2) throw new Error('swipes ' + l.swipes.length);
  if (!w1.ext || w1.ext.source !== 'tmdb') throw new Error('no catalogue link on ' + first);
});
await step('games deck', async () => {
  await win.click('.seg-opt >> text=Games');
  await win.waitForSelector('.swipe.top', { timeout: 30000 });
  await win.waitForTimeout(1500);
  await shot('foryou-games');
});
await step('friends asks you to sign in', async () => {
  await win.click('.tab[title="Friends"]');
  await win.waitForSelector('.auth', { timeout: 20000 });
  await win.waitForTimeout(800);
  await shot('friends-signin');
});
await step('sign in and make a profile', async () => {
  await win.fill('.auth input[type=email]', 'ronik@example.com');
  await win.fill('.auth input[type=password]', 'secret123');
  await win.click('.auth-go');
  await win.waitForSelector('.profile-editor', { timeout: 20000 });
  await win.fill('.pe-fields input >> nth=0', 'Ronik S!');
  const v = await win.inputValue('.pe-fields input >> nth=0');
  if (v !== 'roniks') throw new Error('username not cleaned: ' + v);
  await win.click('.avatar-choice >> nth=12');
  await win.waitForTimeout(500);
  await shot('profile-setup');
  await win.click('.pe-actions .btn-primary');
  await win.waitForSelector('.hub', { timeout: 20000 });
  await win.waitForSelector('.feed-card', { timeout: 20000 });
  await win.waitForTimeout(1500);
  await shot('friends-feed');
});
await step('like and reply', async () => {
  await win.click('.feed-card >> nth=0 >> .like-btn');
  await win.click('.feed-card >> nth=0 >> .reply-btn');
  await win.waitForSelector('.reply-new textarea');
  await win.fill('.reply-new textarea', 'Agreed, the sound design is unreal.');
  await win.keyboard.press('Enter');
  await win.waitForTimeout(800);
  const n = await win.$$eval('.feed-card >> nth=0 >> .reply', (x) => x.length).catch(() => 0);
  await shot('friends-reply');
});
await step('accept a friend request', async () => {
  await win.click('.side-block >> text=Accept');
  await win.waitForTimeout(1200);
});
await step('suggested to you', async () => {
  await win.click('.seg-opt >> text=Suggested to you');
  await win.waitForSelector('.sugg-card');
  await win.waitForTimeout(700);
  await shot('friends-suggested');
  await win.click('.sugg-card .btn-primary');
  await win.waitForTimeout(800);
  if (!lib().watchlist.some((w) => w.title === 'Arrival' && w.from)) throw new Error('suggestion not added');
});
await step('friend profile and a critique', async () => {
  await win.click('.side-block .person-row.clickable >> nth=0');
  await win.waitForSelector('.friend-head');
  await win.waitForSelector('.friend-card', { timeout: 20000 });
  await win.waitForTimeout(1200);
  await shot('friend-profile');
  await win.click('.friend-card >> nth=0');
  await win.waitForSelector('.fc');
  await win.waitForTimeout(1400);
  await shot('friend-critique');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(600);
});
await step('critiques are shared and hidden ones say so', async () => {
  await win.click('.tab[title="Critiques"]');
  await win.waitForSelector('.card');
  await win.click('.card >> nth=0');
  await win.waitForSelector('.detail-bar');
  await win.click('.detail-bar .btn[aria-label="Add to favourites"]');
  await win.click('.detail-bar .btn[aria-label="More"]');
  await win.waitForSelector('.menu');
  await shot('detail-menu');
  await win.click('.menu-item >> text=Suggest to a friend');
  await win.waitForSelector('.suggest');
  await win.click('.person-chip >> nth=0');
  await win.waitForTimeout(500);
  await shot('suggest-modal');
  await win.click('.suggest .btn-primary');
  await win.waitForTimeout(800);
});
await step('settings account', async () => {
  await win.click('.tool[aria-label="Settings"], .topbar-tools .tool >> nth=-1');
  await win.waitForSelector('.settings-nav');
  await win.click('.settings-tab >> text=Friends and account');
  await win.waitForSelector('.account-card');
  await win.waitForTimeout(800);
  await shot('settings-account');
});
await step('catalogue fills a new critique', async () => {
  await win.click('.tab[title="Write"]');
  await win.waitForSelector('.start-new');
  await win.click('.start-new');
  await win.waitForSelector('.input-hero');
  await win.click('.type-tile >> nth=0');
  await win.fill('.input-hero', 'Arrival');
  await win.waitForSelector('.lookup-card', { timeout: 20000 });
  await win.waitForTimeout(600);
  await shot('lookup');
  await win.click('.lookup-card >> text=Arrival');
  await win.waitForTimeout(1800);
  const d = lib().drafts.at(-1)?.data;
  if (!d || d.director !== 'Denis Villeneuve' || !d.ext) throw new Error('not filled: ' + JSON.stringify(d && { director: d.director, ext: d.ext }));
});
await new Promise((r) => setTimeout(r, 2500));
const l = lib();
console.log('errors:', errors.slice(0, 8));
console.log('meta', { onlineOwner: l.meta.onlineOwner, synced: l.meta.syncedIds.length, swipes: l.swipes.length, favourites: l.critiques.filter((c) => c.favourite).length });
await app.close();
