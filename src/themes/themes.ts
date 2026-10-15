import type { ThemeId } from '../shared/settings';

export type ParticleKind =
  | 'rain'
  | 'motes'
  | 'sand'
  | 'confetti'
  | 'spray'
  | 'snow'
  | 'meteors'
  | 'none'
  | 'dust'
  | 'embers';

export type TransitionStyle =
  | 'lightning'
  | 'sunrise'
  | 'sandstorm'
  | 'glitch'
  | 'wave'
  | 'frost'
  | 'warp'
  | 'scan'
  | 'burn'
  | 'ember';

export const TRANSITION_INDEX: Record<TransitionStyle, number> = {
  lightning: 0,
  sunrise: 1,
  sandstorm: 2,
  glitch: 3,
  wave: 4,
  frost: 5,
  warp: 6,
  scan: 7,
  burn: 8,
  ember: 9,
};

export type AmbienceId =
  | 'rain'
  | 'breeze'
  | 'desert'
  | 'city-pop'
  | 'sea'
  | 'blizzard'
  | 'void'
  | 'synth'
  | 'projector'
  | 'hearth';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  mood: string;
  inspiredBy: string;
  dark: boolean;
  font: {
    family: string;
    weight: number;
    tracking: string;
    upper: boolean;
    scale: number; // optical size correction for wide or condensed faces
    settings?: string; // font-variation-settings
  };
  c: {
    bg: string;
    ink: string;
    ink2: string;
    ink3: string;
    accent: string;
    accentInk: string;
    accent2: string;
    glass: string;
    glassHi: string;
    line: string;
    glow: string;
    shade: string; // dark scrim colour behind text over imagery
  };
  ui: {
    radius: number;
    blur: number;
    grain: number;
    vignette: number;
    panel: 'glass' | 'comic' | 'deco' | 'neon';
  };
  particles: ParticleKind;
  ambience: AmbienceId;
  entrance: TransitionStyle;
  storms?: boolean; // occasional lightning with thunder
  glitches?: boolean;
  preview: [string, string, string]; // gradient stops for the picker swatch
}

