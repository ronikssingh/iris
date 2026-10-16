import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, MotionConfig } from 'motion/react';
import { Stage } from './themes/Stage';
import { TopBar } from './app/TopBar';
import { Intro } from './app/Intro';
import { Onboarding } from './app/Onboarding';
import { CelebrationHost } from './app/Celebration';
import { ForYou } from './pages/ForYou';
import { Friends } from './pages/Friends';
import { FriendProfile } from './pages/FriendProfile';
import { useOnline } from './state/online';
import { Shortcuts } from './app/Shortcuts';
import { ModalHost, Toasts } from './components/ui';
import { Lobby } from './pages/Lobby';
import { Archive } from './pages/Archive';
import { Detail } from './pages/Detail';
import { Editor } from './pages/Editor';
import { Masterpieces } from './pages/Masterpieces';
import { UpNext } from './pages/UpNext';
import { SettingsPage } from './pages/Settings';
import { useLibrary, flushLibrary } from './state/library';
import { useSettings, flushSettings } from './state/settings';
import { useUi, type Route } from './state/ui';
import { initTheme, nextTheme, randomTheme, startRotation } from './themes/controller';
import { THEME_BY_ID } from './themes/themes';
import { sound } from './lib/sound';
import { backupNow, exportBackup, exportCsv, runImportFlow } from './lib/actions';
import { colorOfStored } from './lib/images';
import { appInfo, setAppInfo } from './lib/appInfo';

function routeKey(r: Route) {
  return r.name === 'detail' ? 'detail-' + r.id : r.name === 'write' ? 'write-' + (r.draftId ?? 'new') : r.name === 'friend' ? 'friend-' + r.id : r.name;
}

const pageVariants = {
  initial: (dir: number) => ({ opacity: 0, scale: dir < 0 ? 0.965 : 1.035, x: dir * 34, filter: 'blur(16px)' }),
  animate: { opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' },
  exit: (dir: number) => ({ opacity: 0, scale: dir < 0 ? 1.03 : 0.97, x: -dir * 34, filter: 'blur(16px)' }),
};

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'lobby':
      return <Lobby />;
    case 'archive':
      return <Archive />;
    case 'detail':
      return <Detail id={route.id} />;
    case 'write':
      return <Editor draftId={route.draftId} />;
    case 'masterpieces':
      return <Masterpieces />;
    case 'upnext':
      return <UpNext />;
    case 'foryou':
      return <ForYou />;
    case 'friends':
      return <Friends tab={route.tab} />;
    case 'friend':
      return <FriendProfile id={route.id} critique={route.critique} />;
    case 'settings':
      return <SettingsPage section={route.section} />;
  }
}

