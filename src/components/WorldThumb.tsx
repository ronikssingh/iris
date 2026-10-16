import type { CSSProperties, ReactNode } from 'react';
import { thumbOf, type ThemeDef } from '../themes/themes';

/** A world's name set in its own display face. */
export function worldFont(t: ThemeDef): CSSProperties {
  return {
    fontFamily: t.font.family,
    fontWeight: t.font.weight,
    letterSpacing: t.font.tracking,
    textTransform: t.font.upper ? 'uppercase' : 'none',
    fontVariationSettings: t.font.settings,
    fontSize: `calc(1em * ${t.font.scale})`,
  };
}

export const capFirst = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/** A still of a world, darkened along the bottom so a name can sit on it. */
export function WorldThumb({ t, className, children }: { t: ThemeDef; className?: string; children?: ReactNode }) {
  const url = thumbOf(t.id);
  return (
    <span
      className={'world-thumb' + (className ? ' ' + className : '')}
      style={{ backgroundImage: url ? `url(${url})` : `linear-gradient(140deg, ${t.preview.join(', ')})` }}
    >
      {children}
    </span>
  );
}
