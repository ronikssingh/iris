import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
const [dataDir, xdg, out] = process.argv.slice(2);
const app = await electron.launch({ executablePath: path.resolve('node_modules/electron/dist/electron'), args: ['.', '--no-sandbox'], env: { ...process.env, IRIS_TEST: '1', IRIS_DATA_DIR: dataDir, XDG_CONFIG_HOME: xdg } });
let win = null;
for (let i = 0; i < 120 && !win; i++) {
  win = app.windows().find((w) => w.url().includes('dist/index.html')) ?? null;
  if (!win) await new Promise((r) => setTimeout(r, 500));
}
await win.waitForSelector('.toast', { timeout: 60000 }).catch(() => {});
const toasts = await win.$$eval('.toast-text', (els) => els.map((e) => e.textContent));
console.log('toasts:', toasts);
await win.screenshot({ path: out });
const lib = JSON.parse(fs.readFileSync(path.join(dataDir, 'library.json'), 'utf8'));
console.log('critiques:', lib.critiques.map((c) => `${c.title} (${c.id}) poster=${c.poster ? 'yes' : 'no'}`));
console.log('watchlist:', lib.watchlist.map((w) => `${w.title} [${w.status}] ${w.note}`));
console.log('meta:', lib.meta);
console.log('media files:', fs.readdirSync(path.join(dataDir, 'Media')));
await app.close();
