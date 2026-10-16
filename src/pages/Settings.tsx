import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useSettings } from '../state/settings';
import { useLibrary } from '../state/library';
import { useUi } from '../state/ui';
import { Icon } from '../components/Icon';
import { Button, Segmented, Slider, Toggle } from '../components/ui';
import { Poster } from '../components/Poster';
import { THEMES } from '../themes/themes';
import { changeTheme, randomTheme, resetRotationClock } from '../themes/controller';
import { originOf } from '../app/TopBar';
import { backupNow, exportBackup, exportCsv, runImportFlow } from '../lib/actions';
import { bytes, longDate, relTime } from '../lib/format';
import { sound } from '../lib/sound';
import { appInfo } from '../lib/appInfo';
import type { BackupStatus } from '../shared/ipc';
import type { ThemeId } from '../shared/settings';

const SECTIONS = [
  { id: 'themes', label: 'Worlds', icon: 'aperture' },
  { id: 'sound', label: 'Sound', icon: 'volume' },
  { id: 'startup', label: 'Startup and motion', icon: 'sparkle' },
  { id: 'backups', label: 'Backups', icon: 'shield' },
  { id: 'deleted', label: 'Recently deleted', icon: 'trash' },
  { id: 'about', label: 'About', icon: 'info' },
];