export const THEMES: ThemeDef[] = [
  {
    id: 'vigil',
    name: 'Vigil',
    mood: 'Rain-slick rooftops, sodium-red light, a storm rolling in.',
    inspiredBy: 'dark and moody, like The Batman',
    dark: true,
    font: { family: "'Big Shoulders Display Variable', 'Big Shoulders Display', sans-serif", weight: 800, tracking: '0.01em', upper: true, scale: 1.08 },
    c: {
      bg: '#05070b',
      ink: '#e6e9ee',
      ink2: '#a3acb9',
      ink3: '#6b7380',
      accent: '#e2412c',
      accentInk: '#fff4f0',
      accent2: '#f2a33a',
      glass: 'rgba(12, 15, 22, 0.62)',
      glassHi: 'rgba(18, 22, 32, 0.84)',
      line: 'rgba(160, 175, 195, 0.16)',
      glow: '#ff4a2e',
      shade: 'rgba(3, 4, 7, 0.78)',
    },
    ui: { radius: 10, blur: 22, grain: 0.07, vignette: 0.55, panel: 'glass' },
    particles: 'rain',
    ambience: 'rain',
    entrance: 'lightning',
    storms: true,
    preview: ['#05070b', '#3a1610', '#e2412c'],
  },
  {
    id: 'skyward',
    name: 'Skyward',
    mood: 'Open skies, golden sunlight, the feeling that anything is possible.',
    inspiredBy: 'sunny and hopeful, like Superman',
    dark: false,
    font: { family: "'Archivo Variable', 'Archivo', sans-serif", weight: 820, tracking: '-0.015em', upper: false, scale: 1, settings: "'wdth' 125" },
    c: {
      bg: '#9fd3ff',
      ink: '#0d2140',
      ink2: '#2f4b75',
      ink3: '#566f95',
      accent: '#d7263d',
      accentInk: '#ffffff',
      accent2: '#f5b700',
      glass: 'rgba(255, 255, 255, 0.52)',
      glassHi: 'rgba(255, 255, 255, 0.8)',
      line: 'rgba(13, 33, 64, 0.13)',
      glow: '#ffd25e',
      shade: 'rgba(8, 24, 52, 0.62)',
    },
    ui: { radius: 18, blur: 26, grain: 0.025, vignette: 0.12, panel: 'glass' },
    particles: 'motes',
    ambience: 'breeze',
    entrance: 'sunrise',
    preview: ['#2f7fe8', '#9fd3ff', '#ffd25e'],
  },
  {
    id: 'mirage',
    name: 'Mirage',
    mood: 'An endless desert, a burning sun, sand on the wind.',
    inspiredBy: 'warm and dramatic, like Dune',
    dark: true,
    font: { family: "'Michroma', sans-serif", weight: 400, tracking: '0.06em', upper: true, scale: 0.78 },
    c: {
      bg: '#2a160c',
      ink: '#fff1e0',
      ink2: '#e7c9a5',
      ink3: '#b08c69',
      accent: '#e8742a',
      accentInk: '#1f0e05',
      accent2: '#f6c177',
      glass: 'rgba(38, 18, 8, 0.5)',
      glassHi: 'rgba(46, 23, 11, 0.78)',
      line: 'rgba(255, 214, 170, 0.17)',
      glow: '#ff9a4a',
      shade: 'rgba(24, 10, 3, 0.72)',
    },
    ui: { radius: 4, blur: 20, grain: 0.06, vignette: 0.4, panel: 'glass' },
    particles: 'sand',
    ambience: 'desert',
    entrance: 'sandstorm',
    preview: ['#5c2410', '#e07a35', '#ffd29a'],
  },
  {
    id: 'glitchpop',
    name: 'Glitch Pop',
    mood: 'Halftone skies, spray-paint neon, a city glitching between worlds.',
    inspiredBy: 'bright and colourful, like Across the Spider-Verse',
    dark: true,
    font: { family: "'Bungee', sans-serif", weight: 400, tracking: '0.01em', upper: true, scale: 0.92 },
    c: {
      bg: '#12082a',
      ink: '#ffffff',
      ink2: '#ded6ff',
      ink3: '#ab9fe6',
      accent: '#ff2e88',
      accentInk: '#ffffff',
      accent2: '#00e5ff',
      glass: 'rgba(16, 7, 38, 0.8)',
      glassHi: 'rgba(24, 10, 54, 0.92)',
      line: 'rgba(255, 255, 255, 0.85)',
      glow: '#ff2e88',
      shade: 'rgba(10, 4, 26, 0.78)',
    },
    ui: { radius: 6, blur: 6, grain: 0.05, vignette: 0.2, panel: 'comic' },
    particles: 'confetti',
    ambience: 'city-pop',
    entrance: 'glitch',
    glitches: true,
    preview: ['#ff2e88', '#6b2bff', '#00e5ff'],
  },
  {
    id: 'winedark',
    name: 'Wine-Dark Sea',
    mood: 'Bronze and storm on the wine-dark sea, a long way from home.',
    inspiredBy: 'epic and intense, like The Odyssey',
    dark: true,
    font: { family: "'Cinzel Variable', 'Cinzel', serif", weight: 640, tracking: '0.05em', upper: false, scale: 0.98 },
    c: {
      bg: '#06141c',
      ink: '#eef2ee',
      ink2: '#b9c7c4',
      ink3: '#7f938f',
      accent: '#c9963f',
      accentInk: '#160d04',
      accent2: '#b23a48',
      glass: 'rgba(5, 20, 28, 0.58)',
      glassHi: 'rgba(7, 26, 36, 0.82)',
      line: 'rgba(201, 150, 63, 0.24)',
      glow: '#e9b95a',
      shade: 'rgba(2, 10, 14, 0.74)',
    },
    ui: { radius: 8, blur: 22, grain: 0.05, vignette: 0.5, panel: 'glass' },
    particles: 'spray',
    ambience: 'sea',
    entrance: 'wave',
    storms: true,
    preview: ['#06141c', '#3d1622', '#c9963f'],
  },
  {
    id: 'fimbulwinter',
    name: 'Fimbulwinter',
    mood: 'The endless winter: aurora light over frozen peaks.',
    inspiredBy: 'cold and mythic, like God of War Ragnarök',
    dark: true,
    font: { family: "'Grenze Gotisch Variable', 'Grenze Gotisch', serif", weight: 620, tracking: '0.02em', upper: false, scale: 1.08 },
    c: {
      bg: '#040a14',
      ink: '#eaf6ff',
      ink2: '#a9c6dc',
      ink3: '#6c8aa3',
      accent: '#6fe3c1',
      accentInk: '#04140f',
      accent2: '#9d8cff',
      glass: 'rgba(7, 16, 30, 0.56)',
      glassHi: 'rgba(9, 22, 40, 0.82)',
      line: 'rgba(150, 210, 255, 0.18)',
      glow: '#7ff5d2',
      shade: 'rgba(2, 6, 12, 0.72)',
    },
    ui: { radius: 12, blur: 24, grain: 0.04, vignette: 0.42, panel: 'glass' },
    particles: 'snow',
    ambience: 'blizzard',
    entrance: 'frost',
    preview: ['#040a14', '#1c5b63', '#6fe3c1'],
  },
  {
    id: 'eventhorizon',
    name: 'Event Horizon',
    mood: 'Starlight bending around the dark. Deep space, deep time.',
    inspiredBy: 'vast and cosmic, like Interstellar',
    dark: true,
    font: { family: "'Jost Variable', 'Jost', sans-serif", weight: 300, tracking: '0.28em', upper: true, scale: 0.86 },
    c: {
      bg: '#000000',
      ink: '#f2f4ff',
      ink2: '#b5bcd6',
      ink3: '#7a819c',
      accent: '#ffb15c',
      accentInk: '#1a0e02',
      accent2: '#9db4ff',
      glass: 'rgba(6, 8, 16, 0.55)',
      glassHi: 'rgba(10, 12, 24, 0.82)',
      line: 'rgba(200, 210, 255, 0.14)',
      glow: '#ffc27a',
      shade: 'rgba(0, 0, 4, 0.72)',
    },
    ui: { radius: 14, blur: 24, grain: 0.035, vignette: 0.35, panel: 'glass' },
    particles: 'meteors',
    ambience: 'void',
    entrance: 'warp',
    preview: ['#000000', '#3a2a12', '#ffb15c'],
  },
  {
    id: 'midnightdrive',
    name: 'Midnight Drive',
    mood: 'Neon grid, chrome sunset, an endless highway at 2 a.m.',
    inspiredBy: 'retro and electric, like Drive or Blade Runner',
    dark: true,
    font: { family: "'Tilt Neon Variable', 'Tilt Neon', sans-serif", weight: 400, tracking: '0.02em', upper: false, scale: 1.02 },
    c: {
      bg: '#0b0220',
      ink: '#fdf2ff',
      ink2: '#e1b8f5',
      ink3: '#a27bc4',
      accent: '#ff3cac',
      accentInk: '#ffffff',
      accent2: '#2de2e6',
      glass: 'rgba(16, 4, 40, 0.6)',
      glassHi: 'rgba(24, 6, 56, 0.84)',
      line: 'rgba(255, 90, 200, 0.26)',
      glow: '#ff3cac',
      shade: 'rgba(8, 1, 22, 0.74)',
    },
    ui: { radius: 12, blur: 20, grain: 0.04, vignette: 0.32, panel: 'neon' },
    particles: 'none',
    ambience: 'synth',
    entrance: 'scan',
    preview: ['#0b0220', '#ff3cac', '#ffb86b'],
  },
  {
    id: 'silverscreen',
    name: 'Silver Screen',
    mood: 'Black-and-white glamour, gold leaf and a projector’s flicker.',
    inspiredBy: 'classic and glamorous, like old Hollywood',
    dark: true,
    font: { family: "'Limelight', serif", weight: 400, tracking: '0.03em', upper: false, scale: 0.96 },
    c: {
      bg: '#0e0e10',
      ink: '#edebe6',
      ink2: '#c4c0b7',
      ink3: '#8d8a84',
      accent: '#d8b45a',
      accentInk: '#1a1408',
      accent2: '#b0283a',
      glass: 'rgba(16, 16, 18, 0.66)',
      glassHi: 'rgba(22, 22, 24, 0.86)',
      line: 'rgba(216, 180, 90, 0.24)',
      glow: '#f3d98b',
      shade: 'rgba(6, 6, 7, 0.76)',
    },
    ui: { radius: 2, blur: 18, grain: 0.12, vignette: 0.6, panel: 'deco' },
    particles: 'dust',
    ambience: 'projector',
    entrance: 'burn',
    preview: ['#0e0e10', '#5a5a5e', '#d8b45a'],
  },
  {
    id: 'emberrealm',
    name: 'Ember Realm',
    mood: 'Firelight, old forests and a golden glow beyond the mountains.',
    inspiredBy: 'mythic and warm, like The Lord of the Rings',
    dark: true,
    font: { family: "'Cormorant Garamond Variable', 'Cormorant Garamond', serif", weight: 640, tracking: '0.01em', upper: false, scale: 1.12 },
    c: {
      bg: '#0a0d0b',
      ink: '#f6eedc',
      ink2: '#d4c7a8',
      ink3: '#988b6e',
      accent: '#f2a541',
      accentInk: '#1c0f02',
      accent2: '#86c08c',
      glass: 'rgba(13, 15, 11, 0.6)',
      glassHi: 'rgba(19, 21, 15, 0.84)',
      line: 'rgba(242, 165, 65, 0.2)',
      glow: '#ffb65c',
      shade: 'rgba(5, 6, 4, 0.74)',
    },
    ui: { radius: 10, blur: 22, grain: 0.05, vignette: 0.48, panel: 'glass' },
    particles: 'embers',
    ambience: 'hearth',
    entrance: 'ember',
    preview: ['#0a0d0b', '#3f4a2e', '#f2a541'],
  },
];

