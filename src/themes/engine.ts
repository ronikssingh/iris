/* WebGL2 renderer for the living backgrounds. One full-screen triangle per frame, two plus a blend during transitions. */
import type { ThemeId } from '../shared/settings';
import { sceneSource, TRANSITION_FRAG, VERT } from './glsl';

interface Prog {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

export interface StageQuality {
  scale: number; // render resolution relative to device pixels
  fps: number;
  timeScale: number;
}

interface FlashEvent {
  t0: number;
  strength: number;
  pulses: number[];
}

const SCENE_UNIFORMS = ['uRes', 'uTime', 'uMouse', 'uFlash', 'uFlashPos', 'uVig'];
const TRANS_UNIFORMS = ['uA', 'uB', 'uP', 'uStyle', 'uRes', 'uTime', 'uOrigin'];

export class StageEngine {
  private gl: WebGL2RenderingContext;
  private progs = new Map<ThemeId, Prog>();
  private failed = new Set<ThemeId>();
  private trans: Prog | null = null;
  private targets: [Target, Target] | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private raf = 0;
  private lastFrame = 0;
  private lastTick = 0;
  private time = Math.random() * 40;
  private mouse = [0, 0];
  private mouseTarget = [0, 0];
  private flashes: FlashEvent[] = [];
  private flashPos = [0.5, 0.7];
  private running = false;
  private focused = true;
  private destroyed = false;

  current: ThemeId;
  private next: ThemeId | null = null;
  private tStart = 0;
  private tDur = 1800;
  private style = 0;
  private origin: [number, number] = [0.5, 0.5];
  private onMidpoint: (() => void) | null = null;
  private midFired = false;
  private onDone: (() => void) | null = null;
  vignette: Record<string, number> = {};
  quality: StageQuality = { scale: 0.6, fps: 60, timeScale: 1 };
  onFrame: ((dt: number, t: number) => void) | null = null;
  onError: ((msg: string) => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    initial: ThemeId,
  ) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.current = initial;
    this.vao = gl.createVertexArray();
    canvas.addEventListener('webglcontextlost', this.onLost, false);
    canvas.addEventListener('webglcontextrestored', this.onRestored, false);
    this.resize();
    this.program(initial);
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.stop();
  };

  private onRestored = () => {
    this.progs.clear();
    this.trans = null;
    this.targets = null;
    this.vao = this.gl.createVertexArray();
    this.resize();
    this.start();
  };

