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
        // warm wind and a lonely guitar somewhere far off
        const bp = filt('bandpass', 420, 0.7);
        const g = noiseThrough(this.pink, [bp], 0.24);
        lfo(bp.frequency, 0.04, 180);
        lfo(g.gain, 0.06, 0.1);
        const pluck = (n: number, t: number, peak: number) => {
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = midi(n);
          const lp = filt('lowpass', 2600, 1.2);
          lp.frequency.setValueAtTime(2600, t);
          lp.frequency.exponentialRampToValueAtTime(380, t + 1.4);
          const gg = c.createGain();
          this.env(gg.gain, t, 0.004, peak, 2.2);
          o.connect(lp);
          lp.connect(gg);
          gg.connect(out);
          gg.connect(this.wet);
          o.start(t);
          o.stop(t + 2.6);
        };
        const scale = [52, 55, 57, 59, 62, 64, 67];
        every(7000, 14000, () => {
          const t = c.currentTime;
          const start = Math.floor(Math.random() * 3);
          const len = 2 + Math.floor(Math.random() * 3);
          for (let k = 0; k < len; k++) pluck(scale[(start + k * 2) % scale.length], t + k * 0.42, 0.03);
        });
        break;
      }
      case 'keep': {
        // mountain wind and a distant horn
        const bp = filt('bandpass', 520, 3);
        noiseThrough(this.pink, [bp], 0.3);
        noiseThrough(this.brown, [filt('lowpass', 220)], 0.18);
        lfo(bp.frequency, 0.05, 240);
        every(16000, 28000, () => {
          const t = c.currentTime;
          for (const n of [43, 50]) {
            const o = c.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(midi(n) * 0.985, t);
            o.frequency.linearRampToValueAtTime(midi(n), t + 0.6);
            const lp = filt('lowpass', 700, 0.8);
            const gg = c.createGain();
            gg.gain.setValueAtTime(0, t);
            gg.gain.linearRampToValueAtTime(0.022, t + 1.2);
            gg.gain.linearRampToValueAtTime(0.0, t + 4.5);
            o.connect(lp);
            lp.connect(gg);
            gg.connect(this.wet);
            gg.connect(out);
            o.start(t);
            o.stop(t + 4.8);
          }
        });
        break;
      }
      case 'arcane': {
        // a soft pad and a music box drifting through a minor waltz
        const { g } = pad([40, 47, 52, 55], 'triangle', 0.016, 1100);
        lfo(g.gain, 0.05, 0.008);
        noiseThrough(this.pink, [filt('bandpass', 4200, 2)], 0.012);
        const tune = [76, 79, 83, 81, 79, 76, 78, 79, 81, 78, 74, 76];
        let i = 0;
        every(560, 560, () => {
          if (i % 24 >= 12) {
            i++;
            return;
          }
          const t = c.currentTime;
          const n = tune[i % tune.length];
          this.tone(midi(n), t, 1.6, 0.016, 'sine', out, 0.003, Math.sin(i) * 0.5);
          this.tone(midi(n) * 3, t, 0.6, 0.003, 'sine', this.wet, 0.002);
          i++;
        });
        break;
      }
      case 'garden': {
        // a stream, a breeze and a few plucked notes in the in scale
        noiseThrough(this.white, [filt('bandpass', 2400, 0.9)], 0.035);
        const bp = filt('bandpass', 700, 0.6);
        noiseThrough(this.pink, [bp], 0.12);
        lfo(bp.frequency, 0.05, 250);
        every(80, 260, () => drop(1800, 5200, 0.012 + Math.random() * 0.02, 0.008));
        const scale = [62, 63, 67, 69, 70, 74, 75, 79];
        every(3500, 8000, () => {
          const t = c.currentTime;
          const n = scale[Math.floor(Math.random() * scale.length)];
          const o = c.createOscillator();
          o.type = 'triangle';
          o.frequency.setValueAtTime(midi(n) * 1.01, t);
          o.frequency.exponentialRampToValueAtTime(midi(n), t + 0.08);
          const gg = c.createGain();
          this.env(gg.gain, t, 0.002, 0.03, 2.4);
          o.connect(gg);
          gg.connect(out);
          gg.connect(this.wet);
          o.start(t);
          o.stop(t + 2.8);
          if (Math.random() < 0.4) this.tone(midi(n + 12), t + 0.3, 1.8, 0.008, 'sine', this.wet, 0.002);
        });
        break;
      }
      case 'surf': {
        const lp = filt('lowpass', 900);
        const wave = noiseThrough(this.brown, [lp], 0.3);
        const hiss = noiseThrough(this.pink, [filt('highpass', 2200)], 0.04);
        noiseThrough(this.pink, [filt('bandpass', 600, 0.5)], 0.05);
        every(6000, 9000, () => {
          const t = c.currentTime;
          const peak = 0.35 + Math.random() * 0.3;
          wave.gain.cancelScheduledValues(t);
          wave.gain.setValueAtTime(wave.gain.value, t);
          wave.gain.linearRampToValueAtTime(peak, t + 2.4);
          wave.gain.linearRampToValueAtTime(0.12, t + 6.5);
          hiss.gain.cancelScheduledValues(t);
          hiss.gain.setValueAtTime(hiss.gain.value, t);
          hiss.gain.linearRampToValueAtTime(0.11 * peak + 0.03, t + 3.0);
          hiss.gain.linearRampToValueAtTime(0.02, t + 6.5);
        });
        every(14000, 30000, () => {
          // a gull, far off
          const t = c.currentTime;
          const calls = 2 + Math.floor(Math.random() * 2);
          for (let k = 0; k < calls; k++) {
            const o = c.createOscillator();
            o.type = 'triangle';
            const t0 = t + k * 0.32;
            o.frequency.setValueAtTime(1500, t0);
            o.frequency.exponentialRampToValueAtTime(900, t0 + 0.25);
            const gg = c.createGain();
            this.env(gg.gain, t0, 0.02, 0.008, 0.28);
            o.connect(gg);
            gg.connect(this.wet);
            o.start(t0);
            o.stop(t0 + 0.4);
          }
        });
        break;
      }
      case 'woods': {
        // wind in the branches, crickets, an owl now and then
        const bp = filt('bandpass', 380, 0.8);
        const wind = noiseThrough(this.pink, [bp], 0.16);
        lfo(bp.frequency, 0.03, 140);
        lfo(wind.gain, 0.04, 0.08);
        const cr = keep(c.createOscillator());
        cr.frequency.value = 4300;
        const am = c.createGain();
        am.gain.value = 0;
        const amOsc = keep(c.createOscillator());
        amOsc.type = 'square';
        amOsc.frequency.value = 18;
        const amDepth = gain(0.004);
        amOsc.connect(amDepth);
        amDepth.connect(am.gain);
        amOsc.start();
        cr.connect(am);
        am.connect(out);
        cr.start();
        every(9000, 20000, () => {
          const t = c.currentTime;
          [0, 0.45, 0.65].forEach((d, k) => {
            const o = c.createOscillator();
            o.type = 'sine';
            o.frequency.setValueAtTime(k === 0 ? 410 : 380, t + d);
            o.frequency.linearRampToValueAtTime(k === 0 ? 380 : 350, t + d + 0.25);
            const gg = c.createGain();
            this.env(gg.gain, t + d, 0.04, 0.02, 0.3);
            o.connect(gg);
            gg.connect(this.wet);
            gg.connect(out);
            o.start(t + d);
            o.stop(t + d + 0.45);
          });
        });
        every(6000, 15000, () => drop(180, 420, 0.03, 0.12));
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
