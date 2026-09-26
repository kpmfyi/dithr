'use client';
import { useMemo, useState } from 'react';
import { deprecatedPresets, families, presets, type Recipe } from '../../src/seedbank/recipes';
import { series, seriesOf } from '../../src/workbench/series';
import { Drawer } from './drawer';
import { PaletteRail } from './palette-rail';

type Props = { current: Recipe; saved: Recipe[]; onChoose: (recipe: Recipe) => void; onRemove: (id: string) => void; onClose: () => void; seriesFilter: string; setSeriesFilter: (id: string) => void };
const matches = (recipe: Recipe, query: string) => { const q = query.trim().toLowerCase(); if (!q) return true; const f = families[recipe.family]; return `${f.name} ${f.subtitle} ${f.description} ${recipe.name} ${recipe.tags.join(' ')} ${seriesOf(recipe.family)?.name ?? ''} ${f.number}`.toLowerCase().includes(q); };
function Card({ recipe, current, saved, onChoose, onRemove }: { recipe: Recipe; current: boolean; saved?: boolean; onChoose: () => void; onRemove?: () => void }) {
  const f = families[recipe.family];
  return <div className={saved ? 'saved-card' : undefined}>
    <button className="study-card" aria-current={current} onClick={onChoose} aria-label={saved ? `${recipe.name} seed ${recipe.seed}` : `${f.name} ${recipe.tags.join(' ')}`}>
      <img src={`/thumbs/${recipe.family}.webp`} alt="" loading="lazy" width={480} height={320}/>
      {saved && <PaletteRail colors={recipe.palette}/>}
      <strong><span>{f.number}</span>{saved ? recipe.name : f.name}</strong>
      <small>{saved ? `${f.name}, seed ${recipe.seed}` : f.subtitle}</small>
    </button>
    {saved && onRemove && <button className="btn remove" aria-label={`Remove ${recipe.name}`} onClick={onRemove}>Remove</button>}
  </div>;
}
export function StudyDrawer({ current, saved, onChoose, onRemove, onClose, seriesFilter, setSeriesFilter }: Props) {
  const [tab, setTab] = useState<'studies' | 'saved' | 'archive'>('studies');
  const [query, setQuery] = useState('');
  const shelf = tab === 'saved' ? saved : tab === 'archive' ? deprecatedPresets : presets;
  const visible = useMemo(() => shelf.filter(r => matches(r, query) && (tab !== 'studies' || seriesFilter === 'all' || seriesOf(r.family)?.id === seriesFilter)), [shelf, query, tab, seriesFilter]);
  const grouped = tab === 'studies' && !query && seriesFilter === 'all';
  return <Drawer title="Studies" label="Study browser" onClose={onClose}
    tools={<>
      <div className="chips" role="tablist" aria-label="Shelf">{([['studies', 'Studies', presets.length], ['saved', 'Saved', saved.length], ['archive', 'Archive', deprecatedPresets.length]] as const).map(([id, name, n]) => <button key={id} role="tab" aria-selected={tab === id} className="btn" onClick={() => setTab(id)}>{name} <span className="count">{n}</span></button>)}</div>
      <label className="search"><span className="sr-only">Search studies</span><input type="search" aria-label="Search studies" placeholder="Search names, moods, techniques" value={query} onChange={e => setQuery(e.target.value)}/><span className="count">{visible.length}</span></label>
      {tab === 'studies' && <div className="chips" role="group" aria-label="Series">{[{ id: 'all', name: 'All' }, ...series].map(s => <button key={s.id} className="btn" aria-pressed={seriesFilter === s.id} onClick={() => setSeriesFilter(s.id)}>{s.name}</button>)}</div>}
    </>}
    footer={<>{tab === 'studies' ? <span>{seriesFilter === 'all' ? 'Rolling a new study picks from all studies.' : `Rolling a new study picks from ${series.find(s => s.id === seriesFilter)?.name}.`}</span> : tab === 'archive' ? <span>Earlier soft-edged experiments, kept so old recipes still open.</span> : <span>Saved on this device only.</span>}
      <a className="btn" style={{ marginLeft: 'auto' }} href={`/demos?study=${current.family}`}>See studies in context</a></>}>
    {grouped ? series.map(s => <section className="series-block" key={s.id}><h3>{s.name}<span>{s.note}</span></h3>
      <div className="study-grid">{presets.filter(r => s.families.includes(r.family)).map(r => <Card key={r.id} recipe={r} current={r.family === current.family} onChoose={() => onChoose(r)}/>)}</div></section>)
      : visible.length ? <div className="study-grid">{visible.map(r => <Card key={r.id} recipe={r} saved={tab === 'saved'} current={tab === 'saved' ? r.id === current.id : r.family === current.family} onChoose={() => onChoose(r)} onRemove={() => onRemove(r.id)}/>)}</div>
      : <div className="empty">{tab === 'saved' && !query ? <p>Nothing saved yet. Press Save on a roll you like and it will wait here.</p> : <><p>No studies match “{query}”.</p><button className="btn" onClick={() => setQuery('')}>Clear search</button></>}</div>}
  </Drawer>;
}
