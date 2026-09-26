import { damageFamilies, entropyFamilies, intricacyFamilies, synthesisFamilies, mechanismFamilies, patternFamilies, rasterFamilies, matterFamilies, presets, type Family } from '../seedbank/recipes.ts';

/** Browsing groups for the active catalog, in catalog order. */
export const series: readonly { id: string; name: string; note: string; families: readonly Family[] }[] = [
  { id: 'signal', name: 'Signal', note: 'The first ten: torn LCD signals, sorted pixels and kinetic departures.', families: ['broken-lcd', 'crosscurrent', 'undertow', 'downpour', 'faultline', 'rotor', 'slingshot', 'cell-division', 'shockfront', 'filament'] },
  { id: 'damage', name: 'Damage', note: 'Punctured and misaddressed panels.', families: damageFamilies },
  { id: 'entropy', name: 'Entropy', note: 'No scanlines; fragments that keep arriving.', families: entropyFamilies },
  { id: 'intricacy', name: 'Intricacy', note: 'Dense incisions with interrupted raster flicker.', families: intricacyFamilies },
  { id: 'synthesis', name: 'Synthesis', note: 'Coupled systems where memory steers motion.', families: synthesisFamilies },
  { id: 'mechanism', name: 'Mechanism', note: 'Sorts, automata, datamosh and video feedback.', families: mechanismFamilies },
  { id: 'pattern', name: 'Pattern', note: 'Textiles, tiles, print and ornament.', families: patternFamilies },
  { id: 'raster', name: 'Raster', note: 'Fire, tunnels, starfields and other screen classics.', families: rasterFamilies },
  { id: 'matter', name: 'Matter', note: 'Water, stone, sky, swarms and smoke.', families: matterFamilies },
];
export const seriesOf = (family: Family) => series.find(s => s.families.includes(family));
/** Active presets in a series ('all' returns the whole active catalog). */
export const studiesIn = (id: string) => id === 'all' ? presets : presets.filter(recipe => series.find(s => s.id === id)?.families.includes(recipe.family));
