'use client';
import { useState, type SetStateAction } from 'react';
import { allPresets, GENERATOR_VERSION, type PaletteSize, type Recipe } from '../../src/seedbank/recipes';
import { applyPalette, explore, type Locks } from '../../src/workbench/exploration';
import { completePalette, palettePresets, paletteVariant, type FiveColors, type PalettePreset } from '../../src/workbench/palettes';
import { rotatePalette } from '../../src/workbench/color';
import { HexField, Lock, fill } from './fields';
import { Icon } from './icons';
import { PaletteRail } from './palette-rail';

type Props = {
  recipe: Recipe; setRecipe: (next: SetStateAction<Recipe>) => void; busy: boolean;
  begin: () => void; end: () => void; locks: Locks; setLocks: (next: SetStateAction<Locks>) => void;
  onMessage: (message: string) => void; openPalettes: () => void; pool: readonly PalettePreset[];
};
const roleNames = ['Ground', 'Accent', 'Ink', 'Body', 'Trace'];
export function ColorControls({ recipe, setRecipe, busy, begin, end, locks, setLocks, onMessage, openPalettes, pool }: Props) {
  const [bank, setBank] = useState<{ id: string; colors: FiveColors }>({ id: recipe.id, colors: completePalette(recipe.palette) });
  const [hue, setHue] = useState({ base: recipe.palette, result: recipe.palette, degrees: 0 });
  const aligned = JSON.stringify(hue.result) === JSON.stringify(recipe.palette);
  const paletteLocked = recipe.palette.every((_, i) => locks.palette[i]);
  const matched = palettePresets.find(p => paletteVariant(p.colors, recipe.palette.length as PaletteSize).every((c, i) => c.toLowerCase() === recipe.palette[i].toLowerCase()));
  const color = (index: number, hex: string) => setRecipe(r => ({ ...r, review: 'candidate', palette: r.palette.map((c, i) => i === index ? hex : c) as Recipe['palette'] }));
  const shiftHue = (degrees: number) => {
    const base = aligned ? hue.base : recipe.palette;
    const result = applyPalette(recipe.palette, rotatePalette(base, degrees), locks.palette);
    setHue({ base, result, degrees }); setRecipe(r => ({ ...r, palette: result, review: 'candidate' }));
  };
  const resize = (size: PaletteSize) => {
    end();
    const bankAligned = bank.id === recipe.id && recipe.palette.every((c, i) => c === bank.colors[i]);
    const full = [...(bankAligned ? bank.colors : matched?.colors ?? completePalette(recipe.palette))] as FiveColors;
    recipe.palette.forEach((hex, i) => { full[i] = hex; });
    setBank({ id: recipe.id, colors: full });
    setRecipe(r => ({ ...r, palette: paletteVariant(full, size), generatorVersion: GENERATOR_VERSION, review: 'candidate' }));
    onMessage(`${size} colors. Hidden colors come back if you add them again.`);
  };
  const act = (action: 'palette' | 'shuffle') => {
    end(); setRecipe(explore(recipe, action, crypto.getRandomValues(new Uint32Array(1))[0], locks, .08, pool));
    onMessage(action === 'palette' ? 'Rolled a palette from your palette pool.' : 'Swapped color roles.');
  };
  const canRoll = pool.some(p => paletteVariant(p.colors, recipe.palette.length as PaletteSize).some((c, i) => !locks.palette[i] && c.toLowerCase() !== recipe.palette[i].toLowerCase()));
  return <>
    <section className="tune-section palette-editor" aria-label="Palette controls">
      <header><h2>{matched ? matched.name : 'Custom palette'}</h2>
        <button className="btn" onClick={openPalettes} disabled={busy}>Browse</button></header>
      <div className="swatch-editor">
        <PaletteRail colors={recipe.palette}/>
        <div className="swatches" style={{ '--count': recipe.palette.length } as React.CSSProperties}>{recipe.palette.map((hex, index) => <div className="swatch" key={index}>
          <label className="chip" style={{ background: hex }} title={`${roleNames[index]}: click to pick a color`}><span className="sr-only">Palette color {index + 1}</span><input type="color" aria-label={`Palette color ${index + 1}`} value={hex} disabled={busy} onFocus={begin} onBlur={end} onChange={e => color(index, e.target.value)}/></label>
          <HexField color={hex} index={index} busy={busy} begin={begin} end={end} onChange={h => color(index, h)}/>
          <span className="swatch-meta"><span>{roleNames[index]}</span><Lock label={`color ${index + 1}`} locked={!!locks.palette[index]} disabled={busy} onClick={() => setLocks(l => ({ ...l, palette: l.palette.map((v, i) => i === index ? !v : v) }))}/></span>
        </div>)}</div>
      </div>
      <div className="color-actions">
        <button className="btn" disabled={busy || !canRoll} onClick={() => act('palette')} title="Roll a palette from the pool chosen in Browse"><Icon name="dice"/> Roll palette</button>
        <button className="btn" disabled={busy || recipe.palette.filter((_, i) => !locks.palette[i]).length < 2} onClick={() => act('shuffle')}>Swap roles</button>
      </div>
      <label className="hue-field">Palette hue <output>{aligned ? hue.degrees : 0}°</output><input aria-label="Palette hue" type="range" min={-180} max={180} step={1} value={aligned ? hue.degrees : 0} style={fill(aligned ? hue.degrees : 0, -180, 180)} disabled={busy || paletteLocked}
        onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onBlur={end} onKeyDown={e => { if (!e.repeat) begin(); }} onKeyUp={end} onChange={e => shiftHue(Number(e.target.value))}/></label>
      <p className="hint">Rotates every unlocked color together. The shifted colors are saved in the recipe.</p>
    </section>
    <section className="tune-section" aria-label="Palette size">
      <fieldset className="segmented"><legend>Colors in use</legend>
        {([2, 3, 4, 5] as const).map(size => <button key={size} className="btn" disabled={busy} aria-pressed={recipe.palette.length === size} onClick={() => resize(size)}>{size} colors</button>)}
      </fieldset>
      <p className="hint">Every study uses all the colors you give it. Roles run ground, accent, ink, body, trace; fewer colors fold the later roles into the first ones.</p>
      <button className="btn btn-ghost" style={{ marginTop: 8, paddingLeft: 0 }} disabled={busy || paletteLocked} onClick={() => { end(); setRecipe(r => ({ ...r, palette: applyPalette(r.palette, allPresets.find(p => p.family === r.family)!.palette, locks.palette), review: 'candidate' })); }}>Restore study palette</button>
    </section>
  </>;
}
