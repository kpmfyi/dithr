'use client';
import { useMemo, useState, type SetStateAction } from 'react';
import { controls, families, allPresets, type Parameters, type Recipe } from '../../src/seedbank/recipes';
import { applyPalette, defaultLocks, explore, parameterKeys, type ExploreAction, type Locks } from '../../src/workbench/exploration';
import { filterPalettes, paletteCollections, palettePresets } from '../../src/workbench/palettes';

type Props = {
  recipe: Recipe; setRecipe: (next: SetStateAction<Recipe>) => void; busy: boolean;
  begin: () => void; end: () => void; undo: () => void; redo: () => void;
  canUndo: boolean; canRedo: boolean; onMessage: (message: string) => void;
};
function Lock({ label, locked, disabled, onClick }: { label: string; locked: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" className="lock-control" aria-label={`Lock ${label}`} aria-pressed={locked} disabled={disabled} onClick={onClick} title={`${locked ? 'Unlock' : 'Lock'} ${label} for rerolls`}>
    <svg width="13" height="15" viewBox="0 0 16 18" fill="none" aria-hidden="true"><rect x="3" y="8" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d={locked ? 'M5 8V5a3 3 0 0 1 6 0v3' : 'M5 8V5a3 3 0 0 1 6 0'} stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="12" r="1" fill="currentColor"/></svg>
  </button>;
}
export function NumberField({ value, onChange, min, max, step, label, disabled, begin, end }: { value: number; onChange: (value: number) => void; min: number; max: number; step: number; label: string; disabled: boolean; begin: () => void; end: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input type="number" aria-label={label} value={draft ?? String(value)} min={min} max={max} step={step} disabled={disabled}
    onFocus={() => { setDraft(String(value)); begin(); }} onBlur={() => { setDraft(null); end(); }}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    onChange={e => { const raw = e.target.value; setDraft(raw); const n = Number(raw); if (raw.trim() && Number.isFinite(n) && n >= min && n <= max && (step !== 1 || Number.isInteger(n))) onChange(n); }}/>;
}
function HexField({ color, index, onChange, busy, begin, end }: { color: string; index: number; onChange: (hex: string) => void; busy: boolean; begin: () => void; end: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { const raw = draft ?? color; const value = raw.startsWith('#') ? raw : `#${raw}`; if (/^#[0-9a-f]{6}$/i.test(value)) onChange(value.toLowerCase()); setDraft(null); end(); };
  return <input className="hex-input" aria-label={`Palette hex ${index + 1}`} spellCheck={false} maxLength={7} value={draft ?? color} disabled={busy} onFocus={() => { setDraft(color); begin(); }} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/>;
}

export function ExplorationControls({ recipe, setRecipe, busy, begin, end, undo, redo, canUndo, canRedo, onMessage }: Props) {
  const [locks, setLocks] = useState<Locks>(defaultLocks);
  const [step, setStep] = useState(0.01);
  const [amount, setAmount] = useState(0.08);
  const [name, setName] = useState<string | null>(null);
  const [collection, setCollection] = useState('all');
  const [paletteQuery, setPaletteQuery] = useState('');
  const [palettePage, setPalettePage] = useState(0);
  const palettePool = useMemo(() => filterPalettes(collection, paletteQuery), [collection, paletteQuery]);
  const pageCount = Math.ceil(palettePool.length / 12);
  const page = Math.min(palettePage, Math.max(0, pageCount - 1));
  const pagePalettes = palettePool.slice(page * 12, page * 12 + 12);
  const info = families[recipe.family];
  const toggle = (key: keyof Parameters | 'seed') => setLocks(l => ({ ...l, [key]: !l[key] }));
  const parameter = (key: keyof Parameters, value: number) => setRecipe(r => ({ ...r, review: 'candidate', parameters: { ...r.parameters, [key]: value } }));
  const color = (index: number, hex: string) => setRecipe(r => ({ ...r, review: 'candidate', palette: r.palette.map((c, i) => i === index ? hex : c) as Recipe['palette'] }));
  const canRerollPalette = palettePool.some(p => p.colors.some((c, i) => !locks.palette[i] && c.toLowerCase() !== recipe.palette[i].toLowerCase()));
  const allLocked = parameterKeys.every(key => locks[key]) && locks.seed && !canRerollPalette;
  const paramsLocked = parameterKeys.every(key => locks[key]);
  const paletteLocked = locks.palette.every(Boolean);
  const roll = (action: ExploreAction) => {
    end(); const next = explore(recipe, action, crypto.getRandomValues(new Uint32Array(1))[0], locks, amount, palettePool);
    setRecipe(next);
    onMessage(action === 'nudge' ? `Nudged unlocked parameters within ${Math.round(amount * 100)}% of their range. Undo to compare.` : 'New variation. Locked settings kept; undo to return to the previous recipe.');
  };
  const selectPalette = (colors: Recipe['palette']) => { end(); setRecipe(r => ({ ...r, review: 'candidate', palette: applyPalette(r.palette, colors, locks.palette) })); };
  const matchedPalette = palettePresets.find(p => p.colors.every((c, i) => c.toLowerCase() === recipe.palette[i].toLowerCase()));
  const currentPalette = matchedPalette?.id || '';
  const paletteOutsidePool = matchedPalette && !palettePool.some(p => p.id === currentPalette);
  return <>
    <div className="exploration-toolbar">
      <div className="history-actions"><span>EXPLORE & REFINE</span><button disabled={busy || !canUndo} onClick={undo} aria-label="Undo recipe change" title="Undo last edit or gesture">↶ Undo</button><button disabled={busy || !canRedo} onClick={redo} aria-label="Redo recipe change">↷ Redo</button></div>
      <div className="reroll-actions"><button className="reroll-main" aria-label="Generate a new variation" disabled={busy || allLocked} onClick={() => roll('all')}>⤨ Reroll unlocked</button><button disabled={busy || paramsLocked} onClick={() => roll('nudge')}>Nudge</button></div>
      <label className="nudge-amount">Nudge distance <select aria-label="Nudge distance" value={amount} disabled={busy} onChange={e => setAmount(Number(e.target.value))}><option value="0.02">Subtle · 2%</option><option value="0.08">Nearby · 8%</option><option value="0.2">Wander · 20%</option></select></label>
      <p className="control-hint">Lock what you like, reroll the rest. Locks protect against random changes; you can still edit by hand.</p>
    </div>
    <div className="recipe-name"><label htmlFor="recipe-name">Preset name</label><input id="recipe-name" value={name ?? recipe.name} maxLength={80} disabled={busy} onFocus={() => { setName(recipe.name); begin(); }} onChange={e => setName(e.target.value)} onBlur={() => { setRecipe(r => ({ ...r, name: (name ?? recipe.name).trim() || 'Untitled study', review: 'candidate' })); setName(null); end(); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/></div>
    <div className="seed-row"><span>Seed</span><NumberField label="Seed" value={recipe.seed} min={0} max={65535} step={1} disabled={busy} begin={begin} end={end} onChange={seed => setRecipe(r => ({ ...r, seed, review: 'candidate' }))}/><Lock label="seed" locked={locks.seed} disabled={busy} onClick={() => toggle('seed')}/><button className="seed-roll" aria-label="Reroll seed only" disabled={busy || locks.seed} onClick={() => roll('seed')}>⤨</button></div>
    <section className="parameter-section" aria-label="Shader parameters">
      <div className="control-section-title"><span className="small-label">PARAMETERS</span><button disabled={busy || paramsLocked} onClick={() => roll('parameters')}>⤨ Reroll params</button></div>
      <label className="precision-setting">Adjustment step <select aria-label="Adjustment step" value={step} disabled={busy} onChange={e => setStep(Number(e.target.value))}><option value="0.1">0.1 · Coarse</option><option value="0.01">0.01 · Fine</option><option value="0.001">0.001 · Exact</option></select></label>
      <div className="precision-controls">{parameterKeys.map(key => {
        const spec = controls[key], label = key === 'detail' ? info.detail : spec.label;
        const bump = (direction: number) => { end(); parameter(key, +Math.max(spec.min, Math.min(spec.max, recipe.parameters[key] + direction * step)).toFixed(3)); };
        return <div className="precision-control" key={key}>
          <div className="parameter-title"><span>{label}</span><Lock label={label} locked={locks[key]} disabled={busy} onClick={() => toggle(key)}/></div>
          <div className="parameter-value"><button aria-label={`Decrease ${label}`} disabled={busy || recipe.parameters[key] <= spec.min} onClick={() => bump(-1)}>−</button><NumberField label={`${label} value`} value={recipe.parameters[key]} min={spec.min} max={spec.max} step={step} disabled={busy} begin={begin} end={end} onChange={value => parameter(key, value)}/><button aria-label={`Increase ${label}`} disabled={busy || recipe.parameters[key] >= spec.max} onClick={() => bump(1)}>+</button></div>
          <input aria-label={label} type="range" min={spec.min} max={spec.max} step={0.001} value={recipe.parameters[key]} disabled={busy} onBlur={end} onPointerDown={e => { e.currentTarget.focus(); begin(); }} onPointerUp={end} onPointerCancel={end} onKeyUp={end} onKeyDown={e => { if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(e.key)) { e.preventDefault(); begin(); bump((e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 1) * (e.shiftKey ? 10 : 1)); } }} onChange={e => parameter(key, Number(e.target.value))}/>
          <div className="range-ends"><span>{spec.min}</span><span>{spec.max}</span></div>
        </div>;
      })}</div>
      <button className="restore-parameters" disabled={busy} onClick={() => { end(); setRecipe(r => ({ ...r, parameters: { ...allPresets.find(p => p.family === r.family)!.parameters }, review: 'candidate' })); }}>Restore study parameters</button>
    </section>
    <section className="palette palette-editor" aria-label="Palette controls">
      <div className="control-section-title"><span className="small-label">PALETTE</span><span className="palette-actions"><button disabled={busy || !canRerollPalette} onClick={() => roll('palette')}>⤨ Reroll</button><button disabled={busy || locks.palette.filter(v => !v).length < 2} onClick={() => roll('shuffle')}>Swap roles</button></span></div>
      <label className="palette-collection">Palette pool<select aria-label="Palette collection" value={collection} disabled={busy} onChange={e => { setCollection(e.target.value); setPalettePage(0); }}><option value="all">All collections · {palettePresets.length}</option>{paletteCollections.map(c => <option value={c.id} key={c.id}>{c.name} · {palettePresets.filter(p => p.collection === c.id).length}</option>)}</select></label>
      <div className="palette-search"><input type="search" aria-label="Search palettes" placeholder="Search name, mood, or hex…" value={paletteQuery} disabled={busy} onChange={e => { setPaletteQuery(e.target.value); setPalettePage(0); }}/>{paletteQuery && <button aria-label="Clear palette search" disabled={busy} onClick={() => { setPaletteQuery(''); setPalettePage(0); }}>×</button>}</div>
      <p className="palette-pool-note">{palettePool.length} {palettePool.length === 1 ? 'palette' : 'palettes'} in your reroll pool</p>
      <label className="palette-picker"><span className="visually-hidden">Palette preset</span><select aria-label="Palette preset" value={currentPalette} disabled={busy || paletteLocked || !palettePool.length} onChange={e => { const p = palettePresets.find(p => p.id === e.target.value); if (p) selectPalette(p.colors); }}><option value="" disabled>Custom palette</option>{paletteOutsidePool && <option value={matchedPalette.id}>{matchedPalette.name} · current</option>}{paletteCollections.map(c => { const options = palettePool.filter(p => p.collection === c.id); return options.length ? <optgroup key={c.id} label={c.name}>{options.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</optgroup> : null; })}</select></label>
      <div className="editable-swatches">{recipe.palette.map((hex, index) => <div className="editable-swatch" key={index}><label style={{ background: hex }}><span className="visually-hidden">Palette color {index + 1}</span><input type="color" aria-label={`Palette color ${index + 1}`} value={hex} disabled={busy} onFocus={begin} onBlur={end} onChange={e => color(index, e.target.value)}/></label><HexField color={hex} index={index} busy={busy} begin={begin} end={end} onChange={hex => color(index, hex)}/><div className="color-lock"><span>Color {index + 1}</span><Lock label={`color ${index + 1}`} locked={locks.palette[index]} disabled={busy} onClick={() => setLocks(l => ({ ...l, palette: l.palette.map((v, i) => i === index ? !v : v) as Locks['palette'] }))}/></div></div>)}</div>
      <details className="palette-ideas"><summary>Browse {palettePool.length} palette ideas</summary>
        {pagePalettes.length ? <><div className="palette-grid">{pagePalettes.map(p => <button key={p.id} aria-label={`Use ${p.name} palette`} aria-pressed={currentPalette === p.id} disabled={busy || paletteLocked} onClick={() => selectPalette(p.colors)}><span className="palette-strip">{p.colors.map((c, i) => <span key={i} style={{ background: c }}/>)}</span><span>{p.name}</span></button>)}</div>
        <nav className="palette-pagination" aria-label="Palette pages"><button aria-label="Previous palette page" disabled={busy || page === 0} onClick={() => setPalettePage(page - 1)}>← Previous</button><span aria-live="polite">{page + 1} / {pageCount}</span><button aria-label="Next palette page" disabled={busy || page + 1 >= pageCount} onClick={() => setPalettePage(page + 1)}>Next →</button></nav></> : <p className="palette-empty">No palettes match. Clear the search or choose another collection.</p>}
      </details>
      <button className="restore-parameters" disabled={busy || paletteLocked} onClick={() => selectPalette(allPresets.find(p => p.family === recipe.family)!.palette)}>Restore study palette</button>
    </section>
  </>;
}
