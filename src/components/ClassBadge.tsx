import { CLASS_BY_KEY, type ClassKey } from '../shared/model';

export const CLASS_COLOR: Record<ClassKey, string> = {
  masterpiece: '#f4c95d',
  perfect: '#c9d6ff',
  great: '#36d399',
  good: '#5b9bff',
  average: '#aab3c0',
  below: '#e9944a',
  terrible: '#ff5d5d',
};

export function ClassBadge({ cls, size = 'md', chosen }: { cls: ClassKey; size?: 'sm' | 'md' | 'lg'; chosen?: boolean }) {
  return (
    <span className={`cls cls-${cls} cls-${size}`} title={chosen ? 'Class chosen by you' : undefined}>
      {cls === 'masterpiece' && (
        <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
          <path fill="currentColor" d="M12 2.5c.7 4.8 3.2 7.3 8 8-4.8.7-7.3 3.2-8 8-.7-4.8-3.2-7.3-8-8 4.8-.7 7.3-3.2 8-8z" />
        </svg>
      )}
      <span className="cls-label">{CLASS_BY_KEY[cls].label}</span>
      {chosen && <span className="cls-chosen" aria-label="chosen by you" />}
    </span>
  );
}
