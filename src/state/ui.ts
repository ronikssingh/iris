import { create } from 'zustand';
import type { ReactNode } from 'react';
import { EMPTY_FILTERS, type Filters } from '../lib/sorting';
import type { ClassKey, MediaType } from '../shared/model';

/** The verdict moment shown over everything right after a critique is saved. */
export interface CelebrateSpec {
  id: string;
  title: string;
  total: number;
  cls: ClassKey;
  poster: string | null;
  type: MediaType;
  edited: boolean;
}

export type Route =
  | { name: 'lobby' }
  | { name: 'archive' }
  | { name: 'detail'; id: string }
  | { name: 'write'; draftId?: string }
  | { name: 'masterpieces' }
  | { name: 'upnext' }
  | { name: 'foryou' }
  | { name: 'friends'; tab?: 'feed' | 'people' | 'suggested' }
  | { name: 'friend'; id: string; critique?: string }
  | { name: 'settings'; section?: string };

export const TAB_ORDER: Route['name'][] = ['lobby', 'archive', 'write', 'masterpieces', 'upnext', 'foryou', 'friends', 'settings'];

export interface Toast {
  id: number;
  text: string;
  tone?: 'info' | 'good' | 'bad';
  action?: { label: string; run: () => void };
  ms?: number;
}

export interface ModalSpec {
  title: string;
  body?: ReactNode;
  wide?: boolean;
  actions?: { label: string; tone?: 'primary' | 'danger' | 'plain'; run?: () => void | boolean | Promise<void | boolean> }[];
  onClose?: () => void;
}

interface UiState {
  route: Route;
  prev: Route | null;
  dir: number;
  history: Route[];
  introDone: boolean;
  onboarding: boolean;
  toasts: Toast[];
  modal: ModalSpec | null;
  filters: Filters;
  focusSearch: number;
  shortcutsOpen: boolean;
  themePickerOpen: boolean;
  celebrate: CelebrateSpec | null;
  go: (r: Route, opts?: { replace?: boolean }) => void;
  back: () => void;
  toast: (t: Omit<Toast, 'id'>) => number;
  dismissToast: (id: number) => void;
  openModal: (m: ModalSpec) => void;
  closeModal: () => void;
  setFilters: (f: Partial<Filters>) => void;
  resetFilters: () => void;
}

let toastId = 1;

function idx(r: Route): number {
  const n = r.name === 'detail' ? 'archive' : r.name === 'friend' ? 'friends' : r.name;
  return TAB_ORDER.indexOf(n);
}

export const sameRoute = (a: Route, b: Route) => JSON.stringify(a) === JSON.stringify(b);

export const useUi = create<UiState>((set, get) => ({
  route: { name: 'lobby' },
  prev: null,
  dir: 0,
  history: [],
  introDone: false,
  onboarding: false,
  toasts: [],
  modal: null,
  filters: { ...EMPTY_FILTERS },
  focusSearch: 0,
  shortcutsOpen: false,
  themePickerOpen: false,
  celebrate: null,

  go: (r, opts) => {
    const cur = get().route;
    if (sameRoute(cur, r)) return;
    const di = idx(r) - idx(cur);
    const deeper = r.name === 'detail' && cur.name !== 'detail' ? 1 : cur.name === 'detail' && r.name === 'archive' ? -1 : 0;
    set({
      prev: cur,
      route: r,
      dir: deeper || Math.sign(di),
      history: opts?.replace ? get().history : [...get().history.slice(-30), cur],
    });
  },

  back: () => {
    const h = get().history;
    const prev = h[h.length - 1];
    if (!prev) {
      set({ route: { name: 'lobby' }, dir: -1 });
      return;
    }
    set({ route: prev, prev: get().route, history: h.slice(0, -1), dir: -1 });
  },

  toast: (t) => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    const ms = t.ms ?? (t.action ? 7000 : 3800);
    window.setTimeout(() => get().dismissToast(id), ms);
    return id;
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  openModal: (m) => set({ modal: m }),
  closeModal: () => {
    const m = get().modal;
    set({ modal: null });
    m?.onClose?.();
  },

  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
  resetFilters: () => set({ filters: { ...EMPTY_FILTERS, q: get().filters.q } }),
}));
