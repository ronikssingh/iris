import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';
import { sound } from '../lib/sound';
import { useUi } from '../state/ui';

/* ------------------------------------------------------------ Button */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger' | 'glass';
  icon?: string;
  iconRight?: string;
  size?: 'sm' | 'md' | 'lg';
  silent?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'ghost', icon, iconRight, size = 'md', className, children, onClick, silent, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`btn btn-${variant} btn-${size} ${children ? '' : 'btn-icon'} ${className ?? ''}`}
      onClick={(e) => {
        if (!silent) sound.click();
        onClick?.(e);
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : size === 'sm' ? 15 : 17} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'lg' ? 20 : 16} />}
    </button>
  );
});

/* ---------------------------------------------------------- Tilt card */

export function Tilt({ children, className, max = 9, style, onClick, glare = true }: { children: ReactNode; className?: string; max?: number; style?: CSSProperties; onClick?: () => void; glare?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.setProperty('--rx', `${(0.5 - y) * max}deg`);
      el.style.setProperty('--ry', `${(x - 0.5) * max}deg`);
      el.style.setProperty('--gx', `${x * 100}%`);
      el.style.setProperty('--gy', `${y * 100}%`);
    });
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(raf.current);
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  return (
    <div ref={ref} className={`tilt ${className ?? ''}`} style={style} onPointerMove={onMove} onPointerLeave={onLeave} onClick={onClick}>
      {children}
      {glare && <div className="tilt-glare" />}
    </div>
  );
}

/* ---------------------------------------------------------- Segmented */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode; icon?: string; title?: string }[];
  onChange: (v: T) => void;
  id: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={`seg seg-${size}`} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            className={'seg-opt' + (on ? ' on' : '')}
            onClick={() => {
              if (!on) sound.click();
              onChange(o.value);
            }}
          >
            {on && <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
            {o.icon && <Icon name={o.icon} size={15} />}
            {o.label && <span className="seg-label">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- Toggle */

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="toggle-row">
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {hint && <span className="toggle-hint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={'toggle' + (on ? ' on' : '')}
        onClick={() => {
          sound.toggle(!on);
          onChange(!on);
        }}
      >
        <motion.span className="toggle-knob" layout transition={{ type: 'spring', stiffness: 600, damping: 34 }} />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------- Slider */

export function Slider({ value, min, max, step = 1, onChange, label, format }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label?: string; format?: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      {label && (
        <div className="slider-head">
          <span>{label}</span>
          <span className="slider-val">{format ? format(value) : value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--pct' as any]: pct + '%' }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/* ------------------------------------------------------------ Popover */

export function Popover({
  open,
  onClose,
  anchor,
  children,
  align = 'start',
  width,
}: {
  open: boolean;
  onClose: () => void;
  anchor: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: 'start' | 'end';
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current!.getBoundingClientRect();
      const w = width ?? 320;
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.max(12, Math.min(window.innerWidth - w - 12, left));
      const top = r.bottom + 8;
      setPos({ top, left, maxH: window.innerHeight - top - 16 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, anchor, align, width]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchor]);
  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={ref}
          className="popover"
          style={{ top: pos.top, left: pos.left, width: width ?? 320, maxHeight: pos.maxH }}
          initial={{ opacity: 0, y: -8, scale: 0.97, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -6, scale: 0.98, filter: 'blur(4px)' }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ------------------------------------------------------------- Inputs */

export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }>(function AutoTextarea(props, outer) {
  const { minRows = 3, ...rest } = props;
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight + 2, minRows * 26) + 'px';
  }, [props.value, minRows]);
  return (
    <textarea
      {...rest}
      rows={minRows}
      ref={(el) => {
        ref.current = el;
        if (typeof outer === 'function') outer(el);
        else if (outer) outer.current = el;
      }}
    />
  );
});

/* ------------------------------------------------------- Modal & toasts */

export function ModalHost() {
  const modal = useUi((s) => s.modal);
  const close = useUi((s) => s.closeModal);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, close]);
  return createPortal(
    <AnimatePresence>
      {modal && (
        <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && close()}>
          <motion.div
            className={'modal' + (modal.wide ? ' wide' : '')}
            role="dialog"
            aria-modal="true"
            aria-label={modal.title}
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 12, scale: 0.98, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <h2 className="modal-title">{modal.title}</h2>
            {modal.body && <div className="modal-body">{modal.body}</div>}
            {modal.actions?.length !== 0 && <div className="modal-actions">
              {(modal.actions ?? [{ label: 'Close' }]).map((a, i) => (
                <Button
                  key={i}
                  variant={a.tone === 'primary' ? 'primary' : a.tone === 'danger' ? 'danger' : 'ghost'}
                  disabled={busy}
                  autoFocus={a.tone === 'primary' || a.tone === 'danger'}
                  onClick={async () => {
                    if (!a.run) return close();
                    setBusy(true);
                    try {
                      const r = await a.run();
                      if (r !== false) useUi.setState({ modal: null });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {a.label}
                </Button>
              ))}
            </div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return createPortal(
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={'toast toast-' + (t.tone ?? 'info')}
            initial={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 10, scale: 0.95, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            <span className="toast-text">{t.text}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <Icon name="close" size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/* ----------------------------------------------------------- Wordmark */

export function ApertureMark({ size = 28, spin = false }: { size?: number; spin?: boolean }) {
  const blades = 7;
  const R = 50;
  const r = 19;
  const paths: ReactElement[] = [];
  for (let i = 0; i < blades; i++) {
    const a0 = (i / blades) * Math.PI * 2;
    const a1 = ((i + 1) / blades) * Math.PI * 2;
    const p0 = [50 + Math.cos(a0) * r, 50 + Math.sin(a0) * r];
    const p1 = [50 + Math.cos(a1) * r, 50 + Math.sin(a1) * r];
    const dir = [p1[0] - p0[0], p1[1] - p0[1]];
    const len = Math.hypot(dir[0], dir[1]);
    const ext = [p1[0] + (dir[0] / len) * 60, p1[1] + (dir[1] / len) * 60];
    paths.push(<line key={i} x1={p1[0]} y1={p1[1]} x2={ext[0]} y2={ext[1]} />);
  }
  const poly = Array.from({ length: blades }, (_, i) => {
    const a = (i / blades) * Math.PI * 2;
    return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`;
  }).join(' ');
  return (
    <svg className={'aperture-mark' + (spin ? ' spin' : '')} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="am-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--glow)" stopOpacity="1" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.6" />
        </radialGradient>
        <clipPath id="am-clip">
          <circle cx="50" cy="50" r={R - 4} />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r={R - 2} fill="none" stroke="currentColor" strokeWidth="4" />
      <g clipPath="url(#am-clip)" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round">
        {paths}
      </g>
      <polygon points={poly} fill="url(#am-core)" />
    </svg>
  );
}

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className={'wordmark' + (compact ? ' compact' : '')}>
      <ApertureMark size={compact ? 22 : 30} />
      <span className="wordmark-text">IRIS</span>
    </span>
  );
}

/* ------------------------------------------------------------- Empty */

export function Empty({ icon, title, children, action }: { icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={34} stroke={1.2} />
      </div>
      <h3 className="empty-title">{title}</h3>
      {children && <p className="empty-body">{children}</p>}
      {action}
    </div>
  );
}
