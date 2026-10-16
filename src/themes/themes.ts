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
  | 'embers'
  | 'pollen'
  | 'lanterns'
  | 'glints'
  | 'fireflies'
  | 'streaks'
  | 'spirits'
  | 'debris'
  | 'leaves'
  | 'neonrain'
  | 'spores';

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
  | 'ember'
  | 'dusk'
  | 'mist'
  | 'ripple'
  | 'sunbeam'
  | 'speed'
  | 'bloom'
  | 'fold'
  | 'gust'
  | 'drip'
  | 'nebula';

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
  dusk: 10,
  mist: 11,
  ripple: 12,
  sunbeam: 13,
  speed: 14,
  bloom: 15,
  fold: 16,
  gust: 17,
  drip: 18,
  nebula: 19,
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
  | 'hearth'
  | 'prairie'
  | 'lake'
  | 'tide'
  | 'swamp'
  | 'surge'
  | 'grove'
  | 'dream'
  | 'meadow'
  | 'metropolis'
  | 'falls';

/* A still of each world for the pickers, rendered from the real shaders with the theme lab. */
const THUMBS = import.meta.glob('./thumbs/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const thumbOf = (id: ThemeId): string => THUMBS[`./thumbs/${id}.webp`] ?? '';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  mood: string;
  vibe: string; // a few words on how it feels
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
  sparks?: boolean; // occasional crackles of electricity
  preview: [string, string, string]; // gradient stops for the picker swatch
}

