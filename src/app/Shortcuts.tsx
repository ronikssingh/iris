import { useUi } from '../state/ui';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../components/Icon';
import { appInfo } from '../lib/appInfo';

export function Shortcuts() {
  const open = useUi((s) => s.shortcutsOpen);
  const close = () => useUi.setState({ shortcutsOpen: false });
  const mod = appInfo.platform === 'darwin' ? '⌘' : 'Ctrl+';
  const rows: [string, string][] = [
    [`${mod}1 to ${mod}5`, 'Lobby, Critiques, Write, Masterpieces, Up Next'],
    [`${mod}N`, 'New critique'],
    [`${mod}F`, 'Search your critiques'],
    [`${mod}T`, 'Next world'],
    [`${mod}⇧T`, 'Surprise me with a world'],
    [`${mod}⇧M`, 'Sound on or off'],
    [`${mod}${appInfo.platform === 'darwin' ? '⌥' : 'Alt+'}B`, 'Back up now'],
    [`${mod},`, 'Settings'],
    ['← →', 'Previous or next critique, on a critique'],
    ['E', 'Edit, on a critique'],
    [`${mod}J`, 'Open personal comments while writing'],
    [`${mod}↩  or  ⌥→`, 'Next step while writing'],
    [`${mod}S`, 'Save the critique'],
    ['Arrow keys or numbers', 'Set a score on the ring'],
  ];
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && close()} onKeyDown={(e) => e.key === 'Escape' && close()}>
          <motion.div className="modal wide shortcuts" initial={{ y: 20, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 10, opacity: 0 }}>
            <div className="set-row">
              <h2 className="modal-title">Keyboard shortcuts</h2>
              <button type="button" className="icon-btn" onClick={close} aria-label="Close" autoFocus>
                <Icon name="close" size={16} />
              </button>
            </div>
            <dl className="keys">
              {rows.map(([k, v]) => (
                <div key={k} className="key-row">
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