export function SettingsPage({ section }: { section?: string }) {
  const [sec, setSec] = useState(section && SECTIONS.some((s) => s.id === section) ? section : 'themes');
  useEffect(() => {
    if (section) setSec(section);
  }, [section]);
  return (
    <div className="page settings">
      <header className="page-head">
        <h1 className="page-title display">Settings</h1>
      </header>
      <div className="settings-layout">
        <nav className="settings-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={'settings-tab' + (sec === s.id ? ' on' : '')}
              onClick={() => {
                sound.click();
                setSec(s.id);
              }}
            >
              {sec === s.id && <motion.span layoutId="settings-on" className="settings-on" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
              <Icon name={s.icon} size={16} />
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
        <motion.div key={sec} className="settings-body" initial={{ opacity: 0, x: 24, filter: 'blur(8px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ duration: 0.35 }}>
          {sec === 'themes' && <ThemesSection />}
          {sec === 'sound' && <SoundSection />}
          {sec === 'startup' && <StartupSection />}
          {sec === 'backups' && <BackupsSection />}
          {sec === 'deleted' && <DeletedSection />}
          {sec === 'about' && <AboutSection />}
        </motion.div>
      </div>
    </div>
  );
}

function ThemesSection() {
  const s = useSettings((x) => x.s);
  const set = useSettings((x) => x.set);
  const toggleRot = (id: ThemeId) => {
    const has = s.rotation.includes(id);
    const next = has ? s.rotation.filter((r) => r !== id) : [...s.rotation, id];
    if (next.length >= 2) set({ rotation: next });
    else useUi.getState().toast({ text: 'Keep at least two worlds in the rotation' });
  };
  return (
    <div className="set-section">
      <div className="set-head">
        <h2>Worlds</h2>
        <Button icon="shuffle" onClick={(e) => randomTheme(originOf(e.currentTarget))}>
          Surprise me
        </Button>
      </div>
      <div className="theme-grid">
        {THEMES.map((t) => (
          <div key={t.id} className={'theme-card' + (s.theme === t.id ? ' on' : '')}>
            <button type="button" className="theme-card-main" onPointerEnter={() => sound.hover()} onClick={(e) => changeTheme(t.id, { origin: originOf(e.currentTarget) })}>
              <span className="theme-card-swatch" style={{ background: `linear-gradient(140deg, ${t.preview[0]} 0%, ${t.preview[1]} 55%, ${t.preview[2]} 100%)` }}>
                <span className="theme-card-name" style={{ fontFamily: t.font.family, fontWeight: t.font.weight, letterSpacing: t.font.tracking, textTransform: t.font.upper ? 'uppercase' : 'none', fontVariationSettings: t.font.settings, color: t.dark ? '#fff' : '#0d2140' }}>
                  {t.name}
                </span>
                {s.theme === t.id && (
                  <span className="theme-card-now">
                    <Icon name="eye" size={13} /> Showing now
                  </span>
                )}
              </span>
              <span className="theme-card-mood">{t.mood}</span>
              <span className="theme-card-insp">{t.inspiredBy.replace(/^./, (c) => c.toUpperCase())}</span>
            </button>
            <label className="theme-card-rot">
              <input type="checkbox" checked={s.rotation.includes(t.id)} onChange={() => toggleRot(t.id)} />
              <span>In the rotation</span>
            </label>
          </div>
        ))}
      </div>
      <div className="set-card glass">
        <Toggle
          on={s.autoRotate}
          onChange={(v) => {
            set({ autoRotate: v });
            resetRotationClock();
          }}
          label="Change worlds on a timer"
          hint="Drifts to another world from the rotation. It waits while you’re writing a critique."
        />
        {s.autoRotate && (
          <>
            <Slider label="Every" value={s.rotateMinutes} min={1} max={60} onChange={(v) => { set({ rotateMinutes: v }); resetRotationClock(); }} format={(v) => `${v} minute${v === 1 ? '' : 's'}`} />
            <div className="set-row">
              <span>Order</span>
              <Segmented
                id="rotorder"
                size="sm"
                value={s.rotateOrder}
                onChange={(v) => set({ rotateOrder: v })}
                options={[
                  { value: 'random', label: 'Random' },
                  { value: 'sequence', label: 'In order' },
                ]}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SoundSection() {
  const s = useSettings((x) => x.s.sound);
  const set = useSettings((x) => x.set);
  const up = (p: Partial<typeof s>) => set((cur) => ({ sound: { ...cur.sound, ...p } }));
  return (
    <div className="set-section">
      <div className="set-head">
        <h2>Sound</h2>
      </div>
      <div className="set-card glass">
        <Toggle on={s.enabled} onChange={(v) => up({ enabled: v })} label="Sound" hint="Every sound in Iris is made live, with no audio files." />
        <Slider label="Volume" value={Math.round(s.volume * 100)} min={0} max={100} onChange={(v) => up({ volume: v / 100 })} format={(v) => v + '%'} />
      </div>
      <div className="set-card glass">
        <Toggle on={s.intro} onChange={(v) => up({ intro: v })} label="Opening sound" hint="The aperture clicks and the hit when Iris opens." />
        <Toggle on={s.ui} onChange={(v) => up({ ui: v })} label="Interface sounds" hint="Soft clicks, the score ring’s detents, and the chord when you save." />
        <Toggle on={s.ambience} onChange={(v) => up({ ambience: v })} label="World soundscapes" hint="Rain in Vigil, wind across Mirage, the sea in Wine-Dark Sea, and so on." />
        {s.ambience && <Slider label="Soundscape volume" value={Math.round(s.ambienceVolume * 100)} min={0} max={100} onChange={(v) => up({ ambienceVolume: v / 100 })} format={(v) => v + '%'} />}
      </div>
    </div>
  );
}

function StartupSection() {
  const s = useSettings((x) => x.s);
  const set = useSettings((x) => x.set);
  return (
    <div className="set-section">
      <div className="set-head">
        <h2>Startup and motion</h2>
      </div>
      <div className="set-card glass">
        <label className="field">
          <span className="field-label">What should Iris call you?</span>
          <input className="input" value={s.userName} maxLength={40} placeholder="Your first name" onChange={(e) => set({ userName: e.target.value })} />
        </label>
      </div>
      <div className="set-card glass">
        <div className="set-row">
          <span>
            Opening sequence
            <small>The aperture opening each time Iris starts.</small>
          </span>
          <Segmented
            id="intro"
            size="sm"
            value={s.intro}
            onChange={(v) => set({ intro: v })}
            options={[
              { value: 'full', label: 'Full' },
              { value: 'quick', label: 'Quick' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </div>
        <div className="set-row">
          <span>
            Motion and detail
            <small>{s.motion === 'full' ? 'Everything at full quality and 60 frames a second.' : s.motion === 'balanced' ? 'Lighter backgrounds, easier on the battery.' : 'Slow, gentle worlds and fewer animations.'}</small>
          </span>
          <Segmented
            id="motion"
            size="sm"
            value={s.motion}
            onChange={(v) => set({ motion: v })}
            options={[
              { value: 'full', label: 'Full' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'calm', label: 'Calm' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function BackupsSection() {
  const s = useSettings((x) => x.s.backup);
  const set = useSettings((x) => x.set);
  const lib = useLibrary((x) => x.lib);
  const [st, setSt] = useState<BackupStatus | null>(null);
  const refresh = useCallback(async () => setSt(await window.iris.backup.status()), []);
  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const chooseFolder = async () => {
    const f = await window.iris.backup.chooseFolder();
    if (!f) return;
    set((cur) => ({ backup: { ...cur.backup, folder: f, lastFullBackupAt: null } }));
    sound.confirm();
    useUi.getState().toast({ text: 'Backup folder set. Writing the first backup now.', tone: 'good' });
    setTimeout(refresh, 2500);
  };

  const restoreSnap = (name: string, when: number, n: number) => {
    useUi.getState().openModal({
      title: 'Restore this snapshot?',
      body: (
        <p>
          Your library goes back to how it was on {longDate(when)} at {new Date(when).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}, with {n} critique{n === 1 ? '' : 's'}. A snapshot of
          the current library is taken first, so you can undo this.
        </p>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Restore',
          tone: 'primary',
          run: async () => {
            const r = await window.iris.backup.restoreSnapshot(name);
            if (r.ok) {
              useLibrary.getState().setLibrary(r.library);
              sound.verdict('good');
              useUi.getState().toast({ text: 'Snapshot restored', tone: 'good' });
              void refresh();
            } else useUi.getState().toast({ text: r.error || 'Could not restore', tone: 'bad' });
          },
        },
      ],
    });
  };

  const lastSnap = st?.snapshots[0];
  return (
    <div className="set-section">
      <div className="set-head">
        <h2>Backups</h2>
        <Button variant="primary" icon="shield" onClick={() => backupNow().then(refresh)}>
          Back up now
        </Button>
      </div>

      <div className="backup-layers">
        <div className="layer glass">
          <span className="layer-icon ok">
            <Icon name="check" size={16} />
          </span>
          <div>
            <h3>Saved as you go</h3>
            <p>Every change is written to disk straight away, with a spare copy of the previous version in case a file is ever damaged.</p>
          </div>
        </div>
        <div className="layer glass">
          <span className={'layer-icon ' + (lastSnap ? 'ok' : '')}>
            <Icon name="clock" size={16} />
          </span>
          <div>
            <h3>Automatic snapshots on this Mac</h3>
            <p>
              {lastSnap
                ? `Last one ${relTime(lastSnap.createdAt)}, ${st!.snapshots.length} kept so far. Iris keeps the latest 40, one a day for 90 days, and one a month after that.`
                : 'Taken when Iris opens, every 15 minutes while you work, and when you quit.'}
            </p>
          </div>
        </div>
        <div className="layer glass">
          <span className={'layer-icon ' + (s.folder && st?.folderOk && !st.lastFullBackupError ? 'ok' : 'warn')}>
            <Icon name="cloud" size={16} />
          </span>
          <div className="layer-grow">
            <h3>Full backups off this Mac</h3>
            {s.folder ? (
              <>
                <p>
                  Written to <span className="path">{s.folder}</span>
                  {s.lastFullBackupAt ? `, last ${relTime(s.lastFullBackupAt)}.` : '.'} Iris keeps the newest {s.keep} and updates them every few hours and when you quit.
                </p>
                {st?.lastFullBackupError && <p className="warn-text">{st.lastFullBackupError}</p>}
                {st && !st.folderOk && <p className="warn-text">That folder can’t be found right now. If it’s on a drive, plug it in.</p>}
                <div className="layer-actions">
                  <Button size="sm" icon="folder" onClick={() => window.iris.backup.openFolder('mirror')}>
                    Show folder
                  </Button>
                  <Button size="sm" onClick={chooseFolder}>
                    Change folder
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => {
                      set((cur) => ({ backup: { ...cur.backup, folder: null } }));
                      void window.iris.backup.clearFolder();
                    }}
                  >
                    Stop
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p>Protects your critiques if this Mac is lost or its drive fails. Pick a folder that syncs somewhere else, like iCloud Drive or Dropbox, or one on a USB drive.</p>
                <div className="layer-actions">
                  <Button size="sm" variant="primary" icon="folder" onClick={chooseFolder}>
                    Choose a backup folder
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="set-card glass">
        <h3 className="card-title">Files you can keep anywhere</h3>
        <div className="file-actions">
          <Button icon="download" onClick={exportBackup}>
            Save a backup file
          </Button>
          <Button icon="upload" onClick={() => runImportFlow(null)}>
            Restore or import a backup
          </Button>
          <Button icon="list" onClick={exportCsv}>
            Export a spreadsheet
          </Button>
        </div>
        <p className="set-note">A backup file holds every critique, poster, list and draft. Double-click one, or drop it on the Iris window, to bring it back.</p>
      </div>

      <div className="set-card glass">
        <div className="set-row">
          <h3 className="card-title">Snapshots</h3>
          <Button size="sm" variant="quiet" icon="folder" onClick={() => window.iris.backup.openFolder('snapshots')}>
            Show in Finder
          </Button>
        </div>
        {st?.snapshots.length ? (
          <ul className="snap-list">
            {st.snapshots.slice(0, 30).map((sn) => (
              <li key={sn.name} className="snap">
                <span className="snap-when">
                  {longDate(sn.createdAt)}, {new Date(sn.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className="snap-what">
                  {sn.critiques} critique{sn.critiques === 1 ? '' : 's'}, {sn.watchlist} on Up Next
                </span>
                <span className="snap-why">{reasonText(sn.reason)}</span>
                <span className="snap-size">{bytes(sn.size)}</span>
                <Button size="sm" variant="glass" onClick={() => restoreSnap(sn.name, sn.createdAt, sn.critiques)}>
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="set-note">No snapshots yet. The first one is taken as soon as there’s something to protect.</p>
        )}
      </div>

      <div className="set-card glass">
        <h3 className="card-title">From the old Marquee app</h3>
        <p className="set-note">Iris looks for critiques saved in Marquee on this Mac the first time it opens. Run it again if you added more there since.</p>
        <Button
          size="sm"
          icon="refresh"
          onClick={async () => {
            const r = await window.iris.backup.legacyImport();
            useLibrary.getState().setLibrary(r.library);
            useUi.getState().toast({ text: r.imported ? `Brought over ${r.imported} item${r.imported === 1 ? '' : 's'} from Marquee` : r.sources.length ? 'Everything from Marquee is already here' : 'No Marquee data found on this Mac', tone: r.imported ? 'good' : 'info' });
          }}
        >
          Look again
        </Button>
        <p className="set-note dim">Library: {lib.critiques.length} critiques, {lib.watchlist.length} on Up Next, {lib.drafts.length} drafts.</p>
      </div>
    </div>
  );
}

function reasonText(r: string): string {
  if (r.startsWith('launch')) return 'When Iris opened';
  if (r.startsWith('quit')) return 'When Iris closed';
  if (r.startsWith('auto')) return 'While you worked';
  if (r.startsWith('manual')) return 'Backed up by you';
  if (r.startsWith('before-import')) return 'Before an import';
  if (r.startsWith('before-restore')) return 'Before a restore';
  return 'Snapshot';
}

function DeletedSection() {
  const trash = useLibrary((x) => x.lib.trash);
  const restore = useLibrary((x) => x.restoreTrash);
  const purge = useLibrary((x) => x.purgeTrash);
  return (
    <div className="set-section">
      <div className="set-head">
        <h2>Recently deleted</h2>
        {trash.length > 0 && (
          <Button
            variant="quiet"
            onClick={() =>
              useUi.getState().openModal({
                title: 'Delete these for good?',
                body: <p>{trash.length} item{trash.length === 1 ? '' : 's'} will be removed now instead of after 30 days. Snapshots still hold older copies.</p>,
                actions: [{ label: 'Cancel' }, { label: 'Delete for good', tone: 'danger', run: () => purge() }],
              })
            }
          >
            Empty
          </Button>
        )}
      </div>
      {trash.length === 0 ? (
        <p className="set-note">Nothing here. Deleted critiques and Up Next items wait here for 30 days.</p>
      ) : (
        <div className="trash-list">
          {trash.map((t) => (
            <div key={t.id} className="trash-item glass">
              <Poster title={t.item.title} type={t.item.type} poster={t.item.poster} size="sm" />
              <div className="trash-text">
                <span className="trash-title">{t.item.title}</span>
                <span className="trash-sub">
                  {t.kind === 'critique' ? 'Critique' : 'Up Next item'}, deleted {relTime(t.deletedAt)}. Kept until {longDate(t.deletedAt + 30 * 864e5)}.
                </span>
              </div>
              <Button
                size="sm"
                variant="primary"
                icon="undo"
                onClick={() => {
                  restore(t.id);
                  sound.confirm();
                }}
              >
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AboutSection() {
  const name = useSettings((x) => x.s.userName.trim());
  return (
    <div className="set-section">
      <div className="set-head">
        <h2>About Iris</h2>
      </div>
      <div className="set-card glass about">
        <p className="about-name display">Iris</p>
        <p>
          Version {appInfo.version}. {name ? `${name}’s` : 'Your'} archive of critiques for movies, shows and games.
        </p>
        <p className="set-note">
          Your data lives in <span className="path">{appInfo.dataFolder}</span>
        </p>
        <div className="file-actions">
          <Button size="sm" icon="folder" onClick={() => window.iris.backup.openFolder('data')}>
            Show data folder
          </Button>
          <Button size="sm" icon="keyboard" onClick={() => useUi.setState({ shortcutsOpen: true })}>
            Keyboard shortcuts
          </Button>
        </div>
        <p className="set-note dim">Title details and posters come from Wikipedia and Wikidata when you choose to look them up.</p>
      </div>
    </div>
  );
}
