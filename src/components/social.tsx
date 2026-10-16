/* Pieces shared by the friends pages: profile pictures, likes, replies and sending a title to a friend. */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { Icon } from './Icon';
import { Button, AutoTextarea } from './ui';
import { THEMES } from '../themes/themes';
import { useOnline, onlineActions, friendIds, nameOf } from '../state/online';
import { useUi } from '../state/ui';
import { explain, type Profile, type Reply } from '../online/api';
import { relTime } from '../lib/format';
import { sound } from '../lib/sound';
import type { MediaType } from '../shared/model';

/* --------------------------------------------------------- Profile pictures */

/* A circle cut from each world, rendered from its shader. Stored on a profile as 'world:<id>'. */
const WORLD_PICS = import.meta.glob('./avatars/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const worldPic = (id: string): string | null => WORLD_PICS[`./avatars/${id}.webp`] ?? null;

/* Iris 1.1 stored its sixteen emblems as 'preset:N', in the order of its worlds; each maps to the nearest 1.2 world. */
const PRESET_WORLDS = ['vigil', 'skyward', 'mirage', 'glitchpop', 'winedark', 'fimbulwinter', 'eventhorizon', 'midnightdrive', 'silverscreen', 'emberrealm', 'sundown', 'fimbulwinter', 'lanternmere', 'spiritgrove', 'moonwake', 'gloamwood'];

/** The picture to show for a stored avatar value: a world, an uploaded picture's address, or the default. */
export function avatarSrc(v: string | null | undefined): string | null {
  if (v && /^https?:\/\/|^blob:/.test(v)) return v;
  if (v?.startsWith('world:')) return worldPic(v.slice(6)) ?? worldPic('winedark');
  if (v?.startsWith('preset:')) return worldPic(PRESET_WORLDS[(Number(v.slice(7)) - 1 + 64) % PRESET_WORLDS.length] ?? 'winedark');
  return worldPic('winedark');
}

export function Avatar({ src, size = 40, name, ring }: { src: string | null | undefined; size?: number; name?: string; ring?: boolean }) {
  const [broken, setBroken] = useState(false);
  const url = broken ? avatarSrc('world:winedark') : avatarSrc(src);
  return (
    <span className={'avatar' + (ring ? ' ring' : '')} style={{ width: size, height: size }} title={name}>
      {url && <img src={url} alt="" draggable={false} referrerPolicy="no-referrer" onError={() => setBroken(true)} />}
    </span>
  );
}

export function AvatarPicker({ value, onChange }: { value: string; onChange: (v: string, file?: Blob) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const own = !!value && !value.startsWith('world:') && !value.startsWith('preset:');
  const pick = async (f: File) => {
    const blob = await cropPicture(f).catch(() => {
      useUi.getState().toast({ text: 'That picture couldn’t be opened. Try a JPEG or PNG.', tone: 'bad' });
      return null;
    });
    if (blob) onChange(URL.createObjectURL(blob), blob);
  };
  return (
    <div className="avatar-picker">
      <button type="button" className={'avatar-choice upload' + (own ? ' on' : '')} onClick={() => fileRef.current?.click()} title="Use a picture of your own">
        {own ? <Avatar src={value} size={52} /> : <Icon name="upload" size={20} />}
        <span>Your own</span>
      </button>
      {THEMES.map((t) => {
        const v = 'world:' + t.id;
        return (
          <button key={v} type="button" className={'avatar-choice' + (value === v ? ' on' : '')} onClick={() => onChange(v)} title={t.name} aria-label={`${t.name} picture`}>
            <Avatar src={v} size={52} />
          </button>
        );
      })}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Opens a picture and lets the person move and zoom it inside a circle. Resolves with a 512 px square, or null. */
export async function cropPicture(f: Blob): Promise<Blob | null> {
  const bmp = await createImageBitmap(f);
  return new Promise<Blob | null>((resolve) => {
    let done = false;
    const finish = (b: Blob | null) => {
      if (done) return;
      done = true;
      bmp.close?.();
      resolve(b);
    };
    useUi.getState().openModal({
      title: 'Fit your picture in the circle',
      body: <CropBody bmp={bmp} onDone={(b) => { finish(b); useUi.getState().closeModal(); }} />,
      actions: [],
      onClose: () => finish(null),
    });
  });
}

const STAGE = 300;

function CropBody({ bmp, onDone }: { bmp: ImageBitmap; onDone: (b: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const base = Math.max(STAGE / bmp.width, STAGE / bmp.height); // the picture just covers the circle at zoom 1
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 }); // the picture's centre, from the circle's centre, in stage pixels
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const k = base * zoom;
  // keep the circle covered whatever the zoom
  const clamp = (o: { x: number; y: number }, z = zoom) => {
    const mx = Math.max(0, (bmp.width * base * z - STAGE) / 2);
    const my = Math.max(0, (bmp.height * base * z - STAGE) / 2);
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  };
  useEffect(() => {
    const c = canvasRef.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = STAGE * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, STAGE, STAGE);
    g.imageSmoothingQuality = 'high';
    const w = bmp.width * k;
    const h = bmp.height * k;
    g.drawImage(bmp, STAGE / 2 + off.x - w / 2, STAGE / 2 + off.y - h / 2, w, h);
  }, [bmp, k, off]);
  const setZoomClamped = (z: number) => {
    const nz = Math.min(4, Math.max(1, z));
    setZoom(nz);
    setOff((o) => clamp(o, nz));
  };
  const save = () => {
    const out = document.createElement('canvas');
    out.width = out.height = 512;
    const g = out.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    // the stage square, in the picture's own pixels
    const sx = bmp.width / 2 - (STAGE / 2 + off.x) / k;
    const sy = bmp.height / 2 - (STAGE / 2 + off.y) / k;
    g.drawImage(bmp, sx, sy, STAGE / k, STAGE / k, 0, 0, 512, 512);
    out.toBlob((b) => onDone(b), 'image/jpeg', 0.9);
  };
  return (
    <div className="crop">
      <div
        className="crop-stage"
        style={{ width: STAGE, height: STAGE }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) setOff(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }));
        }}
        onPointerUp={() => (drag.current = null)}
        onWheel={(e) => setZoomClamped(zoom * Math.exp(-e.deltaY * 0.0015))}
      >
        <canvas ref={canvasRef} style={{ width: STAGE, height: STAGE }} />
        <span className="crop-ring" />
      </div>
      <label className="crop-zoom">
        <Icon name="image" size={14} />
        <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoomClamped(Number(e.target.value))} aria-label="Zoom" />
        <Icon name="image" size={20} />
      </label>
      <p className="crop-hint">Drag to move it, scroll or use the slider to zoom.</p>
      <div className="modal-actions">
        <Button onClick={() => onDone(null)}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={save}>
          Use this picture
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Likes */

