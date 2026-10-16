/* Foreground atmosphere drawn on a 2D canvas above the shader: rain, sand, snow, embers and friends. */
import type { ParticleKind } from './themes';

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  s: number;
  a: number;
  r: number;
  vr: number;
  c: number;
  t: number;
  life: number;
}

const sprites = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string, size = 32): HTMLCanvasElement {
  const key = color + size;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, color);
  grd.addColorStop(0.25, color.replace(/[\d.]+\)$/, '0.55)'));
  grd.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  sprites.set(key, c);
  return c;
}

/** A four-pointed glint: the moon catching a wave. */
function glintSprite(): HTMLCanvasElement {
  const key = 'glint';
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d')!;
  g.translate(24, 24);
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 10);
  core.addColorStop(0, 'rgba(255, 255, 255, 1)');
  core.addColorStop(0.3, 'rgba(220, 232, 255, 0.55)');
  core.addColorStop(1, 'rgba(200, 220, 255, 0)');
  g.fillStyle = core;
  g.fillRect(-24, -24, 48, 48);
  for (const [sx, sy] of [[1, 0.09], [0.09, 0.62]]) {
    g.save();
    g.scale(sx, sy);
    const ray = g.createRadialGradient(0, 0, 0, 0, 0, 24);
    ray.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    ray.addColorStop(1, 'rgba(210, 225, 255, 0)');
    g.fillStyle = ray;
    g.beginPath();
    g.arc(0, 0, 24, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  sprites.set(key, c);
  return c;
}

/** A paper lantern, lit from within, with its halo. */
function lanternSprite(): HTMLCanvasElement {
  const key = 'lantern';
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 64;
  c.height = 80;
  const g = c.getContext('2d')!;
  const halo = g.createRadialGradient(32, 42, 0, 32, 42, 34);
  halo.addColorStop(0, 'rgba(255, 190, 90, 0.55)');
  halo.addColorStop(0.45, 'rgba(255, 150, 60, 0.16)');
  halo.addColorStop(1, 'rgba(255, 140, 50, 0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, 64, 80);
  const body = g.createLinearGradient(0, 30, 0, 56);
  body.addColorStop(0, 'rgba(214, 104, 40, 1)');
  body.addColorStop(0.45, 'rgba(255, 214, 128, 1)');
  body.addColorStop(1, 'rgba(240, 140, 56, 1)');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(25, 30);
  g.quadraticCurveTo(32, 27, 39, 30);
  g.quadraticCurveTo(42, 43, 39, 56);
  g.quadraticCurveTo(32, 58, 25, 56);
  g.quadraticCurveTo(22, 43, 25, 30);
  g.fill();
  g.fillStyle = 'rgba(255, 246, 210, 0.9)';
  g.beginPath();
  g.ellipse(32, 51, 4.5, 2.4, 0, 0, Math.PI * 2);
  g.fill();
  sprites.set(key, c);
  return c;
}

/** A maple leaf in one of the autumn colours. */
function leafSprite(color: string): HTMLCanvasElement {
  const key = 'leaf' + color;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 40;
  const g = c.getContext('2d')!;
  g.translate(20, 21);
  g.fillStyle = color;
  g.beginPath();
  // five pointed lobes around the stem
  const lobes = [
    [0, -17],
    [6, -8],
    [15, -9],
    [11, 0],
    [16, 7],
    [6, 6],
    [2, 12],
    [-2, 12],
    [-6, 6],
    [-16, 7],
    [-11, 0],
    [-15, -9],
    [-6, -8],
  ];
  g.moveTo(lobes[0][0], lobes[0][1]);
  for (let i = 1; i < lobes.length; i++) g.lineTo(lobes[i][0], lobes[i][1]);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(80, 20, 10, 0.45)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, 17);
  g.lineTo(0, -12);
  g.moveTo(0, 2);
  g.lineTo(10, -5);
  g.moveTo(0, 2);
  g.lineTo(-10, -5);
  g.stroke();
  sprites.set(key, c);
  return c;
}

const POP = ['#ff2e88', '#00e5ff', '#ffe600', '#6b2bff', '#ffffff'];
const LEAVES = ['#d2452a', '#e8702c', '#c4321f', '#efa23a', '#b8432c'];
const NEON = ['rgba(255, 80, 220, ', 'rgba(60, 230, 255, ', 'rgba(255, 170, 90, '];

export class ParticleField {
  items: P[] = [];
  alpha = 0;
  target = 1;
  private w = 1;
  private h = 1;
  private birds: { x: number; y: number; v: number; n: number; t: number } | null = null;
  private nextBirds = 6 + Math.random() * 10;
  private meteor: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  private nextMeteor = 3 + Math.random() * 6;

  constructor(
    readonly kind: ParticleKind,
    private density: number,
  ) {}

  resize(w: number, h: number) {
    const first = this.items.length === 0;
    this.w = w;
    this.h = h;
    if (first) this.seed();
  }

  private count(): number {
    const area = (this.w * this.h) / (1440 * 900);
    const base: Record<ParticleKind, number> = {
      rain: 380,
      motes: 70,
      sand: 300,
      confetti: 46,
      spray: 200,
      snow: 260,
      meteors: 0,
      none: 0,
      dust: 150,
      embers: 110,
      pollen: 90,
      lanterns: 12,
      glints: 46,
      fireflies: 42,
      streaks: 56,
      spirits: 16,
      debris: 40,
      leaves: 20,
      neonrain: 320,
      spores: 70,
    };
    return Math.round(base[this.kind] * Math.min(1.6, Math.max(0.5, area)) * this.density);
  }

  private make(initial: boolean): P {
    const w = this.w;
    const h = this.h;
    const z = Math.random();
    const p: P = { x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, z, s: 1, a: 1, r: 0, vr: 0, c: 0, t: Math.random() * 100, life: 1 };
    switch (this.kind) {
      case 'rain':
        p.vy = 900 + z * 900;
        p.vx = -140 - z * 80;
        p.s = 10 + z * 22;
        p.a = 0.12 + z * 0.32;
        if (!initial) p.y = -40;
        break;
      case 'motes':
        p.vx = -6 + Math.random() * 12;
        p.vy = -4 - Math.random() * 10;
        p.s = 2 + z * 6;
        p.a = 0.25 + z * 0.55;
        break;
      case 'sand':
        p.vx = 420 + z * 900;
        p.vy = -10 + Math.random() * 30;
        p.s = 4 + z * 26;
        p.a = 0.12 + z * 0.35;
        p.y = h * (0.35 + Math.random() * 0.65);
        if (!initial) p.x = -40;
        break;
      case 'confetti':
        p.vx = -20 + Math.random() * 40;
        p.vy = 24 + Math.random() * 46;
        p.s = 6 + z * 12;
        p.r = Math.random() * Math.PI * 2;
        p.vr = (Math.random() - 0.5) * 2.4;
        p.c = Math.floor(Math.random() * POP.length);
        p.t = Math.floor(Math.random() * 4);
        if (!initial) p.y = -30;
        break;
      case 'spray':
        if (Math.random() < 0.34) {
          // embers rising from somewhere below the horizon
          p.c = 1;
          p.vx = -10 + Math.random() * 30;
          p.vy = -40 - Math.random() * 70;
          p.s = 3 + z * 7;
          p.a = 0.4 + z * 0.5;
          if (!initial) p.y = h + 10;
        } else {
          p.c = 0;
          p.vy = 520 + z * 520;
          p.vx = -260 - z * 160;
          p.s = 8 + z * 16;
          p.a = 0.08 + z * 0.2;
          if (!initial) p.y = -30;
        }
        break;
      case 'snow':
        p.vy = 20 + z * 60;
        p.vx = -8 + Math.random() * 16;
        p.s = 0.8 + z * z * 3.6;
        p.a = 0.25 + z * 0.65;
        if (!initial) p.y = -10;
        break;
      case 'dust':
        p.vx = -4 + Math.random() * 8;
        p.vy = -3 + Math.random() * 6;
        p.s = 0.6 + z * 1.8;
        p.a = 0.15 + z * 0.5;
        break;
      case 'embers':
        p.vx = -12 + Math.random() * 24;
        p.vy = -22 - Math.random() * 60;
        p.s = 2 + z * 7;
        p.a = 0.35 + z * 0.6;
        p.life = 0.6 + Math.random() * 0.4;
        if (!initial) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        break;
      case 'pollen':
        p.vx = 10 + Math.random() * 22;
        p.vy = -3 + Math.random() * 6;
        p.s = 1.2 + z * 3.4;
        p.a = 0.2 + z * 0.55;
        if (!initial) p.x = -10;
        break;
      case 'lanterns':
        p.vy = -(6 + z * 14);
        p.vx = 1.5 + Math.random() * 3;
        p.s = 0.22 + z * 0.55;
        p.a = 0.55 + z * 0.4;
        p.y = initial ? h * (0.15 + Math.random() * 0.85) : h + 30;
        break;
      case 'glints': {
        // most of the glitter lies along the moon's path on the water
        const g = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
        p.x = Math.random() < 0.7 ? w * (0.6 + g * 0.5) : Math.random() * w;
        p.y = h * (0.6 + Math.pow(Math.random(), 0.7) * 0.4);
        p.s = 3 + z * 9 * (p.y / h);
        p.life = 0.35 + Math.random() * 0.9;
        p.t = initial ? Math.random() * -3 : -Math.random() * 2.5;
        p.a = 0.5 + z * 0.5;
        break;
      }
      case 'fireflies':
        p.y = h * (0.3 + Math.random() * 0.7);
        p.vx = (Math.random() - 0.5) * 16;
        p.vy = (Math.random() - 0.5) * 10;
        p.s = 1.6 + z * 3;
        p.a = 0.6 + z * 0.4;
        p.r = Math.random() * Math.PI * 2;
        p.c = 0.8 + Math.random() * 2.6; // how long it rests between glows
        break;
      case 'streaks':
        p.r = Math.random() * Math.PI * 2;
        p.c = initial ? 0.05 + Math.random() * 0.9 : 0.03 + Math.random() * 0.08; // distance out, as a fraction of the corner
        p.vr = 0.35 + z * 0.9;
        p.s = 0.04 + z * 0.12;
        p.a = 0.15 + z * 0.5;
        break;
      case 'spirits':
        p.y = h * (0.25 + Math.random() * 0.7);
        p.vx = (Math.random() - 0.5) * 8;
        p.vy = -2 - Math.random() * 5;
        p.s = 3 + z * 7;
        p.a = 0.4 + z * 0.5;
        p.c = Math.random() < 0.18 ? 1 : 0;
        if (!initial) p.y = h + 20;
        break;
      case 'debris':
        p.vx = -5 + Math.random() * 10;
        p.vy = -(4 + z * 16);
        p.s = 1.2 + z * 4;
        p.a = 0.14 + z * 0.32;
        p.r = Math.random() * Math.PI * 2;
        p.vr = (Math.random() - 0.5) * 1.6;
        p.c = Math.random() < 0.5 ? 0 : 1;
        if (!initial) p.y = h + 10;
        break;
      case 'leaves':
        p.vx = 50 + z * 90;
        p.vy = 8 + Math.random() * 24;
        p.s = 7 + z * 13;
        p.a = 0.75 + z * 0.25;
        p.r = Math.random() * Math.PI * 2;
        p.vr = (Math.random() - 0.5) * 3;
        p.c = Math.floor(Math.random() * LEAVES.length);
        if (!initial) {
          p.x = -30;
          p.y = Math.random() * h * 0.85;
        }
        break;
      case 'neonrain':
        p.vy = 760 + z * 700;
        p.vx = -60 - z * 50;
        p.s = 9 + z * 20;
        p.a = 0.1 + z * 0.3;
        p.c = Math.random() < 0.3 ? 1 + Math.floor(Math.random() * NEON.length) : 0;
        if (!initial) p.y = -40;
        break;
      case 'spores':
        p.vx = -4 + Math.random() * 8;
        p.vy = -(3 + z * 9);
        p.s = 1 + z * 3.2;
        p.a = 0.25 + z * 0.6;
        p.c = Math.random() < 0.3 ? 1 : 0;
        if (!initial) p.y = h + 10;
        break;
      default:
        break;
    }
    return p;
  }

  private seed() {
    const n = this.count();
    this.items = Array.from({ length: n }, () => this.make(true));
  }

  private lastFade = performance.now();

  step(ctx: CanvasRenderingContext2D, dt: number, mouse: { x: number; y: number; active: boolean }, flash: number) {
    // fades use wall-clock time so a slow frame rate never leaves an old world's particles lingering
    const now = performance.now();
    const real = Math.min(1, (now - this.lastFade) / 1000);
    this.lastFade = now;
    if (this.alpha <= 0.001 && this.target === 0) return;
    this.alpha += (this.target - this.alpha) * Math.min(1, real * 1.8);
    if (this.target === 0 && this.alpha < 0.02) this.alpha = 0;
    const A = this.alpha;
    const w = this.w;
    const h = this.h;
    const repel = (p: P, radius: number, force: number) => {
      if (!mouse.active) return;
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius && d2 > 1) {
        const d = Math.sqrt(d2);
        const f = (1 - d / radius) * force * dt;
        p.x += (dx / d) * f;
        p.y += (dy / d) * f;
      }
    };

    switch (this.kind) {
      case 'rain': {
        ctx.lineCap = 'round';
        for (const p of this.items) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y > h + 40 || p.x < -60) Object.assign(p, this.make(false), { x: Math.random() * (w + 200) });
          const k = p.s / p.vy;
          ctx.strokeStyle = `rgba(190, 204, 228, ${(p.a + flash * 0.35) * A})`;
          ctx.lineWidth = 0.6 + p.z * 0.9;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k);
          ctx.stroke();
        }
        break;
      }
      case 'motes': {
        ctx.globalCompositeOperation = 'lighter';
        const spr = glowSprite('rgba(255, 236, 190, 1)');
        for (const p of this.items) {
          p.t += dt;
          p.x += (p.vx + Math.sin(p.t * 0.6) * 6) * dt;
          p.y += p.vy * dt;
          repel(p, 140, 60);
          if (p.y < -20) Object.assign(p, this.make(false), { y: h + 10 });
          if (p.x < -20) p.x = w + 10;
          if (p.x > w + 20) p.x = -10;
          ctx.globalAlpha = p.a * A * (0.6 + 0.4 * Math.sin(p.t * 1.7));
          ctx.drawImage(spr, p.x - p.s * 2, p.y - p.s * 2, p.s * 4, p.s * 4);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        this.drawBirds(ctx, dt, A);
        break;
      }
      case 'sand': {
        for (const p of this.items) {
          p.t += dt;
          p.x += p.vx * dt;
          p.y += (p.vy + Math.sin(p.t * 3 + p.x * 0.01) * 18) * dt;
          if (p.x > w + 60) Object.assign(p, this.make(false));
          ctx.strokeStyle = `rgba(255, 214, 160, ${p.a * A})`;
          ctx.lineWidth = 0.6 + p.z * 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.s, p.y - p.vy * 0.01);
          ctx.stroke();
        }
        break;
      }
      case 'confetti': {
        for (const p of this.items) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.r += p.vr * dt;
          repel(p, 130, 160);
          if (p.y > h + 30) Object.assign(p, this.make(false), { x: Math.random() * w });
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.globalAlpha = 0.85 * A;
          const s = p.s;
          const draw = (off: number, color: string) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            if (p.t === 0) ctx.rect(-s / 2 + off, -s / 2 + off, s, s);
            else if (p.t === 1) ctx.arc(off, off, s / 2, 0, Math.PI * 2);
            else if (p.t === 2) {
              ctx.moveTo(off, -s / 2 + off);
              ctx.lineTo(s / 2 + off, s / 2 + off);
              ctx.lineTo(-s / 2 + off, s / 2 + off);
              ctx.closePath();
            } else {
              for (let i = 0; i < 10; i++) {
                const rr = i % 2 ? s * 0.22 : s * 0.55;
                const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
                ctx.lineTo(Math.cos(a) * rr + off, Math.sin(a) * rr + off);
              }
              ctx.closePath();
            }
            ctx.fill();
          };
          draw(2.5, '#0b0420');
          draw(0, POP[p.c]);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'spray': {
        const spr = glowSprite('rgba(255, 170, 70, 1)');
        for (const p of this.items) {
          p.t += dt;
          if (p.c === 1) {
            p.x += (p.vx + Math.sin(p.t * 1.3) * 14) * dt;
            p.y += p.vy * dt;
            if (p.y < h * 0.15 || p.x < -20 || p.x > w + 20) Object.assign(p, this.make(false), { c: 1, y: h + 10, vy: -40 - Math.random() * 70, vx: -10 + Math.random() * 30, s: 3 + p.z * 7, a: 0.4 + p.z * 0.5 });
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = p.a * A * (0.55 + 0.45 * Math.sin(p.t * 6 + p.x));
            ctx.drawImage(spr, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
          } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y > h + 30 || p.x < -60) Object.assign(p, this.make(false), { c: 0, x: Math.random() * (w + 300), y: -30, vy: 520 + p.z * 520, vx: -260 - p.z * 160, s: 8 + p.z * 16, a: 0.08 + p.z * 0.2 });
            const k = p.s / p.vy;
            ctx.strokeStyle = `rgba(200, 220, 225, ${(p.a + flash * 0.3) * A})`;
            ctx.lineWidth = 0.6 + p.z * 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k);
            ctx.stroke();
          }
        }
        break;
      }
      case 'snow': {
        ctx.fillStyle = '#eaf6ff';
        for (const p of this.items) {
          p.t += dt;
          p.x += (p.vx + Math.sin(p.t * (0.6 + p.z) + p.z * 9) * 18 * p.z) * dt;
          p.y += p.vy * dt;
          repel(p, 120, 120);
          if (p.y > h + 10) Object.assign(p, this.make(false), { x: Math.random() * w });
          if (p.x < -10) p.x = w + 5;
          if (p.x > w + 10) p.x = -5;
          ctx.globalAlpha = p.a * A;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'meteors': {
        this.nextMeteor -= dt;
        if (!this.meteor && this.nextMeteor <= 0) {
          this.meteor = { x: w * (0.2 + Math.random() * 0.7), y: h * (0.05 + Math.random() * 0.25), vx: -(500 + Math.random() * 400), vy: 160 + Math.random() * 140, life: 1 };
          this.nextMeteor = 5 + Math.random() * 10;
        }
        const m = this.meteor;
        if (m) {
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          m.life -= dt * 1.1;
          const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.18, m.y - m.vy * 0.18);
          g.addColorStop(0, `rgba(255, 240, 220, ${0.9 * A * Math.max(0, m.life)})`);
          g.addColorStop(1, 'rgba(255, 240, 220, 0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - m.vx * 0.18, m.y - m.vy * 0.18);
          ctx.stroke();
          if (m.life <= 0) this.meteor = null;
        }
        break;
      }
      case 'dust': {
        ctx.fillStyle = '#fffaf0';
        for (const p of this.items) {
          p.t += dt;
          p.x += (p.vx + Math.sin(p.t * 0.7 + p.z * 5) * 5) * dt;
          p.y += (p.vy + Math.cos(p.t * 0.5 + p.z * 3) * 4) * dt;
          repel(p, 110, 50);
          if (p.x < -5) p.x = w + 4;
          if (p.x > w + 5) p.x = -4;
          if (p.y < -5) p.y = h + 4;
          if (p.y > h + 5) p.y = -4;
          const inBeam = Math.max(0, 1 - Math.abs((p.x / w - 0.72) - (0.35 - p.y / h) * 0.9) * 2.4);
          ctx.globalAlpha = p.a * A * (0.25 + inBeam * 0.9) * (0.7 + 0.3 * Math.sin(p.t * 2 + p.z * 20));
          ctx.fillRect(p.x, p.y, p.s, p.s);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'embers': {
        ctx.globalCompositeOperation = 'lighter';
        const spr = glowSprite('rgba(255, 160, 60, 1)');
        const sprHot = glowSprite('rgba(255, 220, 150, 1)', 24);
        for (const p of this.items) {
          p.t += dt;
          p.life -= dt * 0.06;
          p.x += (p.vx + Math.sin(p.t * 1.1 + p.z * 7) * 16) * dt;
          p.y += p.vy * dt;
          repel(p, 130, 90);
          if (p.y < -20 || p.life <= 0) Object.assign(p, this.make(false));
          const flick = 0.55 + 0.45 * Math.sin(p.t * (5 + p.z * 6) + p.x * 0.05);
          ctx.globalAlpha = p.a * A * flick * Math.min(1, p.life * 2);
          ctx.drawImage(p.z > 0.7 ? sprHot : spr, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'pollen': {
        ctx.globalCompositeOperation = 'lighter';
        const spr = glowSprite('rgba(255, 196, 120, 1)');
        const gust = 1 + 0.6 * Math.sin(now / 3100) * Math.sin(now / 1700);
        for (const p of this.items) {
          p.t += dt;
          p.x += p.vx * gust * dt;
          p.y += (p.vy + Math.sin(p.t * 0.9 + p.z * 6) * 7) * dt;
          repel(p, 120, 50);
          if (p.x > w + 20) Object.assign(p, this.make(false), { x: -10, y: Math.random() * h });
          if (p.y < -10) p.y = h + 5;
          if (p.y > h + 10) p.y = -5;
          ctx.globalAlpha = p.a * A * (0.55 + 0.45 * Math.sin(p.t * 2.3 + p.z * 11));
          ctx.drawImage(spr, p.x - p.s * 2, p.y - p.s * 2, p.s * 4, p.s * 4);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'lanterns': {
        const spr = lanternSprite();
        for (const p of this.items) {
          p.t += dt;
          p.x += (p.vx + Math.sin(p.t * 0.35 + p.z * 9) * 4) * dt;
          p.y += p.vy * dt;
          if (p.y < -60 || p.x > w + 40) Object.assign(p, this.make(false), { x: Math.random() * w });
          const fadeTop = Math.min(1, Math.max(0, p.y / (h * 0.35)));
          const flick = 0.85 + 0.15 * Math.sin(p.t * 7 + p.z * 13) * Math.sin(p.t * 3.1);
          ctx.globalAlpha = p.a * A * fadeTop * flick;
          const sw = 64 * p.s;
          const sh = 80 * p.s;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.t * 0.6 + p.z * 4) * 0.06);
          ctx.drawImage(spr, -sw / 2, -sh / 2, sw, sh);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'glints': {
        ctx.globalCompositeOperation = 'lighter';
        const spr = glintSprite();
        for (const p of this.items) {
          p.t += dt;
          if (p.t < 0) continue;
          if (p.t > p.life) {
            Object.assign(p, this.make(false));
            continue;
          }
          const k = Math.sin((p.t / p.life) * Math.PI);
          ctx.globalAlpha = p.a * A * k * k;
          const sz = p.s * (0.6 + 0.4 * k);
          ctx.drawImage(spr, p.x - sz, p.y - sz, sz * 2, sz * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'fireflies':
      case 'spirits': {
        ctx.globalCompositeOperation = 'lighter';
        const ff = this.kind === 'fireflies';
        const spr = ff ? glowSprite('rgba(214, 255, 110, 1)') : glowSprite('rgba(150, 255, 230, 1)');
        const warm = glowSprite('rgba(255, 214, 150, 1)');
        for (const p of this.items) {
          p.t += dt;
          // wander: heading drifts, speed eases
          p.r += (Math.sin(p.t * 0.7 + p.z * 17) * 0.9 + Math.sin(p.t * 0.23 + p.z * 5) * 0.6) * dt;
          const sp = ff ? 14 : 7;
          p.x += (Math.cos(p.r) * sp + p.vx * 0.2) * dt;
          p.y += (Math.sin(p.r) * sp * 0.6 + (ff ? 0 : p.vy)) * dt;
          repel(p, 130, ff ? 70 : 40);
          if (p.x < -20) p.x = w + 10;
          if (p.x > w + 20) p.x = -10;
          if (p.y < (ff ? h * 0.2 : -20)) {
            if (ff) p.r = Math.PI / 2;
            else Object.assign(p, this.make(false), { x: Math.random() * w });
          }
          if (p.y > h + 20) p.r = -Math.PI / 2;
          let glow: number;
          if (ff) {
            const cyc = (p.t + p.z * 7) % (p.c + 0.9);
            glow = cyc < 0.9 ? Math.sin((cyc / 0.9) * Math.PI) : 0;
          } else glow = 0.55 + 0.45 * Math.sin(p.t * (0.8 + p.z) + p.z * 9);
          if (glow <= 0.01) continue;
          ctx.globalAlpha = p.a * A * glow;
          const sz = p.s * (ff ? 2.6 : 2.2);
          ctx.drawImage(p.c === 1 && !ff ? warm : spr, p.x - sz, p.y - sz, sz * 2, sz * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'streaks': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        const cx = w * 0.5;
        const cy = h * 0.5;
        const R = Math.hypot(cx, cy);
        for (const p of this.items) {
          // speeding up as they come past
          p.c += p.vr * (0.15 + p.c * 1.6) * dt;
          if (p.c > 1.25) Object.assign(p, this.make(false));
          const r0 = p.c * R;
          const r1 = (p.c + p.s * (0.4 + p.c)) * R;
          const ca = Math.cos(p.r);
          const sa = Math.sin(p.r);
          const fade = Math.min(1, p.c * 3) * p.a * A;
          const g = ctx.createLinearGradient(cx + ca * r0, cy + sa * r0, cx + ca * r1, cy + sa * r1);
          g.addColorStop(0, 'rgba(255, 190, 90, 0)');
          g.addColorStop(1, `rgba(255, 236, 190, ${fade})`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 0.6 + p.z * 1.6 * p.c;
          ctx.beginPath();
          ctx.moveTo(cx + ca * r0, cy + sa * r0);
          ctx.lineTo(cx + ca * r1, cy + sa * r1);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'debris': {
        for (const p of this.items) {
          p.t += dt;
          p.x += (p.vx + Math.sin(p.t * 0.4 + p.z * 8) * 5) * dt;
          p.y += p.vy * dt;
          p.r += p.vr * dt;
          repel(p, 120, 60);
          if (p.y < -20) Object.assign(p, this.make(false), { x: Math.random() * w });
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.scale(1, Math.cos(p.t * 1.3 + p.z * 6));
          ctx.globalAlpha = p.a * A;
          ctx.fillStyle = p.c === 0 ? '#f4efe4' : '#9b8e7c';
          ctx.fillRect(-p.s / 2, -p.s * 0.35, p.s, p.s * 0.7);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'leaves': {
        const gust = 0.7 + 0.6 * Math.max(0, Math.sin(now / 2600)) + 0.25 * Math.sin(now / 900);
        for (const p of this.items) {
          p.t += dt;
          p.x += p.vx * gust * dt;
          p.y += (p.vy + Math.sin(p.t * 1.7 + p.z * 5) * 30) * dt;
          p.r += p.vr * gust * dt;
          repel(p, 130, 140);
          if (p.x > w + 40 || p.y > h + 40) Object.assign(p, this.make(false));
          const spr = leafSprite(LEAVES[p.c]);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.scale(Math.cos(p.t * (1.5 + p.z * 2) + p.z * 9), 1);
          ctx.globalAlpha = p.a * A;
          ctx.drawImage(spr, -p.s / 2, -p.s / 2, p.s, p.s);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'neonrain': {
        ctx.lineCap = 'round';
        for (const p of this.items) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y > h + 40 || p.x < -60) Object.assign(p, this.make(false), { x: Math.random() * (w + 120) });
          const k = p.s / p.vy;
          ctx.strokeStyle = p.c === 0 ? `rgba(200, 210, 240, ${(p.a + flash * 0.3) * A})` : `${NEON[p.c - 1]}${Math.min(1, p.a * 1.6 + flash * 0.3) * A})`;
          ctx.lineWidth = 0.6 + p.z * 0.9;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k);
          ctx.stroke();
        }
        break;
      }
      case 'spores': {
        ctx.globalCompositeOperation = 'lighter';
        const cyan = glowSprite('rgba(130, 240, 255, 1)');
        const green = glowSprite('rgba(160, 255, 170, 1)');
        for (const p of this.items) {
          p.t += dt;
          p.x += (p.vx + Math.sin(p.t * 0.5 + p.z * 7) * 6) * dt;
          p.y += p.vy * dt;
          repel(p, 120, 50);
          if (p.y < -20) Object.assign(p, this.make(false), { x: Math.random() * w });
          ctx.globalAlpha = p.a * A * (0.5 + 0.5 * Math.sin(p.t * 1.6 + p.z * 13));
          ctx.drawImage(p.c ? green : cyan, p.x - p.s * 2, p.y - p.s * 2, p.s * 4, p.s * 4);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        this.drawMeteor(ctx, dt, A, w, h);
        break;
      }
      default:
        break;
    }
  }

  private drawMeteor(ctx: CanvasRenderingContext2D, dt: number, A: number, w: number, h: number) {
    this.nextMeteor -= dt;
    if (!this.meteor && this.nextMeteor <= 0) {
      this.meteor = { x: w * (0.2 + Math.random() * 0.7), y: h * (0.05 + Math.random() * 0.25), vx: -(500 + Math.random() * 400), vy: 160 + Math.random() * 140, life: 1 };
      this.nextMeteor = 8 + Math.random() * 14;
    }
    const m = this.meteor;
    if (!m) return;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.life -= dt * 1.1;
    const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.18, m.y - m.vy * 0.18);
    g.addColorStop(0, `rgba(230, 245, 255, ${0.9 * A * Math.max(0, m.life)})`);
    g.addColorStop(1, 'rgba(230, 245, 255, 0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x - m.vx * 0.18, m.y - m.vy * 0.18);
    ctx.stroke();
    if (m.life <= 0) this.meteor = null;
  }

  private drawBirds(ctx: CanvasRenderingContext2D, dt: number, A: number) {
    this.nextBirds -= dt;
    if (!this.birds && this.nextBirds <= 0) {
      this.birds = { x: -60, y: this.h * (0.18 + Math.random() * 0.25), v: 60 + Math.random() * 40, n: 5 + Math.floor(Math.random() * 5), t: 0 };
      this.nextBirds = 25 + Math.random() * 35;
    }
    const b = this.birds;
    if (!b) return;
    b.t += dt;
    b.x += b.v * dt;
    ctx.strokeStyle = `rgba(20, 40, 70, ${0.55 * A})`;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < b.n; i++) {
      const bx = b.x - Math.abs(i - b.n / 2) * 18 - i * 6;
      const by = b.y + Math.abs(i - b.n / 2) * 9 + Math.sin(b.t * 2 + i) * 3;
      const flap = Math.sin(b.t * 9 + i * 1.3) * 4;
      ctx.beginPath();
      ctx.moveTo(bx - 7, by - flap);
      ctx.quadraticCurveTo(bx - 3, by - 2, bx, by);
      ctx.quadraticCurveTo(bx + 3, by - 2, bx + 7, by - flap);
      ctx.stroke();
    }
    if (b.x > this.w + 200) this.birds = null;
  }
}
