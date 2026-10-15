// Writes a complete critique through the interface, the way a person would, then checks what was saved.
import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
const [dataDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const app = await electron.launch({ executablePath: path.resolve('node_modules/electron/dist/electron'), args: ['.', '--no-sandbox'], env: { ...process.env, IRIS_TEST: '1', IRIS_DATA_DIR: dataDir, IRIS_SKIP_LEGACY: '1' } });
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
await win.waitForSelector('.lobby', { timeout: 60000 });
await step('open write tab', async () => { await win.click('.tab:nth-child(3)'); await win.waitForSelector('.start-new'); });
await step('start a new critique', async () => { await win.click('.start-new'); await win.waitForSelector('.input-hero'); });
await step('title and type', async () => {
  await win.fill('.input-hero', 'Interstellar');
  await win.click('.type-tile >> nth=0');
});
await step('save blocked while incomplete', async () => {
  await win.click('.editor-head .btn-primary');
  await win.waitForSelector('.toast-bad', { timeout: 5000 });
});
await step('credits', async () => {
  await win.click('.rail-step >> nth=1');
  await win.waitForSelector('.sec-credits');
  const inputs = await win.$$('.sec-credits input');
  await inputs[0].fill('Christopher Nolan');
  await inputs[1].fill('Paramount Pictures');
  await win.fill('.sec-credits textarea', 'Matthew McConaughey, Anne Hathaway, Jessica Chastain');
});
const LIVE = '.step:not([data-motion-pop-id])';
const onlyStep = (text) => win.waitForFunction((t) => { const s = [...document.querySelectorAll('.step')]; return s.length === 1 && s[0].textContent.includes(t); }, text, { timeout: 30000 });
await step('description', async () => {
  await win.keyboard.press('Alt+ArrowRight');
  await onlyStep('A short synopsis');
  await win.fill(LIVE + ' .sec-text textarea', 'A crew travels through a wormhole to find humanity a new home.');
});
await step('personal comments', async () => {
  await win.keyboard.press('Alt+ArrowRight');
  await onlyStep('Press ⌘J on any score');
  await win.fill(LIVE + ' .sec-text textarea', 'The docking scene is unreal.');
});
const scores = [95, 90, 92, 94, 99, 100, 97, 98, 88, 100];
const names = ['Story', 'Screenplay and Dialogue', 'Characters', 'Acting', 'Cinematography and Visuals', 'Score and Soundtrack', 'Production Quality', 'Director Vision', 'Rhythm and Pacing', 'Personal Enjoyment'];
for (let i = 0; i < 10; i++) {
  await step('score ' + (i + 1), async () => {
    await win.keyboard.press('Alt+ArrowRight');
    try {
      await win.waitForFunction((n) => { const s = [...document.querySelectorAll('.step')]; return s.length === 1 && s[0].querySelector('.score-name')?.textContent?.startsWith(n); }, names[i], { timeout: 30000 });
    } catch (e) {
      console.log('steps on screen:', JSON.stringify(await win.evaluate(() => [...document.querySelectorAll('.step')].map((s) => ({ style: s.getAttribute('style'), pop: s.getAttribute('data-motion-pop-id'), text: s.textContent.slice(0, 60) })))));
      throw e;
    }
    await win.waitForTimeout(200);
    for (const ch of String(scores[i])) await win.keyboard.press(ch);
    await win.waitForTimeout(150);
    const v = await win.evaluate(() => document.activeElement?.querySelector?.('.dial-value')?.textContent ?? document.activeElement?.className);
    if (v.trim() !== String(scores[i])) throw new Error(`dial shows ${v} not ${scores[i]}`);
  });
  if (i === 4) {
    await step('jump to comments mid-scoring and come back', async () => {
      await win.click('.rail-step >> text=Personal comments');
      await win.waitForSelector('.return-pill');
      await win.click('.return-pill');
      await win.waitForSelector('.dial');
      const name = await win.textContent('.score-name');
      if (!/Cinematography/.test(name)) throw new Error('came back to ' + name);
    });
    await step('comments drawer keeps the score step', async () => {
      await win.keyboard.press('Control+j');
      await win.waitForSelector('.drawer textarea');
      await win.fill('.drawer textarea', 'The docking scene is unreal. Hans Zimmer organ!');
      await win.keyboard.press('Control+j');
      await win.waitForTimeout(400);
      if (!(await win.$('.dial'))) throw new Error('dial gone');
    });
  }
}
await step('verdict', async () => {
  await win.keyboard.press('Alt+ArrowRight');
  await win.waitForSelector('.sec-verdict');
  await win.waitForTimeout(1800);
  await shot('verdict');
  await win.click('.rec-btn.rec-yes');
});
await step('final remarks', async () => {
  await win.keyboard.press('Alt+ArrowRight');
  await onlyStep('Final remarks');
  await win.fill(LIVE + ' .sec-text textarea', 'Space, time and love, on a giant screen.');
});
await step('review and save', async () => {
  await win.keyboard.press('Alt+ArrowRight');
  await win.waitForSelector('.sec-review');
  await win.waitForSelector('.review-ready');
  await shot('review');
  await win.evaluate(() => { window.__irisHoldCelebration = true; });
  await win.click('.editor-foot .btn-primary');
  await win.waitForSelector('.celebrate', { timeout: 30000 });
  await win.waitForTimeout(2600);
  await shot('celebrate');
  await win.evaluate(() => { window.__irisHoldCelebration = false; });
  await win.click('.celebrate');
  await win.waitForSelector('.celebrate', { state: 'detached', timeout: 30000 });
  await win.waitForSelector('.detail', { timeout: 40000 });
  await win.waitForTimeout(1500);
  await shot('detail');
});
await step('edit as one page and change the class', async () => {
  await win.click('.detail-bar .btn >> text=Edit');
  await win.waitForSelector('.onepage', { timeout: 30000 });
  await win.waitForTimeout(800);
  await win.click('.class-opt >> text=Masterpiece');
  await win.click('.editor-head .btn-primary');
  await win.waitForSelector('.detail', { timeout: 40000 });
  await win.waitForTimeout(1500);
  const badge = await win.textContent('.verdict .cls-label');
  if (badge !== 'Masterpiece') throw new Error('class shows ' + badge);
});
await step('add to Up Next and write from it', async () => {
  await win.click('.tab:nth-child(5)');
  await win.waitForSelector('.addbar-input');
  await win.fill('.addbar-input', 'Arrival');
  await win.keyboard.press('Enter');
  await win.waitForSelector('.watch-title:text("Arrival")');
  await win.click('.watch >> text=Watched it');
  await win.waitForTimeout(600);
  await shot('upnext');
  await win.click('.watch .btn-primary');
  await win.waitForSelector('.editor-name');
  const t = await win.textContent('.editor-name');
  if (t !== 'Arrival') throw new Error('prefilled ' + t);
  await win.waitForSelector('.sec-credits'); // title and type are known, so it starts at the credits
  await shot('write-from-upnext');
});
await step('discard that draft from the start screen', async () => {
  await win.click('.editor-head .btn-quiet');
  await win.click('.tab:nth-child(3)');
  await win.waitForSelector('.start-item');
  await shot('write-start');
});
await step('archive search, filters and list view', async () => {
  await win.click('.tab:nth-child(2)');
  await win.waitForSelector('.card');
  await win.fill('.search input', 'zimmer');
  await win.waitForTimeout(2500);
  const titles = await win.$$eval('.card-title', (c) => c.map((x) => x.textContent));
  if (!titles.includes('Interstellar')) throw new Error('search for a word in the comments missed it: ' + titles);
});
await step('archive list view', async () => {
  await win.fill('.search input', 'interstellar');
  await win.waitForTimeout(400);
  await win.click('.seg-opt[title="List"]');
  await win.waitForSelector('.list-row');
  await shot('list');
});
console.log('errors:', errors);
const lib = JSON.parse(fs.readFileSync(path.join(dataDir, 'library.json'), 'utf8'));
const c = lib.critiques.find((x) => x.title === 'Interstellar');
console.log('saved:', c && { title: c.title, type: c.type, director: c.director, studio: c.studio, scores: c.scores, classOverride: c.classOverride, recommend: c.recommend, remarks: c.finalRemarks, comments: c.comments });
console.log('watchlist:', lib.watchlist.map((w) => w.title + ' ' + w.status), 'drafts:', lib.drafts.length);
await app.close();
