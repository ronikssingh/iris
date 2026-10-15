// Draws the Iris app icon (an aperture opening onto warm light) and writes
// build/icon.png, build/icon.icns and build/icon.ico.  Run with: npm run icons
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const OUT = path.resolve('build');
fs.mkdirSync(OUT, { recursive: true });

const C = 512;
const BLADES = 7;
const OPEN = 112; // radius of the opening
const RING_IN = 300; // inner edge of the lens barrel

const pt = (a, r) => [C + Math.cos(a) * r, C + Math.sin(a) * r];
const f = (n) => n.toFixed(2);

/** Where the line from p heading along d meets the circle of radius r. */
function hitCircle(p, d, r) {
  const ox = p[0] - C;
  const oy = p[1] - C;
  const b = ox * d[0] + oy * d[1];
  const c = ox * ox + oy * oy - r * r;
  const t = -b + Math.sqrt(b * b - c);
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}

function iconSvg({ small = false } = {}) {
  const rot = -Math.PI / 2 + 0.31;
  const poly = Array.from({ length: BLADES }, (_, i) => pt(rot + (i / BLADES) * Math.PI * 2, OPEN));
  const dirs = poly.map((p, i) => {
    const q = poly[(i + 1) % BLADES];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const l = Math.hypot(dx, dy);
    return [dx / l, dy / l];
  });
  // blade i: opening edge p_i -> p_{i+1}, out along that edge to the barrel, round the barrel, and back in along the previous edge
  const hits = poly.map((p, i) => hitCircle(poly[(i + 1) % BLADES], dirs[i], RING_IN + 6));
  let blades = '';
  let edges = '';
  for (let i = 0; i < BLADES; i++) {
    const p0 = poly[i];
    const p1 = poly[(i + 1) % BLADES];
    const q1 = hits[i];
    const q0 = hits[(i - 1 + BLADES) % BLADES];
    const tone = i % 2 ? 'url(#bladeA)' : 'url(#bladeB)';
    blades += `<path d="M${f(p0[0])},${f(p0[1])} L${f(p1[0])},${f(p1[1])} L${f(q1[0])},${f(q1[1])} A${RING_IN + 6},${RING_IN + 6} 0 0 0 ${f(q0[0])},${f(q0[1])} Z" fill="${tone}"/>`;
    // the leading edge of each blade catches the light coming through the opening
    edges += `<line x1="${f(p1[0])}" y1="${f(p1[1])}" x2="${f(q1[0])}" y2="${f(q1[1])}" stroke="url(#edge${i})" stroke-width="${small ? 9 : 4.5}" stroke-linecap="round"/>`;
  }
  const edgeGrads = Array.from({ length: BLADES }, (_, i) => {
    const p1 = poly[(i + 1) % BLADES];
    const q1 = hits[i];
    return `<linearGradient id="edge${i}" gradientUnits="userSpaceOnUse" x1="${f(p1[0])}" y1="${f(p1[1])}" x2="${f(q1[0])}" y2="${f(q1[1])}">
      <stop offset="0" stop-color="#ffe2a8" stop-opacity="0.95"/>
      <stop offset="0.45" stop-color="#d9a35a" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#d9a35a" stop-opacity="0"/>
    </linearGradient>`;
  }).join('');
  const openPts = poly.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');

  let ticks = '';
  if (!small) {
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const long = i % 6 === 0;
      const a0 = pt(a, long ? 336 : 340);
      const a1 = pt(a, long ? 356 : 350);
      ticks += `<line x1="${f(a0[0])}" y1="${f(a0[1])}" x2="${f(a1[0])}" y2="${f(a1[1])}" stroke="#f4e3c1" stroke-opacity="${long ? 0.34 : 0.16}" stroke-width="${long ? 3.4 : 2.2}" stroke-linecap="round"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    ${edgeGrads}
    <linearGradient id="body" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#2a2140"/>
      <stop offset="0.55" stop-color="#120f1c"/>
      <stop offset="1" stop-color="#07060b"/>
    </linearGradient>
    <radialGradient id="warm" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ff9d3c" stop-opacity="0.38"/>
      <stop offset="0.6" stop-color="#7a3a14" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="0.3" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.02"/>
    </linearGradient>
    <linearGradient id="barrel" x1="0.15" y1="0.05" x2="0.85" y2="0.95">
      <stop offset="0" stop-color="#8d8798"/>
      <stop offset="0.25" stop-color="#3a3644"/>
      <stop offset="0.55" stop-color="#1b1922"/>
      <stop offset="0.8" stop-color="#4b4656"/>
      <stop offset="1" stop-color="#16141c"/>
    </linearGradient>
    <linearGradient id="bladeA" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#4a4559"/>
      <stop offset="1" stop-color="#15131c"/>
    </linearGradient>
    <linearGradient id="bladeB" x1="0.8" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="#2e2a39"/>
      <stop offset="1" stop-color="#0a090e"/>
    </linearGradient>
    <radialGradient id="light" cx="0.47" cy="0.45" r="0.6">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.38" stop-color="#fff1cf"/>
      <stop offset="0.7" stop-color="#ffc26a"/>
      <stop offset="1" stop-color="#ef7d2c"/>
    </radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0"/>
    </filter>
    <radialGradient id="flareGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#9fd4ff" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="16"/>
      <feOffset dy="14"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="bloom" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${small ? 18 : 30}"/></filter>
    <filter id="soft" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="softer" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="10"/></filter>
    <clipPath id="squircle"><rect x="100" y="100" width="824" height="824" rx="186"/></clipPath>
    <clipPath id="inside"><circle cx="${C}" cy="${C}" r="${RING_IN + 6}"/></clipPath>
  </defs>

  <g filter="url(#shadow)">
    <rect x="100" y="100" width="824" height="824" rx="186" fill="url(#body)"/>
  </g>
  <g clip-path="url(#squircle)">
    <circle cx="${C}" cy="${C}" r="430" fill="url(#warm)"/>
    ${small ? '' : '<rect x="100" y="100" width="824" height="824" filter="url(#grain)"/>'}
    ${ticks}
    <g clip-path="url(#inside)">
      <circle cx="${C}" cy="${C}" r="${RING_IN + 6}" fill="#0b0a10"/>
      ${blades}
      ${edges}
    </g>
    <circle cx="${C}" cy="${C}" r="${RING_IN + 15}" fill="none" stroke="url(#barrel)" stroke-width="30"/>
    <circle cx="${C}" cy="${C}" r="${RING_IN + 31}" fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="2"/>
    <circle cx="${C}" cy="${C}" r="${RING_IN}" fill="none" stroke="#e6bd72" stroke-opacity="0.8" stroke-width="3"/>
    <polygon points="${openPts}" fill="#ffb24d" opacity="0.75" filter="url(#bloom)"/>
    <polygon points="${openPts}" fill="url(#light)"/>
    ${
      small
        ? ''
        : `<ellipse cx="${C}" cy="${C}" rx="270" ry="16" fill="#9fd4ff" opacity="0.2" filter="url(#softer)"/>
    <ellipse cx="${C}" cy="${C}" rx="235" ry="4.5" fill="url(#flareGlow)" opacity="0.7" filter="url(#soft)"/>`
    }
    <rect x="101.5" y="101.5" width="821" height="821" rx="185" fill="none" stroke="url(#rim)" stroke-width="3"/>
  </g>
</svg>`;
}

function render(svg, size) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' });
  return r.render().asPng();
}