export const THEME_BY_ID: Record<ThemeId, ThemeDef> = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<
  ThemeId,
  ThemeDef
>;

/** Writes a theme's tokens onto :root. Colours are registered with @property so they glide between themes. */
export function applyThemeTokens(t: ThemeDef) {
  const r = document.documentElement.style;
  const set = (k: string, v: string) => r.setProperty(k, v);
  set('--bg', t.c.bg);
  set('--ink', t.c.ink);
  set('--ink-2', t.c.ink2);
  set('--ink-3', t.c.ink3);
  set('--accent', t.c.accent);
  set('--accent-ink', t.c.accentInk);
  set('--accent-2', t.c.accent2);
  set('--glass', t.c.glass);
  set('--glass-hi', t.c.glassHi);
  set('--line', t.c.line);
  set('--glow', t.c.glow);
  set('--shade', t.c.shade);
  set('--radius', t.ui.radius + 'px');
  set('--blur', t.ui.blur + 'px');
  set('--grain', String(t.ui.grain));
  set('--vignette', String(t.ui.vignette));
  set('--font-display', t.font.family);
  set('--display-weight', String(t.font.weight));
  set('--display-tracking', t.font.tracking);
  set('--display-case', t.font.upper ? 'uppercase' : 'none');
  set('--display-scale', String(t.font.scale));
  set('--display-settings', t.font.settings ?? 'normal');
  document.documentElement.dataset.theme = t.id;
  document.documentElement.dataset.panel = t.ui.panel;
  document.documentElement.dataset.tone = t.dark ? 'dark' : 'light';
}

export const COLOR_TOKENS = ['--bg', '--ink', '--ink-2', '--ink-3', '--accent', '--accent-ink', '--accent-2', '--glass', '--glass-hi', '--line', '--glow', '--shade'];