  private compile(fragSrc: string, uniforms: string[]): Prog {
    const gl = this.gl;
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s) || 'unknown error';
        gl.deleteShader(s);
        throw new Error(log);
      }
      return s;
    };
    const vs = mk(gl.VERTEX_SHADER, VERT);
    const fs = mk(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) || 'link failed';
      throw new Error(log);
    }
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniforms) u[name] = gl.getUniformLocation(prog, name);
    return { prog, u };
  }

  private program(id: ThemeId): Prog | null {
    if (this.failed.has(id)) return null;
    let p = this.progs.get(id);
    if (!p) {
      try {
        p = this.compile(sceneSource(id), SCENE_UNIFORMS);
        this.progs.set(id, p);
      } catch (e: any) {
        this.failed.add(id);
        this.onError?.(`${id}: ${e?.message || e}`);
        return null;
      }
    }
    return p;
  }

  /** Compiles the other themes in idle time so the first switch to each one doesn't stutter. */
  warmUp(ids: ThemeId[]) {
    const queue = ids.filter((i) => !this.progs.has(i));
    const step = () => {
      if (this.destroyed || !queue.length) return;
      const id = queue.shift()!;
      this.program(id);
      const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: any) => void) | undefined;
      if (ric) ric(step, { timeout: 1200 });
      else setTimeout(step, 120);
    };
    setTimeout(step, 1500);
  }

  private ensureTargets() {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (this.targets && this.targets[0].w === w && this.targets[0].h === h) return;
    if (this.targets) {
      for (const t of this.targets) {
        gl.deleteFramebuffer(t.fb);
        gl.deleteTexture(t.tex);
      }
    }
    const mk = (): Target => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fb, tex, w, h };
    };
    this.targets = [mk(), mk()];
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(64, Math.round(window.innerWidth * dpr * this.quality.scale));
    const h = Math.max(64, Math.round(window.innerHeight * dpr * this.quality.scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  setQuality(q: StageQuality) {
    this.quality = q;
    this.resize();
  }

  setMouse(x: number, y: number) {
    this.mouseTarget[0] = x;
    this.mouseTarget[1] = y;
  }

  setFocused(f: boolean) {
    this.focused = f;
  }

  /** A lightning strike or glitch burst: a quick sequence of pulses. */
  flash(strength = 1, pos?: [number, number]) {
    const now = performance.now();
    const n = Math.random() < 0.55 ? 2 : Math.random() < 0.5 ? 3 : 1;
    const pulses = [0];
    for (let i = 1; i < n; i++) pulses.push(pulses[i - 1] + 70 + Math.random() * 160);
    this.flashes.push({ t0: now, strength, pulses });
    this.flashPos = pos ?? [0.15 + Math.random() * 0.7, 0.55 + Math.random() * 0.35];
  }

  private flashValue(now: number): number {
    let v = 0;
    this.flashes = this.flashes.filter((f) => now - f.t0 < 1600);
    for (const f of this.flashes) {
      for (const off of f.pulses) {
        const dt = now - f.t0 - off;
        if (dt < 0) continue;
        v += f.strength * Math.exp(-dt / 90) * (dt < 25 ? dt / 25 : 1);
      }
    }
    return Math.min(1.4, v);
  }

  /** Starts a cinematic switch to another world. `onMidpoint` fires halfway, when the UI colours should change. */
  transitionTo(
    id: ThemeId,
    style: number,
    opts: { duration?: number; origin?: [number, number]; onMidpoint?: () => void; onDone?: () => void } = {},
  ) {
    if (id === this.current && !this.next) {
      opts.onMidpoint?.();
      opts.onDone?.();
      return;
    }
    if (this.next) {
      // finish the running transition instantly before starting the next one
      this.current = this.next;
      this.next = null;
      if (!this.midFired) this.onMidpoint?.();
      this.onDone?.();
    }
    this.program(id);
    if (!this.trans) {
      try {
        this.trans = this.compile(TRANSITION_FRAG, TRANS_UNIFORMS);
      } catch (e: any) {
        this.onError?.('transition: ' + (e?.message || e));
      }
    }
    if (!this.trans || this.failed.has(id) || this.failed.has(this.current)) {
      this.current = id;
      opts.onMidpoint?.();
      opts.onDone?.();
      return;
    }
    this.next = id;
    this.style = style;
    this.tStart = performance.now();
    this.tDur = opts.duration ?? 1900;
    this.origin = opts.origin ?? [0.5, 0.5];
    this.onMidpoint = opts.onMidpoint ?? null;
    this.onDone = opts.onDone ?? null;
    this.midFired = false;
  }

  get transitioning() {
    return this.next !== null;
  }

  private drawScene(p: Prog, w: number, h: number, theme: ThemeId, flash: number) {
    const gl = this.gl;
    gl.useProgram(p.prog);
    gl.uniform2f(p.u.uRes, w, h);
    gl.uniform1f(p.u.uTime, this.time);
    gl.uniform2f(p.u.uMouse, this.mouse[0], this.mouse[1]);
    gl.uniform1f(p.u.uFlash, flash);
    gl.uniform2f(p.u.uFlashPos, this.flashPos[0], this.flashPos[1]);
    gl.uniform1f(p.u.uVig, (this.vignette[theme] ?? 0.4) * 0.55);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const fps = this.focused ? this.quality.fps : Math.min(this.quality.fps, 20);
    if (now - this.lastFrame < 1000 / fps - 2) return;
    const dt = Math.min(0.1, (now - (this.lastTick || now)) / 1000);
    this.lastFrame = now;
    this.lastTick = now;
    this.time += dt * this.quality.timeScale;
    const k = 1 - Math.pow(0.0025, dt);
    this.mouse[0] += (this.mouseTarget[0] - this.mouse[0]) * k;
    this.mouse[1] += (this.mouseTarget[1] - this.mouse[1]) * k;
    this.onFrame?.(dt, this.time);
    this.render(now);
  };

  render(now = performance.now()) {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    this.resize();
    const w = this.canvas.width;
    const h = this.canvas.height;
    const flash = this.flashValue(now);
    gl.bindVertexArray(this.vao);
    const cur = this.program(this.current);
    if (this.next && this.trans) {
      const nxt = this.program(this.next);
      const p = Math.min(1, (now - this.tStart) / this.tDur);
      if (!this.midFired && p >= 0.5) {
        this.midFired = true;
        this.onMidpoint?.();
      }
      if (cur && nxt) {
        this.ensureTargets();
        const [ta, tb] = this.targets!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, ta.fb);
        gl.viewport(0, 0, w, h);
        this.drawScene(cur, w, h, this.current, flash);
        gl.bindFramebuffer(gl.FRAMEBUFFER, tb.fb);
        this.drawScene(nxt, w, h, this.next, flash);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        const t = this.trans;
        gl.useProgram(t.prog);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, ta.tex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tb.tex);
        gl.uniform1i(t.u.uA, 0);
        gl.uniform1i(t.u.uB, 1);
        const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        gl.uniform1f(t.u.uP, eased);
        gl.uniform1i(t.u.uStyle, this.style);
        gl.uniform2f(t.u.uRes, w, h);
        gl.uniform1f(t.u.uTime, this.time);
        gl.uniform2f(t.u.uOrigin, this.origin[0], this.origin[1]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      if (p >= 1) {
        this.current = this.next;
        this.next = null;
        const done = this.onDone;
        this.onDone = null;
        this.onMidpoint = null;
        done?.();
      }
      return;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    if (cur) this.drawScene(cur, w, h, this.current, flash);
  }

  start() {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.lastTick = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
  }
}
