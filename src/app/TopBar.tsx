import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Icon } from '../components/Icon';
import { Button, Popover, Toggle, Wordmark } from '../components/ui';
import { useUi, type Route } from '../state/ui';
import { useSettings } from '../state/settings';
import { sound } from '../lib/sound';
import { THEMES, THEME_BY_ID } from '../themes/themes';
import { changeTheme, msUntilRotation, randomTheme, resetRotationClock } from '../themes/controller';
import type { ThemeId } from '../shared/settings';
import { incoming, useOnline } from '../state/online';

const TABS: { name: Route['name']; label: string; icon: string }[] = [
  { name: 'lobby', label: 'Lobby', icon: 'lobby' },
  { name: 'archive', label: 'Critiques', icon: 'archive' },
  { name: 'write', label: 'Write', icon: 'pen' },
  { name: 'masterpieces', label: 'Masterpieces', icon: 'crown' },
  { name: 'upnext', label: 'Up Next', icon: 'queue' },
  { name: 'foryou', label: 'For You', icon: 'flame' },
  { name: 'friends', label: 'Friends', icon: 'people' },
];

export function originOf(el: Element | null): [number, number] {
  if (!el) return [0.5, 0.5];
  const r = el.getBoundingClientRect();
  return [(r.left + r.width / 2) / window.innerWidth, 1 - (r.top + r.height / 2) / window.innerHeight];
}

export function TopBar({ platform }: { platform: string }) {
  const route = useUi((s) => s.route);
  const go = useUi((s) => s.go);
  const theme = useSettings((s) => s.s.theme);
  const soundOn = useSettings((s) => s.s.sound.enabled);
  const setS = useSettings((s) => s.set);
  const [pickerOpen, setPickerOpen] = useState(false);
  const themeBtn = useRef<HTMLButtonElement>(null);
  const shuffleBtn = useRef<HTMLButtonElement>(null);
  const active = route.name === 'detail' ? 'archive' : route.name === 'friend' ? 'friends' : route.name;
  const badge = useOnline((s) => (s.phase === 'ready' ? incoming(s).length + s.suggestions.filter((x) => x.toUser === s.me?.id && !x.seen).length : 0));
  const open = useUi((s) => s.themePickerOpen);

  useEffect(() => {
    if (open) {
      setPickerOpen(true);
      useUi.setState({ themePickerOpen: false });
    }
  }, [open]);

  return (
    <header className={`topbar topbar-${platform}`}>
      <button type="button" className="topbar-brand no-drag" onClick={() => go({ name: 'lobby' })} aria-label="Iris lobby">
        <Wordmark compact />
      </button>
      <nav className="tabs no-drag" aria-label="Sections">
        {TABS.map((t) => {
          const on = active === t.name;
          return (
            <button
              key={t.name}
              type="button"
              title={t.label}
              className={'tab' + (on ? ' on' : '')}
              aria-current={on ? 'page' : undefined}
              onPointerEnter={() => sound.hover()}
              onClick={() => {
                if (t.name === 'write' && route.name === 'write') return;
                go(t.name === 'write' ? { name: 'write' } : ({ name: t.name } as Route));
              }}
            >
              {on && (
                <motion.span className="tab-pill" layoutId="tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
                  <span className="tab-beam" />
                </motion.span>
              )}
              <Icon name={t.icon} size={16} />
              <span className="tab-label">{t.label}</span>
              {t.name === 'friends' && badge > 0 && <span className="tab-badge">{badge}</span>}
            </button>
          );
        })}
      </nav>
      <div className="topbar-tools no-drag">
        <button
          ref={shuffleBtn}
          type="button"
          className="tool"
          title="Surprise me with another world"
          onClick={() => {
            sound.click();
            randomTheme(originOf(shuffleBtn.current));
          }}
        >
          <Icon name="shuffle" size={17} />
        </button>
        <button ref={themeBtn} type="button" className={'tool tool-theme' + (pickerOpen ? ' on' : '')} onClick={() => setPickerOpen((v) => !v)} title="Choose a world">
          <span className="swatch" style={{ background: `linear-gradient(135deg, ${THEME_BY_ID[theme].preview.join(', ')})` }} />
          <span className="tool-theme-name">{THEME_BY_ID[theme].name}</span>
          <Icon name="down" size={14} />
        </button>
        <button
          type="button"
          className="tool"
          title={soundOn ? 'Turn sound off' : 'Turn sound on'}
          aria-pressed={soundOn}
          onClick={() => {
            setS((s) => ({ sound: { ...s.sound, enabled: !s.sound.enabled } }));
          }}
        >
          <Icon name={soundOn ? 'volume' : 'mute'} size={17} />
        </button>
        <button type="button" className={'tool' + (route.name === 'settings' ? ' on' : '')} title="Settings" onClick={() => go({ name: 'settings' })}>
          <Icon name="gear" size={17} />
        </button>
      </div>
      <ThemePicker open={pickerOpen} onClose={() => setPickerOpen(false)} anchor={themeBtn} />
    </header>
  );
}

function ThemePicker({ open, onClose, anchor }: { open: boolean; onClose: () => void; anchor: React.RefObject<HTMLButtonElement | null> }) {
  const s = useSettings((x) => x.s);
  const setS = useSettings((x) => x.set);
  const [, force] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [open]);
  const left = msUntilRotation();
  const pick = (id: ThemeId, el: HTMLElement) => {
    sound.click();
    changeTheme(id, { origin: originOf(el) });
  };
  return (
    <Popover open={open} onClose={onClose} anchor={anchor} align="end" width={560}>
      <div className="picker">
        <div className="picker-head">
          <h3>Choose a world</h3>
          <Button
            size="sm"
            icon="shuffle"
            onClick={(e) => {
              randomTheme(originOf(e.currentTarget));
            }}
          >
            Surprise me
          </Button>
        </div>
        <div className="picker-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={'picker-card' + (s.theme === t.id ? ' on' : '')}
              onPointerEnter={() => sound.hover()}
              onClick={(e) => pick(t.id, e.currentTarget)}
            >
              <span className="picker-swatch" style={{ background: `linear-gradient(135deg, ${t.preview[0]} 0%, ${t.preview[1]} 55%, ${t.preview[2]} 100%)` }}>
                <span className="picker-glyph" style={{ fontFamily: t.font.family, fontWeight: t.font.weight, letterSpacing: t.font.tracking, textTransform: t.font.upper ? 'uppercase' : 'none', fontVariationSettings: t.font.settings }}>
                  {t.name}
                </span>
              </span>
              <span className="picker-mood">{t.vibe}</span>
            </button>
          ))}
        </div>
        <div className="picker-foot">
          <Toggle
            on={s.autoRotate}
            onChange={(v) => {
              setS({ autoRotate: v });
              resetRotationClock();
            }}
            label="Change worlds on a timer"
            hint={
              s.autoRotate && left !== null
                ? `Next change in ${left > 60000 ? Math.ceil(left / 60000) + ' min' : Math.ceil(left / 1000) + ' sec'}. Pauses while you write.`
                : 'A new world drifts in every few minutes.'
            }
          />
          {s.autoRotate && (
            <div className="picker-every">
              <span>Every</span>
              {[2, 5, 10, 20, 45].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={'chip' + (s.rotateMinutes === m ? ' on' : '')}
                  onClick={() => {
                    sound.click();
                    setS({ rotateMinutes: m });
                    resetRotationClock();
                  }}
                >
                  {m} min
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Popover>
  );
}
