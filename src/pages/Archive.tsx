import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLibrary } from '../state/library';
import { useSettings } from '../state/settings';
import { useUi } from '../state/ui';
import { Poster } from '../components/Poster';
import { ClassBadge } from '../components/ClassBadge';
import { Icon } from '../components/Icon';
import { Button, Empty, Popover, Segmented, Slider, Tilt } from '../components/ui';
import { activeFilterCount, dirLabel, groupCritiques, matches, SORT_LABELS, SORT_PRESETS } from '../lib/sorting';
import { sound } from '../lib/sound';
import { CLASSES, SCORES, TYPE_LABEL, TYPES, classOf, ratingOf, type Critique, type MediaType } from '../shared/model';
import { SORT_KEYS, type GroupBy, type SortKeyId, type SortRule } from '../shared/settings';

export function Archive() {
  const crits = useLibrary((s) => s.lib.critiques);
  const prefs = useSettings((s) => s.s.archive);
  const setS = useSettings((s) => s.set);
  const filters = useUi((s) => s.filters);
  const setFilters = useUi((s) => s.setFilters);
  const resetFilters = useUi((s) => s.resetFilters);
  const focusSearch = useUi((s) => s.focusSearch);
  const go = useUi((s) => s.go);
  const searchRef = useRef<HTMLInputElement>(null);
  const sortBtn = useRef<HTMLButtonElement>(null);
  const filterBtn = useRef<HTMLButtonElement>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    if (focusSearch) setTimeout(() => searchRef.current?.focus(), 80);
  }, [focusSearch]);

  const setArchive = (p: Partial<typeof prefs>) => setS((s) => ({ archive: { ...s.archive, ...p } }));
  const visible = useMemo(() => crits.filter((c) => matches(c, filters)), [crits, filters]);
  const groups = useMemo(() => groupCritiques(visible, prefs.groupBy, prefs.sort), [visible, prefs.groupBy, prefs.sort]);
  const typeValue = filters.types.length === 1 ? filters.types[0] : 'all';
  const nf = activeFilterCount(filters);
  const sortSummary = prefs.sort.map((r) => SORT_LABELS[r.key]).join(', then ');

  return (
    <div className="page archive">
      <header className="page-head">
        <div>
          <h1 className="page-title display">Your critiques</h1>
          <p className="page-sub">
            {crits.length === 0
              ? 'Nothing in the archive yet.'
              : visible.length === crits.length
                ? `${crits.length} critique${crits.length === 1 ? '' : 's'}, sorted by ${sortSummary.toLowerCase()}.`
                : `Showing ${visible.length} of ${crits.length}.`}
          </p>
        </div>
        <Button variant="primary" icon="pen" onClick={() => go({ name: 'write' })}>
          Write a critique
        </Button>
      </header>

      <div className="toolbar glass">
        <label className="search">
          <Icon name="search" size={16} />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search titles, people, studios, your words…"
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
            onKeyDown={(e) => e.key === 'Escape' && setFilters({ q: '' })}
          />
        </label>
        <Segmented
          id="type"
          value={typeValue as any}
          onChange={(v: string) => setFilters({ types: v === 'all' ? [] : [v as MediaType] })}
          options={[
            { value: 'all', label: 'All' },
            { value: 'movie', label: 'Movies', icon: 'movie' },
            { value: 'show', label: 'Shows', icon: 'show' },
            { value: 'game', label: 'Games', icon: 'game' },
          ]}
        />
        <div className="toolbar-gap" />
        <button ref={sortBtn} type="button" className={'tbtn' + (sortOpen ? ' on' : '')} onClick={() => setSortOpen((v) => !v)}>
          <Icon name="sort" size={16} />
          <span className="tbtn-label">{sortSummary}</span>
        </button>
        <button ref={filterBtn} type="button" className={'tbtn' + (filterOpen || nf ? ' on' : '')} onClick={() => setFilterOpen((v) => !v)}>
          <Icon name="filter" size={16} />
          <span className="tbtn-label">Filter{nf ? ` (${nf})` : ''}</span>
        </button>
        <Segmented
          id="view"
          size="sm"
          value={prefs.view}
          onChange={(v) => setArchive({ view: v })}
          options={[
            { value: 'posters', label: '', icon: 'grid', title: 'Posters' },
            { value: 'list', label: '', icon: 'list', title: 'List' },
          ]}
        />
      </div>

      <SortPopover open={sortOpen} onClose={() => setSortOpen(false)} anchor={sortBtn} rules={prefs.sort} groupBy={prefs.groupBy} onChange={(sort) => setArchive({ sort })} onGroup={(groupBy) => setArchive({ groupBy })} />
      <FilterPopover open={filterOpen} onClose={() => setFilterOpen(false)} anchor={filterBtn} />

      {nf > 0 && (
        <div className="chips-row">
          {filters.classes.map((k) => (
            <button key={k} type="button" className="chip on removable" onClick={() => setFilters({ classes: filters.classes.filter((x) => x !== k) })}>
              {CLASSES.find((c) => c.key === k)?.label} <Icon name="close" size={12} />
            </button>
          ))}
          {filters.recommend !== 'any' && (
            <button type="button" className="chip on removable" onClick={() => setFilters({ recommend: 'any' })}>
              {filters.recommend === 'yes' ? 'Recommended' : filters.recommend === 'no' ? 'Not recommended' : 'No recommendation'} <Icon name="close" size={12} />
            </button>
          )}
          {(filters.rating[0] > 0 || filters.rating[1] < 1000) && (
            <button type="button" className="chip on removable" onClick={() => setFilters({ rating: [0, 1000] })}>
              Rating {filters.rating[0]} to {filters.rating[1]} <Icon name="close" size={12} />
            </button>
          )}
          {SCORES.filter((s) => (filters.scoreMins[s.key] ?? 0) > 0).map((s) => (
            <button
              key={s.key}
              type="button"
              className="chip on removable"
              onClick={() => {
                const m = { ...filters.scoreMins };
                delete m[s.key];
                setFilters({ scoreMins: m });
              }}
            >
              {s.short} at least {filters.scoreMins[s.key]} <Icon name="close" size={12} />
            </button>
          ))}
          <button type="button" className="inline-link" onClick={resetFilters}>
            Clear filters
          </button>
        </div>
      )}

      {crits.length === 0 ? (
        <Empty icon="archive" title="No critiques yet" action={<Button variant="primary" icon="pen" onClick={() => go({ name: 'write' })}>Write your first critique</Button>}>
          Rate something from story to personal enjoyment and it will appear here, ready to sort any way you like.
        </Empty>
      ) : visible.length === 0 ? (
        <Empty icon="search" title="Nothing matches" action={<Button onClick={() => { resetFilters(); setFilters({ q: '', types: [] }); }}>Clear search and filters</Button>}>
          Try a different word, or loosen a filter.
        </Empty>
      ) : (
        <div className="groups">
          {groups.map((g) => (
            <section key={g.key} className="group">
              {prefs.groupBy !== 'none' && (
                <header className="group-head">
                  <h2 className="group-title display">{g.label}</h2>
                  <span className="group-count">{g.items.length}</span>
                  <span className="group-avg">average {Math.round(g.items.reduce((n, c) => n + ratingOf(c), 0) / g.items.length)}</span>
                </header>
              )}
              {prefs.view === 'posters' ? (
                <motion.div className="grid" layout>
                  <AnimatePresence initial={false}>
                    {g.items.map((c, i) => (
                      <Card key={c.id} c={c} index={i} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <ListView items={g.items} rules={prefs.sort} onSort={(sort) => setArchive({ sort })} />
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ c, index }: { c: Critique; index: number }) {
  const go = useUi((s) => s.go);
  const cls = classOf(c);
  return (
    <motion.div
      layout="position"
      className={`card cls-glow-${cls}`}
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: Math.min(index, 12) * 0.025 }}
    >
      <Tilt
        className="card-tilt"
        onClick={() => {
          sound.click();
          go({ name: 'detail', id: c.id });
        }}
      >
        <motion.div layoutId={'poster-' + c.id} className="card-poster" transition={{ type: 'spring', stiffness: 260, damping: 32 }}>
          <Poster title={c.title} type={c.type} poster={c.poster} year={c.year} />
        </motion.div>
        <div className="card-info">
          <div className="card-scores">
            <span className="card-rating display" title="Rating out of 1000">
              {ratingOf(c)}
            </span>
            <span className="card-enjoy" title="Personal enjoyment out of 100">
              <Icon name="heart" size={13} /> {c.scores.enjoyment}
            </span>
          </div>
          <ClassBadge cls={cls} size="sm" chosen={!!c.classOverride} />
        </div>
      </Tilt>
      <div className="card-title">{c.title}</div>
    </motion.div>
  );
}

const LIST_COLS: { key: SortKeyId; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'type', label: 'Type' },
  { key: 'class', label: 'Class' },
  { key: 'rating', label: 'Rating' },
  { key: 'enjoyment', label: 'Enjoyment' },
];

function ListView({ items, rules, onSort }: { items: Critique[]; rules: SortRule[]; onSort: (r: SortRule[]) => void }) {
  const go = useUi((s) => s.go);
  const clickHead = (key: SortKeyId, add: boolean) => {
    sound.click();
    const existing = rules.find((r) => r.key === key);
    const defaultDir: 'asc' | 'desc' = key === 'title' || key === 'type' ? 'asc' : 'desc';
    if (add) {
      if (existing) onSort(rules.map((r) => (r.key === key ? { ...r, dir: r.dir === 'asc' ? 'desc' : 'asc' } : r)));
      else onSort([...rules, { key, dir: defaultDir }].slice(0, 5));
    } else {
      const first = rules[0];
      if (first?.key === key) onSort([{ key, dir: first.dir === 'asc' ? 'desc' : 'asc' }]);
      else onSort([{ key, dir: defaultDir }]);
    }
  };
  return (
    <div className="list glass">
      <div className="list-row list-head">
        <span className="lc-poster" />
        {LIST_COLS.map((col) => {
          const r = rules.findIndex((x) => x.key === col.key);
          return (
            <button key={col.key} type="button" className={`lc lc-${col.key}` + (r >= 0 ? ' on' : '')} onClick={(e) => clickHead(col.key, e.shiftKey)} title="Click to sort. Shift-click to add a second level.">
              {col.label}
              {r >= 0 && (
                <>
                  <Icon name={rules[r].dir === 'asc' ? 'up' : 'down'} size={12} />
                  {rules.length > 1 && <span className="lc-n">{r + 1}</span>}
                </>
              )}
            </button>
          );
        })}
        <span className="lc lc-scores">The ten scores</span>
      </div>
      <AnimatePresence initial={false}>
        {items.map((c) => (
          <motion.button
            layout="position"
            key={c.id}
            type="button"
            className="list-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => go({ name: 'detail', id: c.id })}
          >
            <span className="lc-poster">
              <Poster title={c.title} type={c.type} poster={c.poster} size="sm" />
            </span>
            <span className="lc lc-title">{c.title}</span>
            <span className="lc lc-type">
              <Icon name={c.type} size={14} /> {TYPE_LABEL[c.type]}
            </span>
            <span className="lc lc-class">
              <ClassBadge cls={classOf(c)} size="sm" chosen={!!c.classOverride} />
            </span>
            <span className="lc lc-rating display">{ratingOf(c)}</span>
            <span className="lc lc-enjoyment">{c.scores.enjoyment}</span>
            <span className="lc lc-scores">
              {SCORES.map((s) => (
                <span key={s.key} className="mini-bar" title={`${s.label}: ${c.scores[s.key]}`}>
                  <span style={{ height: `${c.scores[s.key]}%` }} />
                </span>
              ))}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

function SortPopover({
  open,
  onClose,
  anchor,
  rules,
  groupBy,
  onChange,
  onGroup,
}: {
  open: boolean;
  onClose: () => void;
  anchor: React.RefObject<HTMLButtonElement | null>;
  rules: SortRule[];
  groupBy: GroupBy;
  onChange: (r: SortRule[]) => void;
  onGroup: (g: GroupBy) => void;
}) {
  const presetId = SORT_PRESETS.find((p) => JSON.stringify(p.rules) === JSON.stringify(rules))?.id;
  const update = (i: number, patch: Partial<SortRule>) => onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rules.length) return;
    const next = [...rules];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <Popover open={open} onClose={onClose} anchor={anchor} align="end" width={460}>
      <div className="pop-section">
        <h4>Quick orders</h4>
        <div className="chips">
          {SORT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={'chip' + (presetId === p.id ? ' on' : '')}
              onClick={() => {
                sound.click();
                onChange(p.rules.map((r) => ({ ...r })));
                if (p.id === 'default') onGroup('type');
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="pop-section">
        <h4>Your order</h4>
        <ol className="sort-rules">
          {rules.map((r, i) => (
            <li key={i} className="sort-rule">
              <span className="sort-n">{i === 0 ? 'Sort by' : 'then'}</span>
              <select value={r.key} onChange={(e) => update(i, { key: e.target.value as SortKeyId })}>
                {SORT_KEYS.map((k) => (
                  <option key={k} value={k} disabled={rules.some((x, j) => j !== i && x.key === k)}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
              <select value={r.dir} onChange={(e) => update(i, { dir: e.target.value as 'asc' | 'desc' })}>
                <option value="desc">{dirLabel(r.key, 'desc')}</option>
                <option value="asc">{dirLabel(r.key, 'asc')}</option>
              </select>
              <span className="sort-tools">
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                  <Icon name="up" size={14} />
                </button>
                <button type="button" className="icon-btn" disabled={rules.length === 1} onClick={() => onChange(rules.filter((_, j) => j !== i))} aria-label="Remove">
                  <Icon name="close" size={14} />
                </button>
              </span>
            </li>
          ))}
        </ol>
        {rules.length < 5 && (
          <button
            type="button"
            className="inline-link"
            onClick={() => {
              const free = SORT_KEYS.find((k) => !rules.some((r) => r.key === k))!;
              onChange([...rules, { key: free, dir: 'desc' }]);
            }}
          >
            <Icon name="plus" size={13} /> Add another level
          </button>
        )}
      </div>
      <div className="pop-section">
        <h4>Group into sections by</h4>
        <Segmented
          id="group"
          value={groupBy}
          onChange={onGroup}
          options={[
            { value: 'type', label: 'Type' },
            { value: 'class', label: 'Class' },
            { value: 'recommend', label: 'Recommend' },
            { value: 'none', label: 'No sections' },
          ]}
        />
      </div>
    </Popover>
  );
}

function FilterPopover({ open, onClose, anchor }: { open: boolean; onClose: () => void; anchor: React.RefObject<HTMLButtonElement | null> }) {
  const f = useUi((s) => s.filters);
  const setFilters = useUi((s) => s.setFilters);
  const reset = useUi((s) => s.resetFilters);
  const [showScores, setShowScores] = useState(Object.keys(f.scoreMins).length > 0);
  return (
    <Popover open={open} onClose={onClose} anchor={anchor} align="end" width={430}>
      <div className="pop-section">
        <h4>Type</h4>
        <div className="chips">
          {TYPES.map((t) => {
            const on = f.types.includes(t);
            return (
              <button key={t} type="button" className={'chip' + (on ? ' on' : '')} onClick={() => setFilters({ types: on ? f.types.filter((x) => x !== t) : [...f.types, t] })}>
                <Icon name={t} size={13} /> {TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="pop-section">
        <h4>Class</h4>
        <div className="chips">
          {CLASSES.map((c) => {
            const on = f.classes.includes(c.key);
            return (
              <button key={c.key} type="button" className={`chip chip-cls chip-${c.key}` + (on ? ' on' : '')} onClick={() => setFilters({ classes: on ? f.classes.filter((x) => x !== c.key) : [...f.classes, c.key] })}>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="pop-section">
        <h4>Recommended</h4>
        <Segmented
          id="rec"
          size="sm"
          value={f.recommend}
          onChange={(v) => setFilters({ recommend: v })}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'unset', label: 'Not answered' },
          ]}
        />
      </div>
      <div className="pop-section">
        <Slider label="Lowest rating" value={f.rating[0]} min={0} max={1000} step={10} onChange={(v) => setFilters({ rating: [Math.min(v, f.rating[1]), f.rating[1]] })} />
        <Slider label="Highest rating" value={f.rating[1]} min={0} max={1000} step={10} onChange={(v) => setFilters({ rating: [f.rating[0], Math.max(v, f.rating[0])] })} />
      </div>
      <div className="pop-section">
        <button type="button" className="inline-link" onClick={() => setShowScores((v) => !v)}>
          <Icon name={showScores ? 'up' : 'down'} size={13} /> Minimum score in a category
        </button>
        {showScores &&
          SCORES.map((s) => (
            <Slider
              key={s.key}
              label={s.label}
              value={f.scoreMins[s.key] ?? 0}
              min={0}
              max={100}
              onChange={(v) => {
                const m = { ...f.scoreMins };
                if (v > 0) m[s.key] = v;
                else delete m[s.key];
                setFilters({ scoreMins: m });
              }}
              format={(v) => (v ? `${v}+` : 'any')}
            />
          ))}
      </div>
      <div className="pop-foot">
        <button type="button" className="inline-link" onClick={reset}>
          Clear filters
        </button>
      </div>
    </Popover>
  );
}