export function App() {
  const [boot, setBoot] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const route = useUi((s) => s.route);
  const dir = useUi((s) => s.dir);
  const introDone = useUi((s) => s.introDone);
  const onboarding = useUi((s) => s.onboarding);
  const motionPref = useSettings((s) => s.s.motion);
  const [introMode, setIntroMode] = useState<'full' | 'quick' | 'off'>('full');
  const [sweepKey, setSweepKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.iris.load();
        setAppInfo(r.info);
        document.documentElement.dataset.platform = r.info.platform;
        useLibrary.getState().setLibrary(r.library);
        const s = r.settings;
        if (!s.firstRunDone && window.matchMedia('(prefers-reduced-motion: reduce)').matches) s.motion = 'calm';
        useSettings.getState().replace(s);
        initTheme(s.theme);
        sound.init();
        sound.setPrefs(s.sound);
        sound.setAmbience(THEME_BY_ID[s.theme].ambience, 6);
        setIntroMode(s.intro);
        startRotation();
        const ui = useUi.getState();
        if (r.recovered) ui.toast({ text: `Your library file was damaged, so Iris restored it from ${r.recovered}.`, tone: 'bad', ms: 12000 });
        if (r.legacy && r.legacy.imported > 0)
          ui.toast({ text: `Brought ${r.legacy.imported} item${r.legacy.imported === 1 ? '' : 's'} over from Marquee`, tone: 'good', ms: 9000 });
        if (!s.firstRunDone) useUi.setState({ onboarding: true });
        if (r.pendingOpen) setTimeout(() => runImportFlow(r.pendingOpen), 4800);
        setBoot('ready');
        // sign back in to the friends service quietly in the background
        setTimeout(() => void useOnline.getState().start(), 1500);
        // posters brought in without a colour get one now
        setTimeout(async () => {
          const lib = useLibrary.getState().lib;
          for (const c of lib.critiques) {
            if (c.poster && !c.posterColor) {
              const col = await colorOfStored(c.poster);
              if (col) useLibrary.getState().upsertCritique({ ...c, posterColor: col });
            }
          }
        }, 6000);
      } catch (e: any) {
        setBootError(e?.message || String(e));
        setBoot('error');
      }
    })();
  }, []);

  // keep sound settings live
  const soundPrefs = useSettings((s) => s.s.sound);
  useEffect(() => {
    if (boot === 'ready') sound.setPrefs(soundPrefs);
  }, [soundPrefs, boot]);

  // page change: a whoosh and a light sweep
  useEffect(() => {
    if (boot !== 'ready' || !introDone) return;
    sound.whoosh(dir);
    setSweepKey((k) => k + 1);
  }, [route, boot]);

  // menus, file opening and saving on quit
  const onMenu = useCallback((action: string) => {
    const ui = useUi.getState();
    if (action.startsWith('go:')) {
      const name = action.slice(3) as Route['name'];
      ui.go(name === 'write' ? { name: 'write' } : ({ name } as Route));
      return;
    }
    switch (action) {
      case 'new-critique':
        ui.go({ name: 'write' });
        break;
      case 'add-watch':
        ui.go({ name: 'upnext' });
        setTimeout(() => window.dispatchEvent(new CustomEvent('iris:add-watch')), 450);
        break;
      case 'backup-now':
        void backupNow();
        break;
      case 'backup-export':
        void exportBackup();
        break;
      case 'backup-import':
        void runImportFlow(null);
        break;
      case 'export-csv':
        void exportCsv();
        break;
      case 'find':
        ui.go({ name: 'archive' });
        useUi.setState({ focusSearch: Date.now() });
        break;
      case 'theme-next':
        nextTheme();
        break;
      case 'theme-random':
        randomTheme();
        break;
      case 'sound-toggle':
        useSettings.getState().set((s) => ({ sound: { ...s.sound, enabled: !s.sound.enabled } }));
        break;
      case 'shortcuts':
        useUi.setState({ shortcutsOpen: true });
        break;
    }
  }, []);

  useEffect(() => {
    if (boot !== 'ready') return;
    const offs = [
      window.iris.app.onMenu(onMenu),
      window.iris.app.onOpenFile((f) => void runImportFlow(f)),
      window.iris.app.onFlushRequest(async () => {
        await flushLibrary();
        await flushSettings();
      }),
    ];
    const onDrop = (e: DragEvent) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      if (/\.(irisbackup|json)$/i.test(f.name)) {
        e.preventDefault();
        const p = window.iris.app.pathForFile(f);
        if (p) void runImportFlow(p);
      }
    };
    const onOver = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.items ?? []).some((i) => i.kind === 'file')) e.preventDefault();
    };
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragover', onOver);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        onMenu('go:' + ['lobby', 'archive', 'write', 'masterpieces', 'upnext'][Number(e.key) - 1]);
      } else if (mod && e.key === ',') {
        e.preventDefault();
        onMenu('go:settings');
      } else if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        onMenu('new-critique');
      } else if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        onMenu('find');
      } else if (!typing && e.key === '?' ) {
        useUi.setState({ shortcutsOpen: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      offs.forEach((o) => o());
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('keydown', onKey);
    };
  }, [boot, onMenu]);

  if (boot === 'error')
    return (
      <div className="boot-error">
        <h1>Iris couldn’t open your library</h1>
        <p>{bootError}</p>
        <p>Your data hasn’t been changed. Quit and reopen Iris; if this keeps happening, your snapshots are in the Iris data folder.</p>
      </div>
    );
  if (boot === 'loading') return <div className="boot" />;

  return (
    <MotionConfig reducedMotion={motionPref === 'calm' ? 'always' : 'never'}>
      <Stage />
      <div className={'shell' + (revealed ? ' revealed' : '')}>
        <TopBar platform={appInfo.platform} />
        <main className="viewport">
          <LayoutGroup>
            <AnimatePresence mode="popLayout" custom={dir} initial={false}>
              <motion.div
                key={routeKey(route)}
                className="page-wrap"
                custom={dir}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.55, ease: [0.22, 0.9, 0.25, 1] }}
              >
                <Page route={route} />
              </motion.div>
            </AnimatePresence>
          </LayoutGroup>
        </main>
        {sweepKey > 0 && <div key={sweepKey} className={'light-sweep ' + (dir < 0 ? 'rev' : '')} aria-hidden="true" />}
      </div>
      {!introDone && (
        <Intro
          mode={introMode}
          onReveal={() => setRevealed(true)}
          onDone={() => {
            setRevealed(true);
            useUi.setState({ introDone: true });
          }}
        />
      )}
      <AnimatePresence>{introDone && onboarding && <Onboarding />}</AnimatePresence>
      <CelebrationHost />
      <Shortcuts />
      <ModalHost />
      <Toasts />
    </MotionConfig>
  );
}
