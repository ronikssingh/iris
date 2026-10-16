/* Owns the current world: switching themes, the rotation timer, storms and glitches. */
import { THEME_IDS, type ThemeId } from '../shared/settings';
import { useSettings } from '../state/settings';
import { useUi } from '../state/ui';
import { sound } from '../lib/sound';
import { applyThemeTokens, THEME_BY_ID, TRANSITION_INDEX, type ThemeDef } from './themes';
import type { StageEngine } from './engine';

type Listener = (t: ThemeDef, phase: 'start' | 'mid' | 'done') => void;

let engine: StageEngine | null = null;
let lastChange = Date.now();
let busy = false;
const listeners = new Set<Listener>();
let current: ThemeId = 'winedark';

export function onThemePhase(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function currentTheme(): ThemeDef {
  return THEME_BY_ID[current];
}

export function attachEngine(e: StageEngine | null) {
  engine = e;
}

/** A world stops being "New" once it has been on screen. */
function markVisited(id: ThemeId) {
  const st = useSettings.getState();
  if (st.s.newWorlds.includes(id)) st.set({ newWorlds: st.s.newWorlds.filter((w) => w !== id) });
}

export function initTheme(id: ThemeId) {
  markVisited(id);
  current = id;
  const def = THEME_BY_ID[id];
  applyThemeTokens(def);
  window.iris?.app.setTitleBarTheme(def.dark);
  lastChange = Date.now();
}

export function changeTheme(id: ThemeId, opts: { origin?: [number, number]; save?: boolean } = {}) {
  if (busy && id === current) return;
  const def = THEME_BY_ID[id];
  const from = current;
  current = id;
  busy = true;
  lastChange = Date.now();
  if (opts.save !== false) useSettings.getState().set({ theme: id });
  markVisited(id);
  listeners.forEach((l) => l(def, 'start'));
  const mid = () => {
    applyThemeTokens(def);
    window.iris?.app.setTitleBarTheme(def.dark);
    document.documentElement.classList.add('theme-swap');
    window.setTimeout(() => document.documentElement.classList.remove('theme-swap'), 520);
    sound.setAmbience(def.ambience, 3);
    listeners.forEach((l) => l(def, 'mid'));
  };
  const done = () => {
    busy = false;
    listeners.forEach((l) => l(def, 'done'));
  };
  if (engine && from !== id) {
    engine.transitionTo(id, TRANSITION_INDEX[def.entrance], {
      duration: def.entrance === 'lightning' || def.entrance === 'glitch' ? 1300 : 2100,
      origin: opts.origin,
      onMidpoint: mid,
      onDone: done,
    });
  } else {
    mid();
    done();
  }
  if (def.entrance === 'lightning') window.setTimeout(() => sound.thunder(0.15, 0.9), 120);
}

// handy for automated screenshots and debugging
(window as any).__irisTheme = (id: ThemeId) => changeTheme(id, { save: false });

function pool(): ThemeId[] {
  const s = useSettings.getState().s;
  const p = s.rotation.filter((t) => (THEME_IDS as readonly string[]).includes(t));
  return p.length >= 2 ? p : [...THEME_IDS];
}

export function nextTheme(origin?: [number, number]) {
  const p = [...THEME_IDS];
  const i = p.indexOf(current);
  changeTheme(p[(i + 1) % p.length], { origin });
}

export function randomTheme(origin?: [number, number]) {
  const p = pool().filter((t) => t !== current);
  const pick = p[Math.floor(Math.random() * p.length)] ?? 'winedark';
  changeTheme(pick, { origin });
}

/** Checks the rotation timer every few seconds. Pauses while writing, so nothing shifts under you mid-thought. */
export function startRotation() {
  window.setInterval(() => {
    const s = useSettings.getState().s;
    if (!s.autoRotate) return;
    const ui = useUi.getState();
    if (!ui.introDone || ui.route.name === 'write' || ui.modal || document.hidden) return;
    if (Date.now() - lastChange < s.rotateMinutes * 60e3) return;
    if (s.rotateOrder === 'sequence') {
      const p = pool();
      const i = p.indexOf(current);
      changeTheme(p[(i + 1) % p.length]);
    } else randomTheme();
  }, 4000);
}

export function resetRotationClock() {
  lastChange = Date.now();
}

export function msUntilRotation(): number | null {
  const s = useSettings.getState().s;
  if (!s.autoRotate) return null;
  return Math.max(0, s.rotateMinutes * 60e3 - (Date.now() - lastChange));
}
