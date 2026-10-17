import { useRef, useState } from 'react';
import { Poster } from '../../components/Poster';
import { Icon } from '../../components/Icon';
import { firstImageFile, savePoster, savePosterFromUrl } from '../../lib/images';
import { sound } from '../../lib/sound';
import type { MediaType } from '../../shared/model';

export function PosterInput({
  title,
  type,
  poster,
  onChange,
}: {
  title: string;
  type: MediaType | null;
  poster: string | null;
  onChange: (p: { poster: string | null; posterColor: string | null }) => void;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [url, setUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const take = async (fn: () => Promise<{ name: string; color: string } | null>) => {
    setBusy(true);
    setErr('');
    try {
      const r = await fn();
      if (r) {
        onChange({ poster: r.name, posterColor: r.color });
        sound.confirm();
      } else setErr('That link didn’t lead to an image Iris could download.');
    } catch {
      setErr('That image couldn’t be read. Try a JPEG or PNG.');
      sound.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={'poster-input' + (over ? ' over' : '') + (busy ? ' busy' : '')}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.items).some((i) => i.kind === 'file' || i.type === 'text/uri-list')) {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const f = firstImageFile(e.dataTransfer.files);
        if (f) return void take(() => savePoster(f));
        const link = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (/^https?:\/\//.test(link)) void take(() => savePosterFromUrl(link.trim(), true));
      }}
      onPaste={(e) => {
        const f = firstImageFile(e.clipboardData.items);
        if (f) {
          e.preventDefault();
          void take(() => savePoster(f));
        }
      }}
      tabIndex={0}
      aria-label="Poster or cover image. Drop an image, paste one, or choose a file."
    >
      <div className="pi-preview">
        <Poster title={title || 'Your title'} type={type ?? 'movie'} poster={poster} />
        {busy && <div className="pi-spinner" />}
      </div>
      <div className="pi-actions">
        <p className="pi-help">{poster ? 'Looking good. Drop another image to replace it.' : 'Drop a poster or cover here, paste one with ⌘V, or choose a file.'}</p>
        <div className="pi-buttons">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="image" size={15} /> <span>Choose image</span>
          </button>
          {poster && (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange({ poster: null, posterColor: null })}>
              <Icon name="close" size={15} /> <span>Remove</span>
            </button>
          )}
        </div>
        <form
          className="pi-url"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^https?:\/\//.test(url.trim())) void take(() => savePosterFromUrl(url.trim(), true));
          }}
        >
          <Icon name="link" size={14} />
          <input type="url" placeholder="Or paste an image link" value={url} onChange={(e) => setUrl(e.target.value)} />
        </form>
        {err && <p className="pi-err">{err}</p>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void take(() => savePoster(f));
          e.target.value = '';
        }}
      />
    </div>
  );
}
