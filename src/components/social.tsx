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

const EMBLEMS: string[] = [
  // one little emblem per world, drawn on a 48 x 48 grid
  '<path d="M10 40V24l4-6 3 4 4-8 4 6 3-3 4 5v18z" fill="rgba(0,0,0,.45)"/><circle cx="33" cy="13" r="5" fill="#ffb199"/>', // Vigil
  '<circle cx="24" cy="21" r="9" fill="#fff6c8"/><path d="M6 36c6-4 11-4 18 0s12 4 18 0v12H6z" fill="rgba(255,255,255,.7)"/>', // Skyward
  '<circle cx="31" cy="17" r="7" fill="#ffe2a8"/><path d="M0 34c10-6 18-6 26-2s16 4 22 0v14H0z" fill="rgba(70,30,10,.55)"/>', // Mirage
  '<path d="M24 8l4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1z" fill="#fff36b" stroke="#120a2b" stroke-width="2"/>', // Glitch Pop
  '<path d="M4 30c5-4 9-4 14 0s9 4 14 0 9-4 14 0v18H4z" fill="rgba(10,40,60,.7)"/><path d="M14 30l10-18 10 18z" fill="rgba(255,225,170,.85)"/>', // Wine-Dark Sea
  '<path d="M24 8v32M10 16l28 16M38 16L10 32" stroke="#e8fbff" stroke-width="3" stroke-linecap="round"/>', // Fimbulwinter
  '<circle cx="24" cy="24" r="8" fill="#000"/><ellipse cx="24" cy="24" rx="17" ry="5" fill="none" stroke="#ffcf8a" stroke-width="2.5"/>', // Event Horizon
  '<circle cx="24" cy="22" r="10" fill="#ff7ac3"/><path d="M8 26h32M10 30h28M12 34h24" stroke="#1a0730" stroke-width="2.5"/>', // Midnight Drive
  '<rect x="13" y="10" width="22" height="28" rx="2" fill="none" stroke="#f3e2a8" stroke-width="2.5"/><path d="M13 16h22M13 32h22" stroke="#f3e2a8" stroke-width="2"/>', // Silver Screen
  '<path d="M24 8c6 8 10 12 10 19a10 10 0 0 1-20 0c0-4 2-7 4-10 1 3 3 4 4 4-1-5 0-9 2-13z" fill="#ffb65c"/>', // Ember Realm
  '<circle cx="30" cy="16" r="7" fill="#ffd38a"/><path d="M4 40V30h8v-6h10v6h6v-10h14v20z" fill="rgba(60,15,20,.75)"/>', // Sundown
  '<path d="M8 40l16-26 16 26z" fill="rgba(235,242,250,.9)"/><path d="M20 22v-8h3v-3h2v3h3v8z" fill="rgba(20,25,35,.8)"/>', // Frostkeep
  '<circle cx="14" cy="14" r="5" fill="#f4f0dc"/><path d="M26 40V24l3-6 3 6v16zM34 40V28l2.5-5 2.5 5v12zM18 40V30l2.5-4 2.5 4v10z" fill="rgba(10,10,30,.75)"/>', // Moonspire
  '<path d="M10 18h28M12 22h24M15 22v18M33 22v18" stroke="#d6332a" stroke-width="3.5" stroke-linecap="round"/><circle cx="34" cy="10" r="3" fill="#ffd1df"/><circle cx="12" cy="9" r="2" fill="#ffd1df"/>', // Hanami
  '<path d="M20 40c2-9 3-16 2-24" stroke="#1b3d2a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M22 16c-6-3-11-1-14 3M22 16c5-4 11-3 15 1M22 16c-2-5-1-9 3-11M22 16c-5 1-8 5-8 9M22 16c5 1 8 5 8 9" stroke="#1b3d2a" stroke-width="2.5" fill="none" stroke-linecap="round"/>', // Lagoon
  '<path d="M14 40V6M24 40V10M34 40V4" stroke="rgba(0,0,0,.55)" stroke-width="4"/><circle cx="29" cy="24" r="1.6" fill="#d9ff8a"/><circle cx="18" cy="31" r="1.3" fill="#d9ff8a"/>', // Hollow Pines
];

export const PRESET_COUNT = EMBLEMS.length;

function presetSvg(n: number): string {
  const i = ((n - 1) % EMBLEMS.length + EMBLEMS.length) % EMBLEMS.length;
  const t = THEMES[i];
  const [a, b, c] = t.preview;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="48" height="48" fill="url(#g${i})"/>${EMBLEMS[i]}</svg>`;
}

export function Avatar({ src, size = 40, name, ring }: { src: string | null | undefined; size?: number; name?: string; ring?: boolean }) {
  const preset = !src || src.startsWith('preset:') ? Number((src ?? 'preset:1').split(':')[1]) || 1 : null;
  return (
    <span className={'avatar' + (ring ? ' ring' : '')} style={{ width: size, height: size }} title={name}>
      {preset !== null ? <span className="avatar-art" dangerouslySetInnerHTML={{ __html: presetSvg(preset) }} /> : <img src={src!} alt="" draggable={false} referrerPolicy="no-referrer" />}
    </span>
  );
}

export function AvatarPicker({ value, onChange }: { value: string; onChange: (v: string, file?: Blob) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File) => {
    setBusy(true);
    try {
      const blob = await squareCrop(f, 512);
      onChange(URL.createObjectURL(blob), blob);
    } catch {
      useUi.getState().toast({ text: 'That picture couldn’t be opened. Try a JPEG or PNG.', tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="avatar-picker">
      {Array.from({ length: PRESET_COUNT }, (_, i) => {
        const v = 'preset:' + (i + 1);
        return (
          <button key={v} type="button" className={'avatar-choice' + (value === v ? ' on' : '')} onClick={() => onChange(v)} aria-label={`Picture ${i + 1}, ${THEMES[i].name}`}>
            <Avatar src={v} size={52} />
          </button>
        );
      })}
      <button type="button" className={'avatar-choice upload' + (!value.startsWith('preset:') ? ' on' : '')} onClick={() => fileRef.current?.click()} disabled={busy}>
        {!value.startsWith('preset:') ? <Avatar src={value} size={52} /> : <Icon name="upload" size={20} />}
        <span>{busy ? 'Opening…' : 'Your own'}</span>
      </button>
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

/** Crops the middle square of a picture and shrinks it to `size` pixels. */
async function squareCrop(f: Blob, size: number): Promise<Blob> {
  const bmp = await createImageBitmap(f);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  bmp.close?.();
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('crop failed'))), 'image/jpeg', 0.88));
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
