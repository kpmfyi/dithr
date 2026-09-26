'use client';
import { useMemo, useState } from 'react';
import type { PaletteSize, Recipe } from '../../src/seedbank/recipes';
import { paletteCollections, palettePresets, paletteVariant, vibeOf, type PalettePreset, type PaletteVibes } from '../../src/workbench/palettes';
import { Drawer } from './drawer';
import { PaletteRail } from './palette-rail';

export type PaletteFilter = { collection: string; query: string; vibes: string[] };
export const emptyFilter: PaletteFilter = { collection: 'all', query: '', vibes: [] };
const groups: { key: keyof PaletteVibes; values: string[] }[] = [
  { key: 'tone', values: ['light', 'mid', 'dark'] }, { key: 'energy', values: ['muted', 'balanced', 'vivid'] }, { key: 'temperature', values: ['warm', 'cool', 'neutral'] },
];
const label = (s: string) => s[0].toUpperCase() + s.slice(1);
/** Collection, text and vibe chips intersect; chips in the same group are alternatives. */
export function applyFilter(filter: PaletteFilter): PalettePreset[] {
  const terms = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return palettePresets.filter(p => {
    if (filter.collection !== 'all' && p.collection !== filter.collection) return false;
    const text = `${p.name} ${paletteCollections.find(c => c.id === p.collection)?.name} ${p.colors.join(' ')}`.toLowerCase();
    if (!terms.every(t => text.includes(t))) return false;
    const v = vibeOf(p);
    return groups.every(g => { const chosen = g.values.filter(x => filter.vibes.includes(x)); return !chosen.length || chosen.includes(v[g.key]); });
  });
}
const PAGE = 48;
type Props = { recipe: Recipe; filter: PaletteFilter; setFilter: (f: PaletteFilter) => void; pool: PalettePreset[]; onChoose: (colors: Recipe['palette']) => void; onClose: () => void; locked: boolean };
export function PaletteDrawer({ recipe, filter, setFilter, pool, onChoose, onClose, locked }: Props) {
  const [page, setPage] = useState(0);
  const size = recipe.palette.length as PaletteSize;
  const pages = Math.max(1, Math.ceil(pool.length / PAGE)), current = Math.min(page, pages - 1);
  const shown = useMemo(() => pool.slice(current * PAGE, current * PAGE + PAGE), [pool, current]);
  const active = (p: PalettePreset) => paletteVariant(p.colors, size).every((c, i) => c.toLowerCase() === recipe.palette[i].toLowerCase());
  const update = (next: Partial<PaletteFilter>) => { setFilter({ ...filter, ...next }); setPage(0); };
  const toggle = (vibe: string) => update({ vibes: filter.vibes.includes(vibe) ? filter.vibes.filter(v => v !== vibe) : [...filter.vibes, vibe] });
  return <Drawer title="Palettes" label="Palette browser" onClose={onClose}
    tools={<>
      <label className="search"><span className="sr-only">Search palettes</span><input type="search" aria-label="Search palettes" placeholder="Search names or hex" value={filter.query} onChange={e => update({ query: e.target.value })}/>{filter.query && <button className="btn btn-ghost icon-btn" aria-label="Clear palette search" onClick={() => update({ query: '' })}>×</button>}<span className="count">{pool.length}</span></label>
      <select className="select" aria-label="Palette collection" value={filter.collection} onChange={e => update({ collection: e.target.value })}><option value="all">All collections ({palettePresets.length})</option>{paletteCollections.map(c => <option key={c.id} value={c.id}>{c.name} ({palettePresets.filter(p => p.collection === c.id).length})</option>)}</select>
      {groups.map(g => <div className="chips" role="group" aria-label={label(g.key)} key={g.key}>{g.values.map(v => <button key={v} className="btn" aria-pressed={filter.vibes.includes(v)} onClick={() => toggle(v)}>{label(v)}</button>)}</div>)}
      {(filter.vibes.length > 0 || filter.collection !== 'all' || filter.query) && <button className="btn btn-ghost" onClick={() => update(emptyFilter)}>Reset filters</button>}
    </>}
    footer={<><span>{pool.length ? `Rolls draw from these ${pool.length} palettes, using your first ${size} colors.` : 'No palettes match, so rolls keep the current colors.'}{locked ? ' Locked colors stay put.' : ''}</span>
      <nav className="pager" aria-label="Palette pages"><button className="btn" aria-label="Previous palette page" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span className="tabular">{current + 1} / {pages}</span><button className="btn" aria-label="Next palette page" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next</button></nav></>}>
    {shown.length ? <div className="palette-grid">{shown.map(p => <button key={p.id} className="palette-card" aria-pressed={active(p)} aria-label={`Use ${p.name} palette`} onClick={() => onChoose(p.colors)}>
      <PaletteRail colors={p.colors} inactiveFrom={size}/>
      <strong>{p.name}</strong><small>{paletteCollections.find(c => c.id === p.collection)?.name}</small>
    </button>)}</div> : <div className="empty"><p>No palettes match these filters.</p><button className="btn" onClick={() => update(emptyFilter)}>Reset filters</button></div>}
  </Drawer>;
}
