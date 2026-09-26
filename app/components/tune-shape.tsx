'use client';
import { useState, type SetStateAction } from 'react';
import { allPresets, controls, families, type Parameters, type Recipe } from '../../src/seedbank/recipes';
import { explore, parameterKeys, type ExploreAction, type Locks } from '../../src/workbench/exploration';
import { NumberField, Lock, fill } from './fields';
import { Icon } from './icons';

type Props = {
  recipe: Recipe; setRecipe: (next: SetStateAction<Recipe>) => void; busy: boolean;
  begin: () => void; end: () => void; locks: Locks; setLocks: (next: SetStateAction<Locks>) => void;
  onMessage: (message: string) => void;
};
const help: Record<keyof Parameters, string> = {
  scale: 'Size and spacing of forms. Higher fits more structure in the frame.',
  speed: 'Simulation pace. Hold freezes the field; 1× is the base rate.',
  intensity: 'Coverage of accents and afterimages.',
  detail: '',
};
export function ShapeControls({ recipe, setRecipe, busy, begin, end, locks, setLocks, onMessage }: Props) {
  const [step, setStep] = useState(0.01);
  const [amount, setAmount] = useState(0.08);
  const [name, setName] = useState<string | null>(null);
  const info = families[recipe.family];
  const defaults = allPresets.find(p => p.family === recipe.family)!.parameters;
  const parameter = (key: keyof Parameters, value: number) => setRecipe(r => ({ ...r, review: 'candidate', parameters: { ...r.parameters, [key]: value } }));
  const paramsLocked = parameterKeys.every(key => locks[key]);
  const act = (action: ExploreAction) => {
    end(); setRecipe(explore(recipe, action, crypto.getRandomValues(new Uint32Array(1))[0], locks, amount));
    onMessage(action === 'nudge' ? `Nudged unlocked settings by up to ${Math.round(amount * 100)}%.` : action === 'seed' ? 'New seed. Everything else kept.' : 'Rolled the unlocked settings.');
  };
  return <>
    <section className="tune-section" aria-label="Shader settings">
      <div className="toolbar">
        <button className="btn" disabled={busy || paramsLocked} onClick={() => act('parameters')} title="Roll the unlocked settings only"><Icon name="dice"/> Roll shape</button>
        <button className="btn" disabled={busy || paramsLocked} onClick={() => act('nudge')} title="Small random step from the current settings">Nudge</button>
        <select className="select" aria-label="Nudge distance" value={amount} disabled={busy} onChange={e => setAmount(Number(e.target.value))}><option value="0.02">Subtle, 2%</option><option value="0.08">Nearby, 8%</option><option value="0.2">Wander, 20%</option></select>
      </div>
      {parameterKeys.map(key => {
        const spec = controls[key], label = key === 'detail' ? info.detail : spec.label;
        const value = recipe.parameters[key];
        const bump = (direction: number) => parameter(key, +Math.max(spec.min, Math.min(spec.max, value + direction * step)).toFixed(3));
        return <div className="param" key={key}>
          <span className="param-label">{label}<Lock label={label} locked={locks[key]} disabled={busy} onClick={() => setLocks(l => ({ ...l, [key]: !l[key] }))}/></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span className="param-value"><button aria-label={`Decrease ${label}`} disabled={busy || value <= spec.min} onClick={() => bump(-1)}>−</button><NumberField label={`${label} value`} value={value} min={spec.min} max={spec.max} step={step} disabled={busy} begin={begin} end={end} onChange={v => parameter(key, v)}/><button aria-label={`Increase ${label}`} disabled={busy || value >= spec.max} onClick={() => bump(1)}>+</button></span>
            <button className="param-reset" title={`Restore ${label.toLowerCase()} to the study default (${defaults[key]})`} aria-label={`Reset ${label}`} disabled={busy} onClick={() => { end(); parameter(key, defaults[key]); }}><Icon name="reset"/></button>
          </span>
          <input aria-label={label} type="range" min={spec.min} max={spec.max} step={0.001} value={value} disabled={busy} style={fill(value, spec.min, spec.max)} title={help[key] || `Changes ${info.detail.toLowerCase()} in this study.`}
            onBlur={end} onPointerDown={e => { e.currentTarget.focus(); begin(); }} onPointerUp={end} onPointerCancel={end} onKeyUp={end}
            onKeyDown={e => { if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(e.key)) { e.preventDefault(); if (!e.repeat) begin(); bump((e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 1) * (e.shiftKey ? 10 : 1)); } }}
            onChange={e => parameter(key, Number(e.target.value))}/>
          {key === 'speed' && <div className="speed-presets">{[0, .5, 1, 1.5, 2].map(n => <button className="btn" key={n} disabled={busy} aria-pressed={value === n} onClick={() => { end(); parameter('speed', n); }}>{n === 0 ? 'Hold' : `${n}×`}</button>)}</div>}
        </div>;
      })}
      <label className="field-row">Step for − and +<select className="select" aria-label="Adjustment step" value={step} disabled={busy} onChange={e => setStep(Number(e.target.value))}><option value="0.1">0.1, coarse</option><option value="0.01">0.01, fine</option><option value="0.001">0.001, exact</option></select></label>
      <button className="btn btn-ghost" style={{ marginTop: 10, paddingLeft: 0 }} disabled={busy} onClick={() => { end(); setRecipe(r => ({ ...r, parameters: { ...defaults }, review: 'candidate' })); }}>Restore study settings</button>
    </section>
    <section className="tune-section" aria-label="Seed and name">
      <header><h2>Seed</h2></header>
      <div className="seed-row"><span>Seed</span>
        <NumberField label="Seed" value={recipe.seed} min={0} max={65535} step={1} disabled={busy} begin={begin} end={end} onChange={seed => setRecipe(r => ({ ...r, seed, review: 'candidate' }))}/>
        <Lock label="seed" locked={locks.seed} disabled={busy} onClick={() => setLocks(l => ({ ...l, seed: !l.seed }))}/>
        <button className="btn icon-btn" aria-label="Reroll seed only" title="New seed only" disabled={busy || locks.seed} onClick={() => act('seed')}><Icon name="dice"/></button>
      </div>
      <p className="hint">The seed changes where events happen and how the field evolves; the look stays the same.</p>
      <label className="name-field" style={{ marginTop: 14 }}>Preset name<input value={name ?? recipe.name} maxLength={80} disabled={busy} onFocus={() => { setName(recipe.name); begin(); }} onChange={e => setName(e.target.value)}
        onBlur={() => { setRecipe(r => ({ ...r, name: (name ?? recipe.name).trim() || 'Untitled study', review: 'candidate' })); setName(null); end(); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/></label>
    </section>
  </>;
}