export const THEMES: ThemeDef[] = [
  {
    id: 'vigil',
    name: 'Vigil',
    mood: 'Rain-slick rooftops, sodium-red light, a storm rolling in.',
    vibe: 'dark and moody',
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
    vibe: 'sunny and hopeful',
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
    vibe: 'warm and dramatic',
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
    vibe: 'bright and colourful',
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
    vibe: 'epic and intense',
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
    mood: 'The endless winter: aurora over a snowbound longhouse and a frozen fjord.',
    vibe: 'cold and mythic',
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
    vibe: 'vast and cosmic',
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
    vibe: 'retro and electric',
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
    vibe: 'classic and glamorous',
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
    vibe: 'mythic and warm',
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
  {
    id: 'sundown',
    name: 'Sundown',
    mood: 'A lone rider on the ridge, the last light going down over purple valleys.',
    vibe: 'wild and golden',
    dark: true,
    font: { family: "'Rye', serif", weight: 400, tracking: '0.02em', upper: true, scale: 0.8 },
    c: {
      bg: '#1a0f1e',
      ink: '#fff3e6',
      ink2: '#ead0bb',
      ink3: '#ad8f88',
      accent: '#ff9a3c',
      accentInk: '#1e0e04',
      accent2: '#c99bff',
      glass: 'rgba(30, 15, 32, 0.56)',
      glassHi: 'rgba(38, 19, 40, 0.82)',
      line: 'rgba(255, 190, 140, 0.18)',
      glow: '#ffb35c',
      shade: 'rgba(16, 7, 18, 0.74)',
    },
    ui: { radius: 6, blur: 22, grain: 0.05, vignette: 0.42, panel: 'glass' },
    particles: 'pollen',
    ambience: 'prairie',
    entrance: 'dusk',
    preview: ['#2a1640', '#e0703a', '#ffd38a'],
  },
  {
    id: 'lanternmere',
    name: 'Lanternmere',
    mood: 'A castle on a misty lake, and little boats carrying lanterns home across the water.',
    vibe: 'misty and magical',
    dark: true,
    font: { family: "'IM Fell English SC', serif", weight: 400, tracking: '0.03em', upper: false, scale: 1.06 },
    c: {
      bg: '#0a1220',
      ink: '#eef2fa',
      ink2: '#b8c3d7',
      ink3: '#7c889f',
      accent: '#ffc46b',
      accentInk: '#1c1204',
      accent2: '#93b6ff',
      glass: 'rgba(10, 18, 32, 0.58)',
      glassHi: 'rgba(14, 24, 42, 0.84)',
      line: 'rgba(255, 210, 140, 0.16)',
      glow: '#ffcf7a',
      shade: 'rgba(4, 8, 16, 0.74)',
    },
    ui: { radius: 10, blur: 24, grain: 0.04, vignette: 0.45, panel: 'glass' },
    particles: 'lanterns',
    ambience: 'lake',
    entrance: 'mist',
    preview: ['#0a1220', '#34496b', '#ffc46b'],
  },
  {
    id: 'moonwake',
    name: 'Moonwake',
    mood: 'A tall ship under a full moon, its wake running silver across a calm black sea.',
    vibe: 'moonlit and daring',
    dark: true,
    font: { family: "'Pirata One', serif", weight: 400, tracking: '0.02em', upper: false, scale: 1.14 },
    c: {
      bg: '#050a18',
      ink: '#eef3ff',
      ink2: '#b5c1da',
      ink3: '#78849f',
      accent: '#a9c8ff',
      accentInk: '#06101f',
      accent2: '#ffd27a',
      glass: 'rgba(6, 12, 28, 0.58)',
      glassHi: 'rgba(9, 16, 36, 0.84)',
      line: 'rgba(170, 195, 255, 0.16)',
      glow: '#bcd4ff',
      shade: 'rgba(2, 5, 12, 0.74)',
    },
    ui: { radius: 10, blur: 22, grain: 0.04, vignette: 0.45, panel: 'glass' },
    particles: 'glints',
    ambience: 'tide',
    entrance: 'ripple',
    preview: ['#050a18', '#22356a', '#e4ecff'],
  },
  {
    id: 'gloamwood',
    name: 'Gloamwood',
    mood: 'Old rails running into a hazy wood, moss hanging low and the sun burning through the mist.',
    vibe: 'hazy and forgotten',
    dark: true,
    font: { family: "'Special Elite', monospace", weight: 400, tracking: '0.01em', upper: false, scale: 0.92 },
    c: {
      bg: '#0e130c',
      ink: '#f2f0e3',
      ink2: '#cbc8ae',
      ink3: '#8d8c73',
      accent: '#e8b04a',
      accentInk: '#1a1204',
      accent2: '#9cc07a',
      glass: 'rgba(16, 20, 13, 0.6)',
      glassHi: 'rgba(22, 27, 18, 0.84)',
      line: 'rgba(232, 200, 120, 0.16)',
      glow: '#ffd27f',
      shade: 'rgba(7, 9, 5, 0.74)',
    },
    ui: { radius: 6, blur: 22, grain: 0.07, vignette: 0.5, panel: 'glass' },
    particles: 'fireflies',
    ambience: 'swamp',
    entrance: 'sunbeam',
    preview: ['#1b2414', '#76804c', '#ffd27f'],
  },
  {
    id: 'velocity',
    name: 'Velocity',
    mood: 'Running flat out through a tunnel of gold and crimson lightning.',
    vibe: 'fast and electric',
    dark: true,
    font: { family: "'Racing Sans One', sans-serif", weight: 400, tracking: '0.01em', upper: true, scale: 0.98 },
    c: {
      bg: '#140502',
      ink: '#fff4e8',
      ink2: '#f4caa9',
      ink3: '#b48666',
      accent: '#ffb000',
      accentInk: '#1c0d00',
      accent2: '#ff4a2a',
      glass: 'rgba(24, 8, 4, 0.6)',
      glassHi: 'rgba(32, 10, 5, 0.84)',
      line: 'rgba(255, 170, 80, 0.2)',
      glow: '#ffc24a',
      shade: 'rgba(12, 3, 1, 0.76)',
    },
    ui: { radius: 8, blur: 20, grain: 0.04, vignette: 0.36, panel: 'glass' },
    particles: 'streaks',
    ambience: 'surge',
    entrance: 'speed',
    sparks: true,
    preview: ['#140502', '#c2410c', '#ffd27a'],
  },
  {
    id: 'spiritgrove',
    name: 'Spirit Grove',
    mood: 'Moonlight in an ancient cedar grove, where a white stag wades the stream.',
    vibe: 'hushed and enchanted',
    dark: true,
    font: { family: "'Shippori Mincho', serif", weight: 700, tracking: '0.05em', upper: false, scale: 1.0 },
    c: {
      bg: '#04100f',
      ink: '#e9f6f2',
      ink2: '#abcac2',
      ink3: '#71918a',
      accent: '#8ff5df',
      accentInk: '#03130f',
      accent2: '#ec5a4b',
      glass: 'rgba(4, 16, 15, 0.58)',
      glassHi: 'rgba(6, 22, 21, 0.84)',
      line: 'rgba(140, 245, 220, 0.16)',
      glow: '#9fffe9',
      shade: 'rgba(2, 8, 7, 0.76)',
    },
    ui: { radius: 10, blur: 24, grain: 0.04, vignette: 0.5, panel: 'glass' },
    particles: 'spirits',
    ambience: 'grove',
    entrance: 'bloom',
    preview: ['#04100f', '#17463f', '#8ff5df'],
  },
  {
    id: 'fold',
    name: 'Fold',
    mood: 'A city folding over itself, its streets climbing up into the sky.',
    vibe: 'surreal and dizzying',
    dark: false,
    font: { family: "'Syncopate', sans-serif", weight: 700, tracking: '0.04em', upper: true, scale: 0.72 },
    c: {
      bg: '#d9d4ca',
      ink: '#1d1f24',
      ink2: '#454953',
      ink3: '#6c707a',
      accent: '#c2562b',
      accentInk: '#ffffff',
      accent2: '#3d6e8f',
      glass: 'rgba(250, 247, 240, 0.56)',
      glassHi: 'rgba(252, 250, 245, 0.84)',
      line: 'rgba(29, 31, 36, 0.14)',
      glow: '#ffbf80',
      shade: 'rgba(20, 22, 28, 0.6)',
    },
    ui: { radius: 4, blur: 24, grain: 0.03, vignette: 0.18, panel: 'glass' },
    particles: 'debris',
    ambience: 'dream',
    entrance: 'fold',
    preview: ['#9fb4c7', '#d9d4ca', '#c2562b'],
  },
  {
    id: 'windsweep',
    name: 'Windsweep',
    mood: 'Wind running through golden grass toward a lone red maple on the hill.',
    vibe: 'breezy and nostalgic',
    dark: false,
    font: { family: "'Caveat Variable', 'Caveat', cursive", weight: 650, tracking: '0', upper: false, scale: 1.32 },
    c: {
      bg: '#f1dcc2',
      ink: '#2a1d14',
      ink2: '#5a4636',
      ink3: '#6e5a4b',
      accent: '#d2452a',
      accentInk: '#ffffff',
      accent2: '#e8a33d',
      glass: 'rgba(255, 246, 232, 0.55)',
      glassHi: 'rgba(255, 249, 238, 0.84)',
      line: 'rgba(42, 29, 20, 0.14)',
      glow: '#ffcf8a',
      shade: 'rgba(40, 24, 12, 0.6)',
    },
    ui: { radius: 16, blur: 26, grain: 0.03, vignette: 0.16, panel: 'glass' },
    particles: 'leaves',
    ambience: 'meadow',
    entrance: 'gust',
    preview: ['#f3c8a0', '#c9a24a', '#d2452a'],
  },
  {
    id: 'megacity',
    name: 'Megacity',
    mood: 'Neon towers in the rain, searchlights sweeping and holograms drifting over the traffic.',
    vibe: 'neon and restless',
    dark: true,
    font: { family: "'Chakra Petch', sans-serif", weight: 600, tracking: '0.04em', upper: true, scale: 0.94 },
    c: {
      bg: '#0a0418',
      ink: '#f4ecff',
      ink2: '#c8b6e8',
      ink3: '#8c7aae',
      accent: '#ff2bd6',
      accentInk: '#ffffff',
      accent2: '#21f0ff',
      glass: 'rgba(12, 6, 30, 0.62)',
      glassHi: 'rgba(18, 9, 42, 0.86)',
      line: 'rgba(255, 60, 220, 0.24)',
      glow: '#ff4fe0',
      shade: 'rgba(6, 2, 16, 0.78)',
    },
    ui: { radius: 6, blur: 20, grain: 0.05, vignette: 0.34, panel: 'neon' },
    particles: 'neonrain',
    ambience: 'metropolis',
    entrance: 'drip',
    preview: ['#0a0418', '#ff2bd6', '#21f0ff'],
  },
  {
    id: 'ringworld',
    name: 'Ringworld',
    mood: 'A ring of land arcing up into a nebula sky, waterfalls glowing in the night below.',
    vibe: 'vast and luminous',
    dark: true,
    font: { family: "'Exo 2 Variable', 'Exo 2', sans-serif", weight: 560, tracking: '0.12em', upper: true, scale: 0.86 },
    c: {
      bg: '#04061a',
      ink: '#eef2ff',
      ink2: '#b4bee2',
      ink3: '#7781a8',
      accent: '#7ee8ff',
      accentInk: '#02121a',
      accent2: '#ff6aa8',
      glass: 'rgba(6, 8, 28, 0.56)',
      glassHi: 'rgba(9, 12, 38, 0.84)',
      line: 'rgba(140, 200, 255, 0.18)',
      glow: '#8fe9ff',
      shade: 'rgba(2, 3, 12, 0.74)',
    },
    ui: { radius: 14, blur: 24, grain: 0.035, vignette: 0.38, panel: 'glass' },
    particles: 'spores',
    ambience: 'falls',
    entrance: 'nebula',
    preview: ['#04061a', '#43307f', '#7ee8ff'],
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
