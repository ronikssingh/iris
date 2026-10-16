import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSettings } from '../state/settings';
import { useLibrary } from '../state/library';
import { useUi } from '../state/ui';
import { Button, ApertureMark } from '../components/ui';
import { Icon } from '../components/Icon';
import { THEMES } from '../themes/themes';
import { WorldThumb, worldFont } from '../components/WorldThumb';
import { changeTheme } from '../themes/controller';
import { originOf } from './TopBar';
import { runImportFlow } from '../lib/actions';
import { sound } from '../lib/sound';

/** First launch only: a name, somewhere safe for backups, and a first world. */
export function Onboarding() {
  const s = useSettings((x) => x.s);
  const set = useSettings((x) => x.set);
  const count = useLibrary((x) => x.lib.critiques.length);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(s.userName);

  const finish = () => {
    set({ firstRunDone: true, userName: name.trim() });
    sound.confirm();
    useUi.setState({ onboarding: false });
  };
  const next = () => {
    sound.whoosh(1);
    if (step === 0) set({ userName: name.trim() });
    if (step >= 2) finish();
    else setStep(step + 1);
  };

  return (
    <motion.div className="onboard-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(10px)' }} transition={{ duration: 0.6 }}>
      <motion.div className="onboard glass" initial={{ y: 30, scale: 0.96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.2 }}>
        <div className="onboard-steps" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={'ob-dot' + (i === step ? ' on' : i < step ? ' done' : '')} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={step} className="onboard-body" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.35 }}>
            {step === 0 && (
              <>
                <ApertureMark size={64} />
                <h2 className="display">Welcome to Iris</h2>
                <p>Your own archive of movies, shows and games, judged out of a thousand. What should Iris call you?</p>
                <input
                  className="input input-name"
                  autoFocus
                  value={name}
                  placeholder="Your first name"
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && next()}
                />
                {count > 0 && (
                  <p className="onboard-found">
                    <Icon name="check" size={15} /> {count} critique{count === 1 ? '' : 's'} already came along with you.
                  </p>
                )}
              </>
            )}
            {step === 1 && (
              <>
                <span className="onboard-icon">
                  <Icon name="shield" size={34} stroke={1.3} />
                </span>
                <h2 className="display">Keep your critiques safe</h2>
                <p>Iris saves as you type and keeps snapshots on this Mac. For real peace of mind, pick a folder that syncs somewhere else, such as iCloud Drive, and Iris will keep full backups there too.</p>
                <div className="onboard-actions">
                  <Button
                    variant="primary"
                    icon="folder"
                    onClick={async () => {
                      const f = await window.iris.backup.chooseFolder();
                      if (f) {
                        set((cur) => ({ backup: { ...cur.backup, folder: f, lastFullBackupAt: null } }));
                        sound.confirm();
                        next();
                      }
                    }}
                  >
                    Choose a backup folder
                  </Button>
                  <Button icon="upload" onClick={() => runImportFlow(null)}>
                    I have a backup file
                  </Button>
                </div>
                {s.backup.folder && <p className="onboard-found">Backing up to {s.backup.folder}</p>}
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="display">Pick your first world</h2>
                <p>You can change it any time from the top bar, or let Iris drift between worlds on a timer.</p>
                <div className="onboard-themes">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={'ob-theme' + (s.theme === t.id ? ' on' : '')}
                      title={t.mood}
                      onClick={(e) => changeTheme(t.id, { origin: originOf(e.currentTarget) })}
                    >
                      <WorldThumb t={t} className="ob-thumb">
                        <span className="world-name" style={worldFont(t)}>
                          {t.name}
                        </span>
                      </WorldThumb>
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="onboard-foot">
          {step > 0 ? (
            <Button variant="quiet" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button variant="primary" iconRight={step < 2 ? 'right' : undefined} icon={step === 2 ? 'check' : undefined} onClick={next}>
            {step === 0 ? (name.trim() ? `Nice to meet you, ${name.trim()}` : 'Continue') : step === 1 ? (s.backup.folder ? 'Continue' : 'Skip for now') : 'Begin'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
