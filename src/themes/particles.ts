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

const POP = ['#ff2e88', '#00e5ff', '#ffe600', '#6b2bff', '#ffffff'];

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
      petals: 70,
      fireflies: 46,
      candles: 26,
      drift: 120,
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
      case 'petals':
        p.vx = 18 + Math.random() * 36;
        p.vy = 22 + Math.random() * 34;
        p.s = 4 + z * 8;
        p.a = 0.55 + z * 0.4;
        p.r = Math.random() * Math.PI * 2;
        p.vr = (Math.random() - 0.5) * 2.2;
        p.c = Math.floor(Math.random() * 3);
        if (!initial) {
          p.y = -20;
          p.x = Math.random() * (w + 200) - 200;
        }
        break;
      case 'fireflies':
        p.vx = -8 + Math.random() * 16;
        p.vy = -6 + Math.random() * 12;
        p.s = 1.6 + z * 3;
        p.a = 0.6 + z * 0.4;
        p.y = h * (0.35 + Math.random() * 0.62);
        break;
      case 'candles':
        p.vx = 0;
        p.vy = -2 - Math.random() * 4;
        p.s = 0.5 + z * 0.9;
        p.a = 0.55 + z * 0.45;
        p.y = h * (0.04 + Math.random() * 0.5);
        break;
      case 'drift':
        p.vx = 14 + z * 40;
        p.vy = -3 + Math.random() * 6;
        p.s = 0.8 + z * 2;
        p.a = 0.15 + z * 0.45;
        break;
      default:
        break;
    }
    return p;
  }

  private tumble: { x: number; y: number; r: number; s: number; v: number; t: number } | null = null;
  private nextTumble = 6 + Math.random() * 10;

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
      case 'petals': {
        const cols = ['#ffd3e2', '#ffb7cf', '#fff0f5'];
        for (const p of this.items) {
          p.t += dt;
          p.x += (p.vx + Math.sin(p.t * 0.9 + p.z * 6) * 22) * dt;
          p.y += (p.vy + Math.cos(p.t * 1.3 + p.z * 4) * 10) * dt;
          p.r += p.vr * dt;
          repel(p, 140, 120);
          if (p.y > h + 20 || p.x > w + 30) Object.assign(p, this.make(false));
          const flip = Math.abs(Math.sin(p.t * 2.1 + p.z * 9));
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.scale(1, 0.35 + flip * 0.65);
          ctx.globalAlpha = p.a * A;
          ctx.fillStyle = cols[p.c];
          ctx.beginPath();
          ctx.moveTo(0, -p.s);
          ctx.quadraticCurveTo(p.s * 0.9, -p.s * 0.2, 0, p.s);
          ctx.quadraticCurveTo(-p.s * 0.9, -p.s * 0.2, 0, -p.s);
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'fireflies': {
        ctx.globalCompositeOperation = 'lighter';
        const spr = glowSprite('rgba(214, 255, 140, 1)');
        for (const p of this.items) {
          p.t += dt;
          p.x += (p.vx + Math.sin(p.t * 0.8 + p.z * 11) * 14) * dt;
          p.y += (p.vy + Math.cos(p.t * 0.6 + p.z * 7) * 10) * dt;
          repel(p, 120, -30);
          if (p.x < -20) p.x = w + 10;
          if (p.x > w + 20) p.x = -10;
          if (p.y < h * 0.25) p.vy = Math.abs(p.vy);
          if (p.y > h + 10) p.vy = -Math.abs(p.vy);
          const blink = Math.max(0, Math.sin(p.t * (0.9 + p.z * 0.8) + p.z * 40));
          ctx.globalAlpha = p.a * A * blink * blink;
          ctx.drawImage(spr, p.x - p.s * 3, p.y - p.s * 3, p.s * 6, p.s * 6);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'candles': {
        const glow = glowSprite('rgba(255, 196, 110, 1)');
        for (const p of this.items) {
          p.t += dt;
          p.y += (p.vy * 0.2 + Math.sin(p.t * 0.7 + p.z * 9) * 3) * dt;
          p.x += Math.sin(p.t * 0.33 + p.z * 5) * 2 * dt;
          if (p.y < -30) Object.assign(p, this.make(false), { y: h * 0.55 });
          const k = p.s;
          const cw = 5 * k;
          const ch = 22 * k;
          ctx.globalAlpha = p.a * A * 0.9;
          const g = ctx.createLinearGradient(p.x - cw / 2, 0, p.x + cw / 2, 0);
          g.addColorStop(0, '#b9ad94');
          g.addColorStop(0.45, '#fff6e2');
          g.addColorStop(1, '#8d826d');
          ctx.fillStyle = g;
          ctx.fillRect(p.x - cw / 2, p.y, cw, ch);
          const fl = 0.8 + 0.2 * Math.sin(p.t * 12 + p.z * 30);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = p.a * A * fl;
          ctx.drawImage(glow, p.x - 14 * k, p.y - 20 * k, 28 * k, 28 * k);
          ctx.fillStyle = '#fff2c8';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 4 * k, 1.8 * k, 4.2 * k * fl, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'drift': {
        ctx.fillStyle = '#ffd9a8';
        for (const p of this.items) {
          p.t += dt;
          p.x += p.vx * dt;
          p.y += (p.vy + Math.sin(p.t * 0.9 + p.z * 5) * 6) * dt;
          repel(p, 110, 60);
          if (p.x > w + 6) p.x = -4;
          if (p.y < -5) p.y = h + 4;
          if (p.y > h + 5) p.y = -4;
          ctx.globalAlpha = p.a * A;
          ctx.fillRect(p.x, p.y, p.s, p.s);
        }
        ctx.globalAlpha = 1;
        this.nextTumble -= dt;
        if (!this.tumble && this.nextTumble <= 0) {
          const s = 16 + Math.random() * 22;
          this.tumble = { x: -60, y: h * (0.86 + Math.random() * 0.1), r: 0, s, v: 90 + Math.random() * 80, t: 0 };
          this.nextTumble = 18 + Math.random() * 25;
        }
        const tb = this.tumble;
        if (tb) {
          tb.t += dt;
          tb.x += tb.v * dt;
          tb.r += (tb.v / tb.s) * dt;
          const bounce = Math.abs(Math.sin(tb.t * 3.2)) * tb.s * 0.9;
          ctx.save();
          ctx.translate(tb.x, tb.y - bounce);
          ctx.rotate(tb.r);
          ctx.globalAlpha = 0.75 * A;
          ctx.strokeStyle = '#3b2312';
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 9; i++) {
            const a = i * 0.7;
            ctx.beginPath();
            ctx.ellipse(0, 0, tb.s, tb.s * (0.4 + (i % 3) * 0.2), a, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
          ctx.globalAlpha = 1;
          if (tb.x > w + 80) this.tumble = null;
        }
        break;
      }
      default:
        break;
    }
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
