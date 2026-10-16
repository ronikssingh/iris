/* Every sound in Iris is synthesised live with the Web Audio API; there are no audio files. */
import type { AmbienceId } from '../themes/themes';
import type { ClassKey } from '../shared/model';

export interface SoundPrefs {
  enabled: boolean;
  volume: number;
  intro: boolean;
  ui: boolean;
  ambience: boolean;
  ambienceVolume: number;
}

interface AmbienceHandle {
  id: AmbienceId;
  out: GainNode;
  stop: () => void;
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class SoundEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private wet!: GainNode;
  private reverb!: ConvolverNode;
  private comp!: DynamicsCompressorNode;
  private white!: AudioBuffer;
  private pink!: AudioBuffer;
  private brown!: AudioBuffer;
  private prefs: SoundPrefs = { enabled: true, volume: 0.7, intro: true, ui: true, ambience: true, ambienceVolume: 0.35 };
  private current: AmbienceHandle | null = null;
  private wantAmbience: AmbienceId | null = null;
  private lastDial = 0;
  private lastHover = 0;
  private focusLevel = 1;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
    } catch {
      this.ctx = null;
      return;
    }
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 4;
    this.master = c.createGain();
    this.sfx = c.createGain();
    this.amb = c.createGain();
    this.wet = c.createGain();
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(3.2, 2.6);
    this.wet.gain.value = 0.32;
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.wet.connect(this.reverb);
    this.reverb.connect(this.master);
    this.master.connect(this.comp);
    this.comp.connect(c.destination);
    this.white = this.noise('white', 4);
    this.pink = this.noise('pink', 6);
    this.brown = this.noise('brown', 6);
    this.applyLevels(0);
  }

  get ready() {
    return !!this.ctx;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setPrefs(p: SoundPrefs) {
    const ambWas = this.prefs.enabled && this.prefs.ambience;
    this.prefs = { ...p };
    this.applyLevels(0.3);
    const ambNow = p.enabled && p.ambience;
    if (ambNow && !ambWas && this.wantAmbience) this.setAmbience(this.wantAmbience, 2);
    if (!ambNow && ambWas) this.stopAmbience(1.2);
  }

  /** Lower the ambience while Iris is in the background. */
  setFocus(level: number) {
    this.focusLevel = level;
    this.applyLevels(1.5);
  }

  private applyLevels(ramp: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const on = this.prefs.enabled ? 1 : 0;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on * this.prefs.volume, t, ramp / 3 + 0.001);
    this.sfx.gain.setTargetAtTime(this.prefs.ui ? 1 : 0, t, 0.05);
    this.amb.gain.setTargetAtTime(this.prefs.ambience ? this.prefs.ambienceVolume * this.focusLevel : 0, t, ramp / 3 + 0.001);
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const c = this.ctx!;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 300 ? i / 300 : 1);
      }
    }
    return buf;
  }

  private noise(kind: 'white' | 'pink' | 'brown', seconds: number): AudioBuffer {
    const c = this.ctx!;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w * 0.5;
        else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.2;
        }
      }
      // fade the loop seam
      const f = Math.min(2000, len / 10);
      for (let i = 0; i < f; i++) {
        const k = i / f;
        d[i] = d[i] * k + d[len - f + i] * (1 - k);
      }
    }
    return buf;
  }

  private src(buf: AudioBuffer, loop = true, offset = Math.random() * 2) {
    const s = this.ctx!.createBufferSource();
    s.buffer = buf;
    s.loop = loop;
    s.start(this.ctx!.currentTime, offset % buf.duration);
    return s;
  }

  private env(g: AudioParam, t: number, a: number, peak: number, d: number) {
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + a);
    g.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private tone(freq: number, t: number, dur: number, peak: number, type: OscillatorType = 'sine', dest?: AudioNode, attack = 0.005, pan = 0) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    this.env(g.gain, t, attack, peak, dur);
    let node: AudioNode = g;
    if (pan) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    }
    o.connect(g);
    node.connect(dest ?? this.sfx);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return { o, g };
  }

  private burst(t: number, dur: number, peak: number, filter: BiquadFilterType, freq: number, q = 1, dest?: AudioNode, buf?: AudioBuffer, pan = 0) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = buf ?? this.white;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    this.env(g.gain, t, 0.002, peak, dur);
    s.connect(f);
    f.connect(g);
    let node: AudioNode = g;
    if (pan) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    }
    node.connect(dest ?? this.sfx);
    s.start(t, Math.random() * 2);
    s.stop(t + dur + 0.1);
    return { s, f, g };
  }

  private canPlay(kind: 'ui' | 'intro' | 'any' = 'ui') {
    if (!this.ctx || !this.prefs.enabled) return false;
    if (kind === 'ui' && !this.prefs.ui) return false;
    if (kind === 'intro' && !this.prefs.intro) return false;
    return true;
  }

  /* ---------------------------------------------------------- UI sounds */

  hover() {
    if (!this.canPlay()) return;
    const now = performance.now();
    if (now - this.lastHover < 60) return;
    this.lastHover = now;
    const t = this.ctx!.currentTime;
    this.tone(2400 + Math.random() * 300, t, 0.025, 0.012);
  }

  click() {
    if (!this.canPlay()) return;
    const t = this.ctx!.currentTime;
    this.burst(t, 0.03, 0.12, 'highpass', 2500, 0.7);
    this.tone(180, t, 0.06, 0.08, 'sine');
  }

  whoosh(dir = 0) {
    if (!this.canPlay()) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const { f, g } = this.burst(t, 0.55, 0.16, 'bandpass', 400, 1.2, undefined, this.pink, dir * 0.5);
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.22);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.55);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  }

  shutter(strength = 1) {
    if (!this.canPlay('any')) return;
    const t = this.ctx!.currentTime;
    this.burst(t, 0.012, 0.32 * strength, 'highpass', 3200, 0.8);
    this.burst(t + 0.018, 0.02, 0.18 * strength, 'bandpass', 1800, 4);
    this.tone(3100 + Math.random() * 200, t, 0.05, 0.03 * strength);
    this.tone(95, t, 0.05, 0.08 * strength);
  }

  dial(value: number) {
    if (!this.canPlay()) return;
    const now = performance.now();
    if (now - this.lastDial < 22) return;
    this.lastDial = now;
    const t = this.ctx!.currentTime;
    const major = value % 10 === 0;
    this.burst(t, major ? 0.02 : 0.008, major ? 0.16 : 0.07, 'bandpass', major ? 2200 : 4200, 6);
    if (value === 100) this.tone(1567.98, t, 0.4, 0.05, 'sine', this.wet);
  }

  toggle(on: boolean) {
    if (!this.canPlay()) return;
    const t = this.ctx!.currentTime;
    this.tone(on ? 880 : 660, t, 0.07, 0.05, 'triangle');
    this.tone(on ? 1320 : 495, t + 0.05, 0.09, 0.04, 'triangle');
  }

  confirm() {
    if (!this.canPlay()) return;
    const t = this.ctx!.currentTime;
    this.tone(midi(76), t, 0.18, 0.06, 'sine');
    this.tone(midi(83), t + 0.07, 0.3, 0.05, 'sine', this.wet);
  }

  error() {
    if (!this.canPlay()) return;
    const t = this.ctx!.currentTime;
    this.tone(midi(55), t, 0.14, 0.07, 'triangle');
    this.tone(midi(51), t + 0.11, 0.22, 0.07, 'triangle');
  }

  remove() {
    if (!this.canPlay()) return;
    const t = this.ctx!.currentTime;
    const { o } = this.tone(220, t, 0.25, 0.1, 'sine');
    o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
    this.burst(t, 0.08, 0.08, 'lowpass', 600);
  }

  /** The "verdict" sound when a critique is saved. Better classes get grander chords. */
  verdict(cls: ClassKey) {
    if (!this.canPlay()) return;
    const t = this.ctx!.currentTime + 0.02;
    const grand = cls === 'masterpiece' || cls === 'perfect';
    const chords: Record<ClassKey, number[]> = {
      masterpiece: [60, 64, 67, 71, 74, 79],
      perfect: [62, 66, 69, 73, 78],
      great: [60, 64, 67, 72],
      good: [60, 64, 67],
      average: [60, 63, 67],
      below: [57, 60, 64],
      terrible: [50, 53, 56],
    };
    chords[cls].forEach((n, i) => {
      const f = midi(n);
      this.tone(f, t + i * 0.07, 1.6, 0.05, 'sine', this.wet, 0.006);
      this.tone(f * 2, t + i * 0.07, 0.8, 0.012, 'sine', this.sfx, 0.004);
    });
    if (grand) {
      const c = this.ctx!;
      const g = c.createGain();
      g.connect(this.wet);
      g.connect(this.sfx);
      this.env(g.gain, t, 0.4, 0.08, 2.4);
      [36, 43, 48].forEach((n) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(200, t);
        lp.frequency.linearRampToValueAtTime(1600, t + 0.6);
        lp.frequency.exponentialRampToValueAtTime(300, t + 2.6);
        o.connect(lp);
        lp.connect(g);
        o.start(t);
        o.stop(t + 3);
      });
      for (let i = 0; i < 14; i++) this.tone(midi(84 + [0, 4, 7, 11, 12, 16][i % 6]), t + 0.5 + i * 0.06 + Math.random() * 0.05, 0.6, 0.012, 'sine', this.wet, 0.002, Math.random() * 1.6 - 0.8);
    }
    if (cls === 'terrible') this.remove();
  }

  thunder(delay: number, intensity: number) {
    if (!this.ctx || !this.prefs.enabled || !this.prefs.ambience) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.brown;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380 + intensity * 200;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.6 * intensity, t + 0.08 + delay * 0.05);
    for (let i = 1; i < 6; i++) g.gain.linearRampToValueAtTime((0.25 + Math.random() * 0.45) * intensity, t + i * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.8);
    s.connect(lp);
    lp.connect(g);
    g.connect(this.amb);
    g.connect(this.wet);
    s.start(t, Math.random() * 3);
    s.stop(t + 5);
    if (delay < 0.8) this.burst(t, 0.25, 0.25 * intensity, 'highpass', 1500, 0.5, this.amb);
  }

  /** A crack of electricity: a snap, a stutter of sparks and a short buzz. */
  zap(intensity: number) {
    if (!this.ctx || !this.prefs.enabled || !this.prefs.ambience) return;
    const c = this.ctx;
    const t = c.currentTime + 0.02;
    const pan = Math.random() * 1.4 - 0.7;
    this.burst(t, 0.06, 0.32 * intensity, 'highpass', 2600, 0.6, this.amb, this.white, pan);
    const n = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) this.burst(t + 0.02 + Math.random() * 0.18, 0.006 + Math.random() * 0.01, (0.08 + Math.random() * 0.14) * intensity, 'bandpass', 2500 + Math.random() * 5000, 2, this.amb, this.white, pan);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.3);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 1.2;
    const g = c.createGain();
    this.env(g.gain, t, 0.004, 0.07 * intensity, 0.32);
    o.connect(bp);
    bp.connect(g);
    g.connect(this.amb);
    g.connect(this.wet);
    o.start(t);
    o.stop(t + 0.4);
  }

  /* -------------------------------------------------------------- Intro */

  /** The opening: aperture clicks, a rising swell, then a deep cinematic hit at the reveal. */
  introHit(t0Offset = 0) {
    if (!this.canPlay('intro')) return;
    const c = this.ctx!;
    const t = c.currentTime + t0Offset;
    // sub drop
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(92, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 1.5);
    const og = c.createGain();
    this.env(og.gain, t, 0.01, 0.55, 2.4);
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    o.connect(shaper);
    shaper.connect(og);
    og.connect(this.master);
    o.start(t);
    o.stop(t + 2.6);
    // brassy wall
    const wall = c.createGain();
    this.env(wall.gain, t, 0.04, 0.16, 3.2);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.linearRampToValueAtTime(1900, t + 0.25);
    lp.frequency.exponentialRampToValueAtTime(260, t + 3);
    lp.connect(wall);
    wall.connect(this.master);
    wall.connect(this.wet);
    [33, 40, 45, 52].forEach((n, i) => {
      for (const det of [-7, 6]) {
        const s = c.createOscillator();
        s.type = 'sawtooth';
        s.frequency.value = midi(n);
        s.detune.value = det + i;
        s.connect(lp);
        s.start(t);
        s.stop(t + 3.4);
      }
    });
    // air and shimmer
    this.burst(t, 1.6, 0.18, 'lowpass', 900, 0.7, this.wet, this.pink);
    [81, 88, 93, 100].forEach((n, i) => this.tone(midi(n), t + 0.15 + i * 0.12, 3.2, 0.02, 'sine', this.wet, 0.6, (i % 2 ? 1 : -1) * 0.4));
  }

  introRiser(duration: number) {
    if (!this.canPlay('intro')) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.pink;
    s.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(200, t);
    bp.frequency.exponentialRampToValueAtTime(5200, t + duration);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + duration);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.08);
    s.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    s.start(t);
    s.stop(t + duration + 0.2);
    // low hum underneath
    const hum = c.createOscillator();
    hum.frequency.value = 55;
    const hg = c.createGain();
    hg.gain.setValueAtTime(0.0001, t);
    hg.gain.linearRampToValueAtTime(0.06, t + duration * 0.8);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.1);
    hum.connect(hg);
    hg.connect(this.master);
    hum.start(t);
    hum.stop(t + duration + 0.2);
  }

  /* ---------------------------------------------------------- Ambience */

  setAmbience(id: AmbienceId, fade = 2.5) {
    this.wantAmbience = id;
    if (!this.ctx || !this.prefs.enabled || !this.prefs.ambience) return;
    if (this.current?.id === id) return;
    this.stopAmbience(fade);
    const out = this.ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.amb);
    const stop = this.build(id, out);
    out.gain.setTargetAtTime(1, this.ctx.currentTime, fade / 3);
    this.current = { id, out, stop };
  }

  stopAmbience(fade = 2) {
    const cur = this.current;
    if (!cur || !this.ctx) return;
    this.current = null;
    const t = this.ctx.currentTime;
    cur.out.gain.cancelScheduledValues(t);
    cur.out.gain.setTargetAtTime(0.0001, t, fade / 3);
    setTimeout(() => {
      cur.stop();
      try {
        cur.out.disconnect();
      } catch {
        /* already gone */
      }
    }, fade * 1000 + 400);
  }

  private build(id: AmbienceId, out: GainNode): () => void {
    const c = this.ctx!;
    const nodes: AudioScheduledSourceNode[] = [];
    const timers: number[] = [];
    const keep = <T extends AudioScheduledSourceNode>(n: T) => {
      nodes.push(n);
      return n;
    };
    const filt = (type: BiquadFilterType, f: number, q = 0.7) => {
      const n = c.createBiquadFilter();
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      return n;
    };
    const gain = (v: number) => {
      const g = c.createGain();
      g.gain.value = v;
      return g;
    };
    const lfo = (target: AudioParam, rate: number, depth: number, type: OscillatorType = 'sine') => {
      const o = keep(c.createOscillator());
      o.type = type;
      o.frequency.value = rate;
      const g = gain(depth);
      o.connect(g);
      g.connect(target);
      o.start();
    };
    const noiseThrough = (buf: AudioBuffer, chain: AudioNode[], level: number) => {
      const s = keep(this.src(buf));
      let prev: AudioNode = s;
      for (const n of chain) {
        prev.connect(n);
        prev = n;
      }
      const g = gain(level);
      prev.connect(g);
      g.connect(out);
      return g;
    };
    const every = (minMs: number, maxMs: number, fn: () => void) => {
      const loop = () => {
        fn();
        timers.push(window.setTimeout(loop, minMs + Math.random() * (maxMs - minMs)));
      };
      timers.push(window.setTimeout(loop, minMs * Math.random()));
    };
    const pad = (notes: number[], type: OscillatorType, level: number, cutoff: number, dest: AudioNode = out) => {
      const g = gain(level);
      const lp = filt('lowpass', cutoff, 0.5);
      lp.connect(g);
      g.connect(dest);
      g.connect(this.wet);
      for (const n of notes) {
        for (const det of [-5, 5]) {
          const o = keep(c.createOscillator());
          o.type = type;
          o.frequency.value = midi(n);
          o.detune.value = det;
          o.connect(lp);
          o.start();
        }
      }
      return { g, lp };
    };
    const drop = (freqLo: number, freqHi: number, level: number, dur = 0.01) => {
      const t = c.currentTime;
      this.burst(t, dur, level, 'bandpass', freqLo + Math.random() * (freqHi - freqLo), 3, out, this.white, Math.random() * 1.6 - 0.8);
    };
    const panner = (v: number) => {
      const p = c.createStereoPanner();
      p.pan.value = v;
      p.connect(out);
      return p;
    };
    /** a pitch sweep with a soft envelope: birds, hawks, sirens */
    const sweep = (f0: number, f1: number, t: number, dur: number, level: number, pan = 0, type: OscillatorType = 'sine', vib = 0) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      if (vib) {
        const v = c.createOscillator();
        v.frequency.value = vib;
        const vg = gain(f0 * 0.02);
        v.connect(vg);
        vg.connect(o.frequency);
        v.start(t);
        v.stop(t + dur + 0.1);
      }
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + Math.min(0.05, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(panner(pan));
      g.connect(this.wet);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    /** a plucked string: a bright saw closing down through a low-pass */
    const pluck = (note: number, t: number, level: number, pan = 0, decay = 1.6) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(note);
      const lp = filt('lowpass', 3200, 1.5);
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(380, t + 0.35);
      const g = c.createGain();
      this.env(g.gain, t, 0.003, level, decay);
      o.connect(lp);
      lp.connect(g);
      g.connect(panner(pan));
      g.connect(this.wet);
      o.start(t);
      o.stop(t + decay + 0.1);
    };
    /** a struck bell or gong: a few inharmonic partials ringing down */
    const bell = (freq: number, t: number, level: number, decay: number, pan = 0) => {
      [
        [1, 1],
        [2.76, 0.45],
        [5.4, 0.22],
        [8.93, 0.1],
      ].forEach(([k, a]) => this.tone(freq * k, t, decay / Math.sqrt(k), level * a, 'sine', panner(pan), 0.004));
      this.tone(freq, t, decay, level * 0.6, 'sine', this.wet, 0.004);
    };
    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
    /** a cricket: a few quick chirps */
    const cricket = (level: number) => {
      const t = c.currentTime;
      const f = 4200 + Math.random() * 900;
      const pan = Math.random() * 1.6 - 0.8;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.tone(f, t + i * 0.055, 0.03, level, 'sine', panner(pan), 0.004);
    };

    switch (id) {
      case 'rain': {
        noiseThrough(this.pink, [filt('highpass', 450), filt('lowpass', 7000)], 0.42);
        noiseThrough(this.brown, [filt('lowpass', 300)], 0.18);
        every(25, 70, () => drop(2200, 6000, 0.03 + Math.random() * 0.04));
        every(400, 1400, () => drop(600, 1400, 0.05, 0.03));
        break;
      }
      case 'breeze': {
        const bp = filt('bandpass', 650, 0.6);
        const g = noiseThrough(this.pink, [bp], 0.28);
        lfo(bp.frequency, 0.07, 280);
        lfo(g.gain, 0.05, 0.12);
        const { g: pg } = pad([60, 67, 76, 72], 'sine', 0.018, 1800);
        lfo(pg.gain, 0.04, 0.008);
        every(5000, 11000, () => {
          const t = c.currentTime;
          const n = [72, 76, 79, 84, 86][Math.floor(Math.random() * 5)];
          this.tone(midi(n), t, 2.2, 0.012, 'sine', out, 0.4, Math.random() - 0.5);
        });
        break;
      }
      case 'desert': {
        const bp = filt('bandpass', 380, 0.8);
        const g = noiseThrough(this.brown, [bp], 0.5);
        noiseThrough(this.pink, [filt('bandpass', 1400, 0.5)], 0.06);
        lfo(bp.frequency, 0.05, 160);
        every(3000, 7000, () => {
          const t = c.currentTime;
          g.gain.cancelScheduledValues(t);
          g.gain.setTargetAtTime(0.3 + Math.random() * 0.55, t, 1.2);
        });
        // throat-sung drone
        const src = keep(c.createOscillator());
        src.type = 'sawtooth';
        src.frequency.value = midi(36);
        const f1 = filt('bandpass', 700, 9);
        const f2 = filt('bandpass', 1150, 11);
        const dg = gain(0.05);
        src.connect(f1);
        src.connect(f2);
        f1.connect(dg);
        f2.connect(dg);
        dg.connect(out);
        dg.connect(this.wet);
        lfo(f1.frequency, 0.03, 160);
        lfo(f2.frequency, 0.045, 260);
        src.start();
        break;
      }
      case 'city-pop': {
        noiseThrough(this.pink, [filt('highpass', 2000), filt('lowpass', 9000)], 0.03);
        every(40, 220, () => drop(1500, 7000, 0.02 + Math.random() * 0.05, 0.004));
        const beat = 60 / 86;
        let i = 0;
        every(beat * 1000, beat * 1000, () => {
          const t = c.currentTime;
          const o = c.createOscillator();
          o.frequency.setValueAtTime(110, t);
          o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
          const g = c.createGain();
          this.env(g.gain, t, 0.004, i % 2 === 0 ? 0.22 : 0.12, 0.3);
          o.connect(g);
          g.connect(out);
          o.start(t);
          o.stop(t + 0.4);
          if (i % 2 === 1) this.burst(t, 0.06, 0.05, 'highpass', 3000, 0.6, out);
          if (Math.random() < 0.18) {
            const n = [69, 72, 74, 76, 79, 81][Math.floor(Math.random() * 6)];
            this.tone(midi(n), t + beat / 2, 0.22, 0.018, 'square', out, 0.004, Math.random() - 0.5);
          }
          i++;
        });
        break;
      }
      case 'sea': {
        const lp = filt('lowpass', 700);
        const wave = noiseThrough(this.brown, [lp], 0.45);
        const hiss = noiseThrough(this.pink, [filt('highpass', 1800)], 0.05);
        noiseThrough(this.pink, [filt('bandpass', 500, 0.6)], 0.08);
        every(5500, 9500, () => {
          const t = c.currentTime;
          const peak = 0.5 + Math.random() * 0.5;
          wave.gain.cancelScheduledValues(t);
          wave.gain.setValueAtTime(wave.gain.value, t);
          wave.gain.linearRampToValueAtTime(peak, t + 2.2);
          wave.gain.linearRampToValueAtTime(0.18, t + 6);
          hiss.gain.cancelScheduledValues(t);
          hiss.gain.setValueAtTime(hiss.gain.value, t);
          hiss.gain.linearRampToValueAtTime(0.14 * peak, t + 2.6);
          hiss.gain.linearRampToValueAtTime(0.03, t + 6);
          lp.frequency.setTargetAtTime(500 + peak * 700, t, 1.4);
        });
        break;
      }
      case 'blizzard': {
        const bp = filt('bandpass', 600, 4);
        const bp2 = filt('bandpass', 900, 6);
        noiseThrough(this.pink, [bp], 0.35);
        noiseThrough(this.white, [bp2], 0.05);
        noiseThrough(this.brown, [filt('lowpass', 250)], 0.2);
        lfo(bp.frequency, 0.06, 260);
        lfo(bp2.frequency, 0.09, 380);
        every(3000, 8000, () => {
          const t = c.currentTime;
          const n = [84, 86, 88, 91, 93, 96][Math.floor(Math.random() * 6)];
          this.tone(midi(n), t, 2.6, 0.015, 'sine', out, 0.002, Math.random() * 1.4 - 0.7);
          this.tone(midi(n) * 2.01, t, 1.4, 0.006, 'sine', this.wet, 0.002);
        });
        break;
      }
      case 'void': {
        const { g } = pad([33, 45, 52, 57, 61], 'triangle', 0.035, 900);
        lfo(g.gain, 0.03, 0.018);
        noiseThrough(this.brown, [filt('lowpass', 90)], 0.25);
        every(9000, 16000, () => {
          const t = c.currentTime;
          [69, 76, 81].forEach((n, i) => this.tone(midi(n), t + i * 0.6, 4.5, 0.01, 'sine', this.wet, 1.4));
        });
        break;
      }
      case 'synth': {
        const { lp } = pad([45, 52, 55, 60], 'sawtooth', 0.02, 900);
        lfo(lp.frequency, 0.05, 500);
        const delay = c.createDelay(1);
        delay.delayTime.value = 0.375;
        const fb = gain(0.38);
        delay.connect(fb);
        fb.connect(delay);
        const dout = gain(0.6);
        delay.connect(dout);
        dout.connect(out);
        const seq = [69, 72, 76, 79, 76, 72];
        let step = 0;
        every(375 * 2, 375 * 2, () => {
          const t = c.currentTime;
          const n = seq[step++ % seq.length];
          const { g } = this.tone(midi(n), t, 0.35, 0.02, 'triangle', out, 0.004);
          g.connect(delay);
        });
        noiseThrough(this.pink, [filt('bandpass', 250, 0.4)], 0.04);
        break;
      }
      case 'projector': {
        noiseThrough(this.pink, [filt('highpass', 3000)], 0.02);
        const hum = keep(c.createOscillator());
        hum.frequency.value = 60;
        const hg = gain(0.02);
        hum.connect(hg);
        hg.connect(out);
        hum.start();
        every(41, 43, () => drop(900, 1600, 0.035 + Math.random() * 0.015, 0.006));
        break;
      }
      case 'hearth': {
        const lp = filt('lowpass', 520);
        const roar = noiseThrough(this.brown, [lp], 0.4);
        noiseThrough(this.pink, [filt('bandpass', 700, 0.5)], 0.04);
        lfo(roar.gain, 0.21, 0.12);
        every(60, 400, () => {
          const n = Math.random() < 0.3 ? 3 : 1;
          for (let k = 0; k < n; k++) setTimeout(() => drop(1200, 4200, 0.04 + Math.random() * 0.08, 0.005), k * 25);
        });
        break;
      }
      case 'prairie': {
        // warm evening wind, crickets in the grass, a hawk far off, a slow guitar
        const bp = filt('bandpass', 520, 0.7);
        const wind = noiseThrough(this.pink, [bp], 0.26);
        lfo(bp.frequency, 0.06, 220);
        lfo(wind.gain, 0.045, 0.1);
        noiseThrough(this.brown, [filt('lowpass', 180)], 0.12);
        every(700, 2600, () => cricket(0.010 + Math.random() * 0.008));
        every(18000, 34000, () => {
          const t = c.currentTime;
          const pan = Math.random() * 1.2 - 0.6;
          sweep(2400, 1500, t, 1.1, 0.014, pan, 'sine', 9);
          if (Math.random() < 0.5) sweep(2300, 1400, t + 1.4, 0.9, 0.010, pan, 'sine', 9);
        });
        const scale = [52, 55, 57, 59, 62, 64, 67];
        every(4200, 9000, () => {
          const t = c.currentTime;
          const n = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) pluck(pick(scale), t + i * 0.42, 0.028, Math.random() * 0.8 - 0.4, 2.2);
        });
        break;
      }
      case 'lake': {
        // water lapping at the boats, a breath of wind, an owl, faraway bells over the water
        const lp = filt('lowpass', 420);
        const lap = noiseThrough(this.brown, [lp], 0.3);
        every(1400, 3200, () => {
          const t = c.currentTime;
          lap.gain.cancelScheduledValues(t);
          lap.gain.setValueAtTime(lap.gain.value, t);
          lap.gain.linearRampToValueAtTime(0.2 + Math.random() * 0.3, t + 0.5);
          lap.gain.linearRampToValueAtTime(0.12, t + 1.4);
          if (Math.random() < 0.5) drop(500, 1100, 0.025, 0.04);
        });
        const wb = filt('bandpass', 700, 0.5);
        noiseThrough(this.pink, [wb], 0.06);
        lfo(wb.frequency, 0.04, 200);
        every(16000, 30000, () => {
          const t = c.currentTime;
          const pan = Math.random() * 1.4 - 0.7;
          sweep(410, 380, t, 0.5, 0.03, pan);
          sweep(400, 370, t + 0.65, 0.7, 0.026, pan);
        });
        const notes = [79, 83, 86, 88, 91, 95];
        every(6000, 13000, () => {
          const t = c.currentTime;
          const n = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) bell(midi(pick(notes)), t + i * 0.5, 0.006, 3.5, Math.random() * 1.2 - 0.6);
        });
        break;
      }
      case 'tide': {
        // a calm sea breathing, the ship's timbers creaking, wind in the rigging, the bell now and then
        const lp = filt('lowpass', 520);
        const swell = noiseThrough(this.brown, [lp], 0.32);
        const hiss = noiseThrough(this.pink, [filt('highpass', 2000)], 0.025);
        every(8000, 12000, () => {
          const t = c.currentTime;
          const peak = 0.35 + Math.random() * 0.3;
          swell.gain.cancelScheduledValues(t);
          swell.gain.setValueAtTime(swell.gain.value, t);
          swell.gain.linearRampToValueAtTime(peak, t + 3.5);
          swell.gain.linearRampToValueAtTime(0.16, t + 8);
          hiss.gain.cancelScheduledValues(t);
          hiss.gain.setValueAtTime(hiss.gain.value, t);
          hiss.gain.linearRampToValueAtTime(0.06 * peak, t + 3.8);
          hiss.gain.linearRampToValueAtTime(0.015, t + 8);
        });
        const rig = filt('bandpass', 1250, 9);
        const rg = noiseThrough(this.pink, [rig], 0.035);
        lfo(rig.frequency, 0.07, 180);
        lfo(rg.gain, 0.05, 0.025);
        every(6000, 14000, () => {
          const t = c.currentTime;
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(130 + Math.random() * 40, t);
          o.frequency.exponentialRampToValueAtTime(85 + Math.random() * 20, t + 0.6);
          const bp = filt('bandpass', 700, 3);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.02, t + 0.12);
          g.gain.linearRampToValueAtTime(0.012, t + 0.4);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
          const am = c.createOscillator();
          am.frequency.value = 23;
          const amg = gain(0.008);
          am.connect(amg);
          amg.connect(g.gain);
          o.connect(bp);
          bp.connect(g);
          g.connect(panner(Math.random() * 1.2 - 0.6));
          o.start(t);
          am.start(t);
          o.stop(t + 0.8);
          am.stop(t + 0.8);
        });
        every(40000, 70000, () => bell(midi(79), c.currentTime, 0.012, 4.5, 0.3));
        break;
      }
      case 'swamp': {
        // cicadas buzzing in the heat haze, crickets, frogs, a crow, and once in a long while a train far away
        const cb = filt('bandpass', 5600, 3);
        const cic = noiseThrough(this.white, [cb], 0.05);
        lfo(cic.gain, 24, 0.035, 'square');
        lfo(cb.frequency, 0.05, 500);
        const swellG = gain(1);
        cic.disconnect();
        cic.connect(swellG);
        swellG.connect(out);
        lfo(swellG.gain, 0.03, 0.6);
        every(900, 2400, () => cricket(0.008 + Math.random() * 0.006));
        every(2500, 7000, () => {
          const t = c.currentTime;
          const pan = Math.random() * 1.6 - 0.8;
          const n = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            const o = c.createOscillator();
            o.type = 'square';
            o.frequency.value = 150 + Math.random() * 60;
            const bp = filt('bandpass', 420, 4);
            const g = c.createGain();
            this.env(g.gain, t + i * 0.16, 0.01, 0.022, 0.09);
            o.connect(bp);
            bp.connect(g);
            g.connect(panner(pan));
            o.start(t + i * 0.16);
            o.stop(t + i * 0.16 + 0.15);
          }
        });
        every(20000, 45000, () => {
          const t = c.currentTime;
          const pan = Math.random() * 1.6 - 0.8;
          const n = 2 + Math.floor(Math.random() * 2);
          for (let i = 0; i < n; i++) sweep(720, 520, t + i * 0.42, 0.28, 0.02, pan, 'sawtooth');
        });
        every(90000, 160000, () => {
          const t = c.currentTime;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.03, t + 0.6);
          g.gain.setValueAtTime(0.03, t + 2.2);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
          const lp = filt('lowpass', 900);
          lp.connect(g);
          g.connect(out);
          g.connect(this.wet);
          [57, 61, 64].forEach((n) => {
            const o = c.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(midi(n), t);
            o.frequency.linearRampToValueAtTime(midi(n) * 0.985, t + 3.6);
            o.connect(lp);
            o.start(t);
            o.stop(t + 3.7);
          });
        });
        break;
      }
      case 'surge': {
        // a deep rumble of speed, the air tearing past, electricity crackling at the edges
        noiseThrough(this.brown, [filt('lowpass', 130)], 0.42);
        const throb = keep(c.createOscillator());
        throb.frequency.value = 41;
        const tg = gain(0.05);
        throb.connect(tg);
        tg.connect(out);
        throb.start();
        lfo(tg.gain, 1.7, 0.03);
        const bp = filt('bandpass', 900, 0.8);
        const rush = noiseThrough(this.pink, [bp], 0.16);
        lfo(bp.frequency, 0.11, 500);
        lfo(rush.gain, 0.07, 0.07);
        every(120, 900, () => {
          if (Math.random() < 0.5) return;
          const k = 1 + Math.floor(Math.random() * 4);
          for (let i = 0; i < k; i++) setTimeout(() => drop(3000, 9000, 0.02 + Math.random() * 0.04, 0.004), i * 18);
        });
        every(3500, 8000, () => {
          const t = c.currentTime;
          const { f, g } = this.burst(t, 1.2, 0.12, 'bandpass', 300, 1.4, out, this.pink, Math.random() * 1.6 - 0.8);
          f.frequency.setValueAtTime(260, t);
          f.frequency.exponentialRampToValueAtTime(2600, t + 0.6);
          f.frequency.exponentialRampToValueAtTime(400, t + 1.2);
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.1, t + 0.5);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
        });
        break;
      }
      case 'grove': {
        // a stream talking over stones, crickets, water dripping into stone basins, a temple bell far off
        for (const [f, q, lvl] of [
          [600, 3, 0.07],
          [1100, 4, 0.05],
          [2200, 5, 0.03],
        ]) {
          const bp = filt('bandpass', f, q);
          noiseThrough(this.pink, [bp], lvl);
          lfo(bp.frequency, 3 + Math.random() * 4, f * 0.25, 'sawtooth');
        }
        noiseThrough(this.brown, [filt('lowpass', 300)], 0.12);
        every(1200, 3500, () => cricket(0.006 + Math.random() * 0.005));
        const drips = [72, 74, 76, 79, 81, 84];
        every(2500, 6500, () => {
          const t = c.currentTime;
          const o = c.createOscillator();
          const f = midi(pick(drips));
          o.frequency.setValueAtTime(f * 0.9, t);
          o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
          const g = c.createGain();
          this.env(g.gain, t, 0.002, 0.016, 0.5);
          o.connect(g);
          g.connect(panner(Math.random() * 1.4 - 0.7));
          g.connect(this.wet);
          o.start(t);
          o.stop(t + 0.6);
        });
        every(35000, 60000, () => bell(midi(43), c.currentTime, 0.02, 9, -0.2));
        break;
      }
      case 'dream': {
        // a low drone under a murmuring city, slow piano, and the great horn as the streets fold
        const { lp } = pad([36, 43, 48], 'sawtooth', 0.016, 400);
        lfo(lp.frequency, 0.03, 160);
        noiseThrough(this.pink, [filt('bandpass', 320, 0.6)], 0.05);
        const motif = [57, 60, 64, 62];
        every(9000, 16000, () => {
          const t = c.currentTime;
          motif.forEach((n, i) => this.tone(midi(n), t + i * 0.9, 2.6, 0.016, 'triangle', panner(0), 0.01));
        });
        every(32000, 52000, () => {
          const t = c.currentTime;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.06, t + 0.7);
          g.gain.setValueAtTime(0.06, t + 2.6);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
          const f = filt('lowpass', 200, 2);
          f.frequency.setValueAtTime(160, t);
          f.frequency.linearRampToValueAtTime(900, t + 0.9);
          f.frequency.exponentialRampToValueAtTime(220, t + 5);
          f.connect(g);
          g.connect(out);
          g.connect(this.wet);
          [24, 31, 36].forEach((n, i) => {
            for (const det of [-9, 8]) {
              const o = c.createOscillator();
              o.type = 'sawtooth';
              o.frequency.value = midi(n);
              o.detune.value = det + i * 3;
              o.connect(f);
              o.start(t);
              o.stop(t + 5.6);
            }
          });
        });
        break;
      }
      case 'meadow': {
        // wind running through tall grass in long gusts, birds, and a music box remembering something
        const bp = filt('bandpass', 950, 0.6);
        const grass = noiseThrough(this.pink, [bp], 0.2);
        const hi = noiseThrough(this.pink, [filt('highpass', 3500)], 0.03);
        every(3500, 7500, () => {
          const t = c.currentTime;
          const peak = 0.2 + Math.random() * 0.25;
          for (const [g, k] of [
            [grass, 1],
            [hi, 0.2],
          ] as const) {
            g.gain.cancelScheduledValues(t);
            g.gain.setValueAtTime(g.gain.value, t);
            g.gain.linearRampToValueAtTime(peak * k, t + 1.6);
            g.gain.linearRampToValueAtTime(0.1 * k, t + 4.5);
          }
          bp.frequency.setTargetAtTime(700 + peak * 1200, t, 1);
        });
        every(2500, 8000, () => {
          const t = c.currentTime;
          const pan = Math.random() * 1.6 - 0.8;
          const n = 3 + Math.floor(Math.random() * 5);
          let tt = t;
          for (let i = 0; i < n; i++) {
            const f0 = 2600 + Math.random() * 2400;
            sweep(f0, f0 * (0.7 + Math.random() * 0.6), tt, 0.06 + Math.random() * 0.08, 0.008, pan);
            tt += 0.09 + Math.random() * 0.1;
          }
        });
        const box = [72, 74, 76, 79, 81, 84, 86];
        every(9000, 18000, () => {
          const t = c.currentTime;
          const n = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            const f = midi(pick(box));
            this.tone(f, t + i * 0.6, 2.4, 0.010, 'sine', out, 0.003, Math.random() * 0.6 - 0.3);
            this.tone(f * 3, t + i * 0.6, 0.6, 0.002, 'sine', this.wet, 0.002);
          }
        });
        break;
      }
      case 'metropolis': {
        // rain on the city, the low hum of it, traffic hissing past, a siren a long way off, a dark synth
        noiseThrough(this.pink, [filt('highpass', 500), filt('lowpass', 6500)], 0.24);
        every(40, 110, () => drop(2400, 6500, 0.015 + Math.random() * 0.025));
        noiseThrough(this.brown, [filt('lowpass', 140)], 0.22);
        const { lp } = pad([41, 48, 53, 56], 'sawtooth', 0.012, 700);
        lfo(lp.frequency, 0.04, 380);
        every(3000, 8000, () => {
          const t = c.currentTime;
          const dir = Math.random() < 0.5 ? -1 : 1;
          const s2 = c.createBufferSource();
          s2.buffer = this.pink;
          const bp = filt('bandpass', 700, 0.9);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.08, t + 1.1);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
          const pn = c.createStereoPanner();
          pn.pan.setValueAtTime(-0.8 * dir, t);
          pn.pan.linearRampToValueAtTime(0.8 * dir, t + 2.6);
          s2.connect(bp);
          bp.connect(g);
          g.connect(pn);
          pn.connect(out);
          s2.start(t, Math.random() * 3);
          s2.stop(t + 2.7);
        });
        every(30000, 60000, () => {
          const t = c.currentTime;
          const o = c.createOscillator();
          o.frequency.value = 760;
          const v = c.createOscillator();
          v.frequency.value = 0.45;
          const vg = gain(170);
          v.connect(vg);
          vg.connect(o.frequency);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.008, t + 2);
          g.gain.linearRampToValueAtTime(0.0001, t + 7);
          const lpf = filt('lowpass', 1400);
          o.connect(lpf);
          lpf.connect(g);
          g.connect(panner(Math.random() * 1.4 - 0.7));
          g.connect(this.wet);
          o.start(t);
          v.start(t);
          o.stop(t + 7.1);
          v.stop(t + 7.1);
        });
        break;
      }
      case 'falls': {
        // the roar of waterfalls far below, a choir in the air, chimes like starlight
        noiseThrough(this.brown, [filt('lowpass', 700)], 0.32);
        const fb = filt('bandpass', 1300, 0.5);
        const fg = noiseThrough(this.pink, [fb], 0.06);
        lfo(fg.gain, 0.06, 0.02);
        const choir = gain(0.014);
        const f1 = filt('bandpass', 720, 5);
        const f2 = filt('bandpass', 1180, 6);
        f1.connect(choir);
        f2.connect(choir);
        choir.connect(out);
        choir.connect(this.wet);
        for (const n of [45, 52, 57, 61, 64]) {
          for (const det of [-6, 7]) {
            const o = keep(c.createOscillator());
            o.type = 'sawtooth';
            o.frequency.value = midi(n);
            o.detune.value = det;
            o.connect(f1);
            o.connect(f2);
            o.start();
          }
        }
        lfo(choir.gain, 0.025, 0.008);
        lfo(f1.frequency, 0.02, 90);
        every(7000, 15000, () => {
          const t = c.currentTime;
          const notes = [81, 85, 88, 92, 93, 97];
          for (let i = 0; i < 3; i++) this.tone(midi(pick(notes)), t + i * 0.35 + Math.random() * 0.1, 3.6, 0.007, 'sine', this.wet, 0.004, Math.random() * 1.4 - 0.7);
        });
        break;
      }
    }
    return () => {
      timers.forEach((t) => clearTimeout(t));
      nodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      });
    };
  }
}

export const sound = new SoundEngine();