// PNG payloads for each size. Tiny sizes use a simplified drawing so they stay crisp.
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const png = {};
for (const s of sizes) png[s] = Buffer.from(render(iconSvg({ small: s <= 64 }), s));

fs.writeFileSync(path.join(OUT, 'icon.png'), png[1024]);
fs.writeFileSync(path.join(OUT, 'icon.svg'), iconSvg());

// .icns: a list of typed PNG chunks
const icnsEntries = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512],
];
const chunks = icnsEntries.map(([type, s]) => {
  const head = Buffer.alloc(8);
  head.write(type, 0, 'ascii');
  head.writeUInt32BE(png[s].length + 8, 4);
  return Buffer.concat([head, png[s]]);
});
const body = Buffer.concat(chunks);
const icnsHead = Buffer.alloc(8);
icnsHead.write('icns', 0, 'ascii');
icnsHead.writeUInt32BE(body.length + 8, 4);
fs.writeFileSync(path.join(OUT, 'icon.icns'), Buffer.concat([icnsHead, body]));

// .ico: PNG-compressed entries (Windows Vista and later)
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const dir = Buffer.alloc(6 + 16 * icoSizes.length);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2);
dir.writeUInt16LE(icoSizes.length, 4);
let offset = dir.length;
icoSizes.forEach((s, i) => {
  const e = 6 + i * 16;
  dir.writeUInt8(s >= 256 ? 0 : s, e);
  dir.writeUInt8(s >= 256 ? 0 : s, e + 1);
  dir.writeUInt8(0, e + 2);
  dir.writeUInt8(0, e + 3);
  dir.writeUInt16LE(1, e + 4);
  dir.writeUInt16LE(32, e + 6);
  dir.writeUInt32LE(png[s].length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += png[s].length;
});
fs.writeFileSync(path.join(OUT, 'icon.ico'), Buffer.concat([dir, ...icoSizes.map((s) => png[s])]));

console.log('icons written to', OUT);

// The window you see when the .dmg opens: Iris on the left, Applications on the right, a beam of light between.
function dmgSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="380" viewBox="0 0 540 380">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#1c1727"/>
      <stop offset="1" stop-color="#07060b"/>
    </linearGradient>
    <radialGradient id="glowL" cx="140" cy="190" r="150" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ff9d3c" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#ff9d3c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowR" cx="400" cy="190" r="120" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#9fd4ff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#9fd4ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffd38a" stop-opacity="0"/>
      <stop offset="0.35" stop-color="#ffd38a" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#ffd38a" stop-opacity="0.15"/>
    </linearGradient>
    <filter id="g2" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0"/>
    </filter>
    <filter id="blur2"><feGaussianBlur stdDeviation="2.2"/></filter>
  </defs>
  <rect width="540" height="380" fill="url(#bg)"/>
  <rect width="540" height="380" fill="url(#glowL)"/>
  <rect width="540" height="380" fill="url(#glowR)"/>
  <rect width="540" height="380" filter="url(#g2)"/>
  <path d="M 214 192 C 262 168, 300 168, 336 186" fill="none" stroke="url(#beam)" stroke-width="5" stroke-linecap="round" filter="url(#blur2)" opacity="0.7"/>
  <path d="M 214 192 C 262 168, 300 168, 336 186" fill="none" stroke="url(#beam)" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M 327 176 L 338 187 L 323 190" fill="none" stroke="#ffd38a" stroke-opacity="0.75" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}
fs.writeFileSync(path.join(OUT, 'background.png'), Buffer.from(render(dmgSvg(), 540)));
fs.writeFileSync(path.join(OUT, 'background@2x.png'), Buffer.from(render(dmgSvg(), 1080)));
console.log('dmg background written');
