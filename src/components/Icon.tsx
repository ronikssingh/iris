import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  movie: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M3 15h18M7 5v4M12 5v4M17 5v4M7 15v4M12 15v4M17 15v4"/>',
  show: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M9 3l3 3 3-3"/>',
  game: '<path d="M7 9h10a4 4 0 0 1 4 4v1.5a2.5 2.5 0 0 1-4.6 1.4L15 14H9l-1.4 1.9A2.5 2.5 0 0 1 3 14.5V13a4 4 0 0 1 4-4z"/><path d="M8 11.5v3M6.5 13h3"/><circle cx="15.5" cy="12" r=".6" fill="currentColor"/><circle cx="17.5" cy="13.6" r=".6" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  filter: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  sort: '<path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="8" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="8" rx="1.2"/><rect x="4" y="14.5" width="6.5" height="5.5" rx="1.2"/><rect x="13.5" y="14.5" width="6.5" height="5.5" rx="1.2"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><rect x="3.5" y="4.5" width="3" height="3" rx=".6"/><rect x="3.5" y="10.5" width="3" height="3" rx=".6"/><rect x="3.5" y="16.5" width="3" height="3" rx=".6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  left: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  right: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  down: '<path d="M5.5 9.5L12 16l6.5-6.5"/>',
  up: '<path d="M5.5 14.5L12 8l6.5 6.5"/>',
  back: '<path d="M20 12H5M11 5.5L4.5 12l6.5 6.5"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.7-3.3 2.9-5 5.5-5s4.8 1.7 5.5 5"/><circle cx="16.8" cy="9.5" r="2.6"/><path d="M15.6 14.2c2.3-.2 4.3 1.2 4.9 4.3"/>',
  userplus: '<circle cx="10" cy="8.5" r="3.4"/><path d="M4 19.5c.8-3.4 3.2-5.2 6-5.2s5.2 1.8 6 5.2M18.5 7.5v5M16 10h5"/>',
  send: '<path d="M4 11.5L20 4l-6.8 16-2.6-6.6z"/><path d="M10.6 13.4L20 4"/>',
  flame: '<path d="M12 21c-3.6 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.6-8.3.4 1.9 1.4 3 2.6 3.6.2-2.6 1.3-4.8 3.4-6.6-.2 3 1.5 4.6 2.6 6.3.9 1.4 1.3 2.9 1.3 4.5C19 18.3 15.9 21 12 21z"/><path d="M12 21c-1.6 0-2.8-1.2-2.8-2.9 0-1.9 1.6-2.8 2.4-4.6 1.4 1.3 3.2 2.5 3.2 4.6 0 1.7-1.2 2.9-2.8 2.9z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  reply: '<path d="M4.5 18.5V16c0-2 1.6-3.5 3.5-3.5h9.5M14 8.5l3.5 4-3.5 4"/><path d="M4 5.5h9"/>',
  heartfill: '<path fill="currentColor" d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  starfill: '<path fill="currentColor" d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  sparkle: '<path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z"/><path d="M19 15.5c.25 1.6 1 2.35 2.5 2.5-1.5.25-2.25 1-2.5 2.5-.25-1.5-1-2.25-2.5-2.5 1.5-.15 2.25-.9 2.5-2.5z"/>',
  shuffle: '<path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 3.8c1.1 1.6 2.3 2.6 4.3 2.6H21M3 17h3.5c1.4 0 2.4-.5 3.2-1.3M14.3 8.3C15.1 7.5 16.1 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  aperture: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5l3.1 9.5M20.1 9.4l-9.7 3M17.3 18.6l-6-8M6.7 18.6l3.8-9.4M3.9 9.4l9 4.6"/>',
  volume: '<path d="M4 10v4h3.5L12 18V6L7.5 10z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 10v4h3.5L12 18V6L7.5 10z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5"/><circle cx="12" cy="12" r="6.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19h14"/>',
  folder: '<path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2.2h8A1.5 1.5 0 0 1 20.5 8.7v9.8A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.4 4.6 4.6 0 0 0 7 18.5z"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.7-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.8-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.4-4.6"/>',
  undo: '<path d="M8 8.5H15a5 5 0 0 1 0 10H9"/><path d="M11 5L7.5 8.5 11 12"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-4.8-4.8L6 19.5"/>',
  link: '<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  wand: '<path d="M4 20L15 9M13.5 4.5v2M17.5 8.5h2M16.8 5.2l-1.4 1.4M9 4.5l.6 1.8M19.5 15l-1.8-.6"/><path d="M15 9l1.5-1.5"/>',
  grip: '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
  thumbUp: '<path d="M7.5 10.5V20H4.5v-9.5zM7.5 10.5l3.6-6.3a1.7 1.7 0 0 1 3.1 1.1L13.5 9.5h5.1a2 2 0 0 1 2 2.4l-1.3 6.4A2.2 2.2 0 0 1 17.1 20H7.5"/>',
  thumbDown: '<path d="M7.5 13.5V4H4.5v9.5zM7.5 13.5l3.6 6.3a1.7 1.7 0 0 0 3.1-1.1l-.7-4.2h5.1a2 2 0 0 0 2-2.4l-1.3-6.4A2.2 2.2 0 0 0 17.1 4H7.5"/>',
  quote: '<path d="M9.5 7.5C6.7 8.4 5 10.6 5 13.8V17h4.5v-4.5H7.3c0-1.8.9-3 2.7-3.6zM18.5 7.5c-2.8.9-4.5 3.1-4.5 6.3V17h4.5v-4.5h-2.2c0-1.8.9-3 2.7-3.6z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.4"/>',
  warning: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 0 1-13.4 4.6M4.5 12a7.5 7.5 0 0 1 13.4-4.6"/><path d="M18.3 3.5v4.2h-4.2M5.7 20.5v-4.2h4.2"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6.5 14h11"/>',
  lobby: '<path d="M4 10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4z"/>',
  archive: '<rect x="3.5" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><path d="M17 5.2l3.4 14.4"/>',
  pen: '<path d="M14.5 5.5l4 4L9 19H5v-4z"/><path d="M12.5 7.5l4 4"/>',
  crown: '<path d="M4 17.5l-1-10 5 4 4-6.5 4 6.5 5-4-1 10z"/><path d="M4.5 20.5h15"/>',
  queue: '<rect x="3.5" y="4" width="11" height="15" rx="1.5"/><path d="M17.5 6.5v11M20.5 8v8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  note: '<path d="M5 4.5h14v10l-5 5H5z"/><path d="M14 19.5v-5h5M8.5 9h7M8.5 12.5h4"/>',
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, className, style, stroke = 1.6 }: { name: string; size?: number; className?: string; style?: CSSProperties; stroke?: number }) {
  const d = P[name] ?? P.info;
  return (
    <svg
      className={'icon' + (className ? ' ' + className : '')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}

export const TYPE_ICON = { movie: 'movie', show: 'show', game: 'game' } as const;
