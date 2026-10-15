import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const out = 'dist-electron';
fs.mkdirSync(out, { recursive: true });
const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: false,
  logLevel: 'warning',
  minify: process.env.NODE_ENV === 'production',
};
await build({ ...common, entryPoints: ['electron/main.ts'], outfile: path.join(out, 'main.js') });
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: path.join(out, 'preload.js') });
fs.copyFileSync('electron/legacy-reader.html', path.join(out, 'legacy-reader.html'));
console.log('main + preload built');
