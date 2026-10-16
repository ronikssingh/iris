import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeSettings, ORIGINAL_THEMES, THEME_IDS } from '../../src/shared/settings';

const NEW = THEME_IDS.filter((t) => !ORIGINAL_THEMES.includes(t));

describe('settings: worlds arriving in an update', () => {
  it('a brand-new install has every world in the rotation and nothing marked new', () => {
    const s = normalizeSettings(null);
    expect(s.rotation).toEqual([...THEME_IDS]);
    expect(s.worldsSeen).toEqual([...THEME_IDS]);
    expect(s.newWorlds).toEqual([]);
  });

  it('settings from 1.1 gain the new worlds in their rotation, marked new, keeping what they removed', () => {
    const old = { ...defaultSettings(), rotation: ORIGINAL_THEMES.filter((t) => t !== 'glitchpop') } as any;
    delete old.worldsSeen;
    delete old.newWorlds;
    const s = normalizeSettings(old);
    expect(s.rotation).not.toContain('glitchpop');
    for (const t of NEW) expect(s.rotation).toContain(t);
    expect(s.newWorlds.sort()).toEqual([...NEW].sort());
    expect(s.worldsSeen).toEqual([...THEME_IDS]);
  });

  it('treats settings from 1.1, which had its own seen list and an older Sundown, as new to every 1.2 world', () => {
    const v11 = { ...defaultSettings(), rotation: [...ORIGINAL_THEMES, 'sundown', 'frostkeep'], themesSeen: [...ORIGINAL_THEMES, 'sundown', 'frostkeep', 'hanami'], theme: 'frostkeep' } as any;
    delete v11.worldsSeen;
    delete v11.newWorlds;
    const s = normalizeSettings(v11);
    expect(s.newWorlds.sort()).toEqual([...NEW].sort());
    expect(s.rotation).not.toContain('frostkeep');
    expect(s.theme).toBe('winedark');
    expect(s.recs.kinds).toEqual(['movie', 'show', 'game']);
  });

  it('once seen, a world taken out of the rotation stays out, and visited worlds stay unmarked', () => {
    const first = normalizeSettings({ ...defaultSettings(), rotation: [...ORIGINAL_THEMES], worldsSeen: undefined, newWorlds: undefined });
    const later = normalizeSettings({ ...first, rotation: first.rotation.filter((t) => t !== 'fold'), newWorlds: first.newWorlds.filter((t) => t !== 'sundown') });
    expect(later.rotation).not.toContain('fold');
    expect(later.newWorlds).not.toContain('sundown');
    expect(later.newWorlds).toContain('ringworld');
  });

  it('ignores worlds it does not know', () => {
    const s = normalizeSettings({ ...defaultSettings(), rotation: ['vigil', 'nope', 'fold'], newWorlds: ['ghost', 'fold'] });
    expect(s.rotation).toEqual(['vigil', 'fold']);
    expect(s.newWorlds).toEqual(['fold']);
  });
});
