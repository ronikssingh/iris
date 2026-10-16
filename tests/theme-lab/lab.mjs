// Design-review renderer for the worlds (never shipped).
// node tests/theme-lab/lab.mjs <outdir> "<world>@<time>[,mx,my,flash]" ... [--size=1280x800] [--sheet=name.png] [--cols=2]
// Renders each requested frame with the real shader source in headless Chromium and writes PNGs,
// plus an optional labelled contact sheet.
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const outDir = args.shift();
const opts = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const frames = args.filter((a) => !a.startsWith('--'));
const [W, H] = (opts.size || '1280x800').split('x').map(Number);
fs.mkdirSync(outDir, { recursive: true });

const bundle = await build({
  entryPoints: [path.resolve('tests/theme-lab/entry.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'Lab',
  logLevel: 'error',
});
const code = bundle.outputFiles[0].text;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--disable-gpu-watchdog', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--disable-default-apps'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><body style="margin:0;background:#000"><canvas id="c" width="${W}" height="${H}"></canvas><script>${code}</script></body>`);

const written = [];
for (const spec of frames) {
  const [idTime, ...rest] = spec.split(',');
  const [id, t] = idTime.split('@');
  const [mx = 0, my = 0, flash = 0] = rest.map(Number);
  // "a>b~style~progress@t" draws a transition frame between two worlds
  const tr = id.includes('>') ? (() => { const [ab, style, prog] = id.split('~'); const [a, b] = ab.split('>'); return { a, b, style: Number(style), prog: Number(prog) }; })() : null;
  let r;
  let best = Infinity;
  for (let k = 0; k < Number(opts.reps || 1); k++) {
    r = tr
      ? await page.evaluate(([a, b, st, pg, t]) => window.Lab.transition(a, b, st, pg, t), [tr.a, tr.b, tr.style, tr.prog, Number(t || 0)])
      : await page.evaluate(([id, t, mx, my, flash]) => window.Lab.render(id, t, mx, my, flash), [id, Number(t || 0), mx, my, flash]);
    if (r.error) break;
    best = Math.min(best, r.ms);
  }
  if (!r.error) r.ms = best;
  if (r.error) {
    console.log(`ERROR ${id}: ${r.error.slice(0, 3000)}`);
    continue;
  }
  const file = path.join(outDir, `${id.replace(/[>~]/g, '_')}-${String(t).replace('.', '_')}${rest.length ? '-' + rest.join('_') : ''}.png`);
  fs.writeFileSync(file, Buffer.from(r.url.split(',')[1], 'base64'));
  written.push({ file, label: `${id} t=${t}${rest.length ? ' ' + rest.join(',') : ''}  ${Math.round(r.ms)}ms` });
  console.log(`${file}  ${Math.round(r.ms)}ms`);
}
await browser.close();

if (opts.sheet && written.length) {
  const cols = Number(opts.cols || 2);
  const tw = Number(opts.tw || 720);
  const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[1]); cols = int(sys.argv[2]); tw = int(sys.argv[3]); out = sys.argv[4]
ims = [Image.open(i['file']).convert('RGB') for i in items]
th = int(tw * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * th), (0, 0, 0))
d = ImageDraw.Draw(sheet)
for k, (im, it) in enumerate(zip(ims, items)):
    x, y = (k % cols) * tw, (k // cols) * th
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y))
    d.rectangle([x, y, x + 8 * len(it['label']) + 10, y + 18], fill=(0, 0, 0))
    d.text((x + 5, y + 3), it['label'], fill=(255, 255, 255))
sheet.save(out)
`;
  execFileSync('python3', ['-I', '-c', py, JSON.stringify(written), String(cols), String(tw), path.join(outDir, opts.sheet)]);
  console.log('sheet', path.join(outDir, opts.sheet));
}