export function LikeButton({ owner, critiqueId }: { owner: string; critiqueId: string }) {
  const me = useOnline((s) => s.me?.id);
  const likes = useOnline(useShallow((s) => s.likes.filter((l) => l.owner === owner && l.critiqueId === critiqueId)));
  const people = useOnline((s) => s.people);
  const mine = likes.some((l) => l.userId === me);
  const names = likes.map((l) => (l.userId === me ? 'You' : nameOf(people[l.userId])));
  return (
    <motion.button
      type="button"
      className={'like-btn' + (mine ? ' on' : '')}
      whileTap={{ scale: 0.85 }}
      title={names.length ? 'Liked by ' + names.join(', ') : 'Like'}
      onClick={(e) => {
        e.stopPropagation();
        if (!mine) sound.confirm();
        void onlineActions.toggleLike(owner, critiqueId);
      }}
    >
      <motion.span key={String(mine)} initial={mine ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }}>
        <Icon name={mine ? 'heartfill' : 'heart'} size={17} />
      </motion.span>
      {likes.length > 0 && <span>{likes.length}</span>}
    </motion.button>
  );
}

/* ---------------------------------------------------------------- Replies */

export function Replies({ owner, critiqueId }: { owner: string; critiqueId: string }) {
  const me = useOnline((s) => s.me?.id);
  const people = useOnline((s) => s.people);
  const [list, setList] = useState<Reply[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => setList(await onlineActions.replies(owner, critiqueId).catch(() => []));
  useEffect(() => {
    void load();
  }, [owner, critiqueId]);
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await onlineActions.reply(owner, critiqueId, body);
      setText('');
      sound.confirm();
      await load();
    } catch (e) {
      useUi.getState().toast({ text: explain(e), tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="replies">
      {list === null && <p className="replies-empty">Loading replies…</p>}
      {list?.length === 0 && <p className="replies-empty">No replies yet.</p>}
      {list?.map((r) => (
        <div key={r.id} className="reply">
          <Avatar src={people[r.userId]?.avatar} size={30} />
          <div className="reply-body">
            <span className="reply-who">
              {r.userId === me ? 'You' : nameOf(people[r.userId])} <span className="reply-when">{relTime(r.createdAt)}</span>
            </span>
            <p>{r.body}</p>
          </div>
          {(r.userId === me || owner === me) && (
            <button
              type="button"
              className="reply-del"
              aria-label="Delete reply"
              onClick={async () => {
                await onlineActions.deleteReply(owner, critiqueId, r.id).catch(() => {});
                await load();
              }}
            >
              <Icon name="close" size={13} />
            </button>
          )}
        </div>
      ))}
      <div className="reply-new">
        <AutoTextarea
          className="input"
          minRows={1}
          maxLength={500}
          value={text}
          placeholder="Write a reply"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button variant="primary" icon="send" disabled={!text.trim() || busy} onClick={send}>
          Reply
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ Suggest to a friend */

export interface Suggestable {
  title: string;
  type: MediaType;
  year: string;
  extKey: string | null;
  posterUrl: string | null;
}

function SuggestBody({ item, done }: { item: Suggestable; done: () => void }) {
  const ids = useOnline(useShallow((s) => friendIds(s)));
  const people = useOnline((s) => s.people);
  const [to, setTo] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!ids.length) return <p className="muted">Add a friend first, then you can send them titles.</p>;
  return (
    <div className="suggest">
      <div className="suggest-people">
        {ids.map((id) => (
          <button key={id} type="button" className={'person-chip' + (to.includes(id) ? ' on' : '')} onClick={() => setTo((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))}>
            <Avatar src={people[id]?.avatar} size={26} />
            {nameOf(people[id])}
            {to.includes(id) && <Icon name="check" size={14} />}
          </button>
        ))}
      </div>
      <AutoTextarea className="input" minRows={2} maxLength={200} value={note} placeholder="Add a note, like why they’ll love it (optional)" onChange={(e) => setNote(e.target.value)} />
      <div className="modal-actions">
        <Button onClick={done}>Cancel</Button>
        <Button
          variant="primary"
          icon="send"
          disabled={!to.length || busy}
          onClick={async () => {
            setBusy(true);
            try {
              for (const id of to) await onlineActions.suggest(id, item, note.trim());
              sound.confirm();
              useUi.getState().toast({ text: `Sent ${item.title} to ${to.map((id) => nameOf(people[id])).join(', ')}`, tone: 'good' });
              done();
            } catch (e) {
              useUi.getState().toast({ text: explain(e), tone: 'bad' });
            } finally {
              setBusy(false);
            }
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
}

export function openSuggest(item: Suggestable) {
  const close = () => useUi.getState().closeModal();
  useUi.getState().openModal({ title: `Suggest ${item.title} to a friend`, body: <SuggestBody item={item} done={close} />, actions: [] });
}

export function PersonRow({ p, children, onClick }: { p: Profile | undefined; children?: ReactElement | ReactElement[] | false | null; onClick?: () => void }) {
  return (
    <div className={'person-row' + (onClick ? ' clickable' : '')} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <Avatar src={p?.avatar} size={42} />
      <span className="person-text">
        <span className="person-name">{p?.displayName || p?.username || 'Someone'}</span>
        <span className="person-handle">@{p?.username ?? '…'}</span>
      </span>
      <span className="person-actions" onClick={(e) => e.stopPropagation()}>
        {children}
      </span>
    </div>
  );
}
