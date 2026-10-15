import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
const [dataDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const app = await electron.launch({ executablePath: path.resolve('node_modules/electron/dist/electron'), args: ['.', '--no-sandbox'], env: { ...process.env, IRIS_TEST: '1', IRIS_DATA_DIR: dataDir, IRIS_SKIP_LEGACY: '1' } });
const win = await app.firstWindow();
const logs = [];
win.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
const t0 = Date.now();
for (let i = 0; i < 16; i++) {
  const stage = await win.evaluate(() => document.querySelector('.intro')?.className ?? 'no-intro').catch((e) => 'err ' + e.message);
  await win.screenshot({ path: path.join(outDir, `f${String(i).padStart(2, '0')}.png`) }).catch(() => {});
  console.log(i, Date.now() - t0, 'ms', stage);
  await new Promise((r) => setTimeout(r, 250));
}
console.log(logs.join('\n'));
await app.close();
