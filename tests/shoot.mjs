// Launches the built app under Xvfb and captures screenshots of a sequence of steps.
import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const [dataDir, outDir, stepsJson] = process.argv.slice(2);
const steps = JSON.parse(stepsJson || '[]');
fs.mkdirSync(outDir, { recursive: true });
const app = await electron.launch({
  executablePath: path.resolve('node_modules/electron/dist/electron'),
  args: ['.', '--no-sandbox'],
  env: { ...process.env, IRIS_TEST: '1', IRIS_DATA_DIR: dataDir, IRIS_SKIP_LEGACY: '1' },
  timeout: 60000,
});
const win = await app.firstWindow();
const logs = [];
win.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
win.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await win.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1440, 900); w.center(); });
await win.waitForTimeout(1500);
let i = 0;
for (const s of steps) {
  try {
    if (s.click) await win.click(s.click, { timeout: 8000 });
    if (s.fill) await win.fill(s.fill[0], s.fill[1]);
    if (s.press) await win.keyboard.press(s.press);
    if (s.type) await win.keyboard.type(s.type, { delay: 20 });
    if (s.eval) await win.evaluate(s.eval);
    if (s.wait) await win.waitForTimeout(s.wait);
    if (s.shot) {
      const f = path.join(outDir, `${String(i).padStart(2, '0')}-${s.shot}.png`);
      await win.screenshot({ path: f });
      console.log('shot', f);
      i++;
    }
  } catch (e) {
    console.log('STEP FAILED', JSON.stringify(s), e.message.split('\n')[0]);
  }
}
fs.writeFileSync(path.join(outDir, 'console.log'), logs.join('\n'));
console.log('console lines:', logs.length);
console.log(logs.filter((l) => /error|warn/i.test(l)).slice(0, 30).join('\n'));
await app.close();
