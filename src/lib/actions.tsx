/* App-wide actions shared by menus, keyboard shortcuts and buttons. */
import { useLibrary } from '../state/library';
import { useSettings } from '../state/settings';
import { useUi } from '../state/ui';
import { sound } from './sound';
import { longDate } from './format';
import type { ImportPreview } from '../shared/ipc';

export function previewText(p: ImportPreview): string {
  const bits: string[] = [];
  bits.push(`${p.critiques} critique${p.critiques === 1 ? '' : 's'}`);
  if (p.watchlist) bits.push(`${p.watchlist} on Up Next`);
  if (p.drafts) bits.push(`${p.drafts} draft${p.drafts === 1 ? '' : 's'}`);
  return bits.join(', ');
}

export async function runImportFlow(file: string | null) {
  const ui = useUi.getState();
  let preview: (ImportPreview & { error?: string }) | null = null;
  if (file) preview = (await window.iris.backup.previewImport(file)) as any;
  else preview = (await window.iris.backup.pickImport()) as any;
  if (!preview) return;
  if (preview.error) {
    sound.error();
    ui.openModal({ title: 'That file can’t be opened', body: <p>{preview.error}</p> });
    return;
  }
  const p = preview;
  const from = p.appVersion === 'Marquee' ? 'your old Marquee app' : p.createdAt ? longDate(p.createdAt) : 'an earlier copy';
  ui.openModal({
    title: 'Bring this backup into Iris?',
    body: (
      <div className="import-preview">
        <p>
          This backup is from {from} and holds {previewText(p)}.
        </p>
        {p.titles.length > 0 && (
          <ul className="import-titles">
            {p.titles.map((t) => (
              <li key={t}>{t}</li>
            ))}
            {p.critiques > p.titles.length && <li className="dim">and {p.critiques - p.titles.length} more</li>}
          </ul>
        )}
        <p className="dim">
          Adding keeps everything you have and brings in anything new. Replacing swaps your whole library for this backup. A snapshot of your current library is saved first either way.
        </p>
      </div>
    ),
    actions: [
      { label: 'Cancel' },
      {
        label: 'Replace everything',
        tone: 'danger',
        run: async () => {
          const r = await window.iris.backup.runImport(p.file, 'replace');
          finishImport(r);
        },
      },
      {
        label: 'Add to my library',
        tone: 'primary',
        run: async () => {
          const r = await window.iris.backup.runImport(p.file, 'merge');
          finishImport(r);
        },
      },
    ],
  });
}

function finishImport(r: Awaited<ReturnType<typeof window.iris.backup.runImport>>) {
  const ui = useUi.getState();
  if (!r.ok) {
    sound.error();
    ui.toast({ text: r.error || 'The backup could not be imported.', tone: 'bad' });
    return;
  }
  useLibrary.getState().setLibrary(r.library);
  if (r.settings) useSettings.getState().replace(r.settings);
  sound.verdict('great');
  const what = r.mode === 'replace' ? `Restored ${r.added} critique${r.added === 1 ? '' : 's'}` : r.added || r.updated ? `Added ${r.added}, updated ${r.updated}` : 'Everything in that backup was already here';
  ui.toast({ text: what, tone: 'good' });
}

export async function backupNow() {
  const ui = useUi.getState();
  const s = useSettings.getState().s;
  const snap = await window.iris.backup.snapshotNow('manual');
  if (s.backup.folder) {
    const r = await window.iris.backup.fullBackupNow();
    if (r.ok) {
      sound.confirm();
      useSettings.getState().set({ backup: { ...useSettings.getState().s.backup, lastFullBackupAt: Date.now() } });
      ui.toast({ text: 'Backed up to your backup folder and saved a snapshot', tone: 'good' });
    } else {
      sound.error();
      ui.toast({ text: r.error || 'Could not write to the backup folder', tone: 'bad' });
    }
  } else {
    sound.confirm();
    ui.toast({
      text: snap ? 'Snapshot saved on this Mac' : 'Nothing has changed since the last snapshot',
      tone: 'good',
      action: { label: 'Set up backups', run: () => ui.go({ name: 'settings', section: 'backups' }) },
    });
  }
}

export async function exportBackup() {
  const r = await window.iris.backup.exportTo();
  if (r.canceled) return;
  const ui = useUi.getState();
  if (r.ok) {
    sound.confirm();
    ui.toast({ text: 'Backup file saved', tone: 'good' });
  } else {
    sound.error();
    ui.toast({ text: r.error || 'Could not save the backup', tone: 'bad' });
  }
}

export async function exportCsv() {
  const r = await window.iris.backup.exportCsv();
  if (r.ok) {
    sound.confirm();
    useUi.getState().toast({ text: 'Spreadsheet saved', tone: 'good' });
  }
}
