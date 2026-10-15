import { create } from 'zustand';
import { defaultSettings, type Settings } from '../shared/settings';

interface SettingsState {
  s: Settings;
  set: (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => void;
  replace: (s: Settings) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  s: defaultSettings(),
  set: (patch) => {
    const cur = get().s;
    const p = typeof patch === 'function' ? patch(cur) : patch;
    set({ s: { ...cur, ...p } });
    schedule();
  },
  replace: (s) => set({ s }),
}));

let t: number | null = null;
function schedule() {
  if (t) clearTimeout(t);
  t = window.setTimeout(() => {
    t = null;
    void window.iris.saveSettings(useSettings.getState().s);
  }, 300);
}

export async function flushSettings() {
  if (t) {
    clearTimeout(t);
    t = null;
  }
  await window.iris.saveSettings(useSettings.getState().s);
}
