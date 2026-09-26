import { allPresets, controls, families, GENERATOR_VERSION, validateRecipe, type Parameters, type Recipe, type PaletteSize } from '../seedbank/recipes.ts';

import { palettePresets, paletteVariant, type PalettePreset } from './palettes.ts';
export { palettePresets } from './palettes.ts';

export type Locks = Record<keyof Parameters | 'seed', boolean> & { palette: boolean[] };
export const defaultLocks: Locks = { seed: false, scale: false, speed: true, intensity: false, detail: false, palette: [false, false, false, false, false] };
export type ExploreAction = 'all' | 'parameters' | 'nudge' | 'seed' | 'palette' | 'shuffle';
export const parameterKeys = Object.keys(controls) as (keyof Parameters)[];
export const precisionStep = 0.001;

// Entropy is supplied by the viewer. The same starting recipe, options and entropy
// always produce the same portable recipe; renderer time/randomness are untouched.
export function explore(base: Recipe, action: ExploreAction, entropy: number, locks: Locks, amount = 0.08, palettePool: readonly PalettePreset[] = palettePresets): Recipe {
  const next = validateRecipe(base);
  if (!Number.isInteger(entropy) || entropy < 0 || entropy > 0xffffffff) throw new Error('Invalid exploration seed');
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) throw new Error('Invalid nudge amount');
  let state = entropy >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
  if ((action === 'all' || action === 'seed') && !locks.seed) {
    next.seed = (next.seed + 1 + Math.floor(random() * 65535)) % 65536;
  }
  if (action === 'all' || action === 'parameters' || action === 'nudge') {
    for (const key of parameterKeys) {
      if (locks[key]) continue;
      const { min, max } = controls[key];
      let value = action === 'nudge'
        ? next.parameters[key] + (random() * 2 - 1) * amount * (max - min)
        : min + random() * (max - min);
      // Reflect nudges at the bounds instead of repeatedly pinning them there.
      if (value < min) value = min + (min - value);
      if (value > max) value = max - (value - max);
      next.parameters[key] = +Math.max(min, Math.min(max, value)).toFixed(3);
    }
  }
  if (action === 'palette' || action === 'all') {
    const available = palettePool.filter(p => paletteVariant(p.colors, next.palette.length as PaletteSize).some((c, i) => !locks.palette[i] && c.toLowerCase() !== next.palette[i].toLowerCase()));
    if (available.length) next.palette = applyPalette(next.palette, available[Math.floor(random() * available.length)].colors, locks.palette);
  }
  if (action === 'shuffle') {
    // Include all role arrangements, excluding identity and any moved locked slot.
    const permute = (items: number[]): number[][] => items.length === 0 ? [[]] : items.flatMap((n, i) => permute(items.filter((_, j) => j !== i)).map(tail => [n, ...tail]));
    const permutations = permute(next.palette.map((_, i) => i));
    const available = permutations.filter(order => order.every((source, slot) => !locks.palette[slot] || source === slot))
      .map(order => order.map(source => next.palette[source]) as Recipe['palette'])
      .filter(colors => colors.some((color, i) => color.toLowerCase() !== next.palette[i].toLowerCase()));
    if (available.length) next.palette = available[Math.floor(random() * available.length)];
  }

  if (next.seed === base.seed && JSON.stringify(next.parameters) === JSON.stringify(base.parameters) && JSON.stringify(next.palette) === JSON.stringify(base.palette)) return next;
  next.review = 'candidate';
  return validateRecipe(next);
}
export function applyPalette(current: Recipe['palette'], colors: Recipe['palette'], locked: Locks['palette']): Recipe['palette'] {
  const scaled = paletteVariant(colors, current.length as PaletteSize);
  return current.map((c, i) => locked[i] ? c : scaled[i]) as Recipe['palette'];
}

export type RollScope = { study: boolean; palette: boolean; shape: boolean; seed: boolean };
export const defaultScope: RollScope = { study: true, palette: true, shape: true, seed: true };
/** The public roll. Unlike explore('all'), parameters are drawn around each
 * study's own defaults (scale multiplicatively, intensity within ±.4, detail
 * across most of its range), so nearly every roll stays inside the study's good
 * zone. Motion keeps its lock. A new study keeps the current colors unless the
 * palette is rolled too. Deterministic for a given entropy value. */
export function roll(base: Recipe, scope: RollScope, entropy: number, locks: Locks, palettePool: readonly PalettePreset[] = palettePresets, studyPool: readonly Recipe[] = allPresets): Recipe {
  const current = validateRecipe(base);
  if (!Number.isInteger(entropy) || entropy < 0 || entropy > 0xffffffff) throw new Error('Invalid roll entropy');
  let state = entropy >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => { const u = Math.max(1e-9, random()), v = random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const others = studyPool.filter(r => r.family !== current.family);
  const study = scope.study && others.length ? others[Math.floor(random() * others.length)] : studyPool.find(r => r.family === current.family) ?? allPresets.find(r => r.family === current.family)!;
  const next: Recipe = { ...current, family: study.family, generatorVersion: GENERATOR_VERSION, parameters: { ...(study.family === current.family ? current.parameters : study.parameters) }, palette: [...current.palette] as Recipe['palette'], review: 'candidate' };
  if (scope.seed && !locks.seed) next.seed = Math.floor(random() * 65536);
  if (scope.shape) {
    const defaults = study.parameters;
    const clamp = (key: keyof Parameters, value: number) => +Math.max(controls[key].min, Math.min(controls[key].max, value)).toFixed(3);
    if (!locks.scale) next.parameters.scale = clamp('scale', defaults.scale * Math.exp(gauss() * .42));
    if (!locks.intensity) next.parameters.intensity = clamp('intensity', Math.max(.45, Math.min(1.8, defaults.intensity + (random() * 2 - 1) * .4)));
    if (!locks.detail) next.parameters.detail = clamp('detail', .08 + random() * .87);
    if (!locks.speed) next.parameters.speed = clamp('speed', defaults.speed * (.65 + random() * .7));
  }
  if (scope.palette) {
    const size = next.palette.length as PaletteSize;
    const available = palettePool.filter(p => paletteVariant(p.colors, size).some((c, i) => !locks.palette[i] && c.toLowerCase() !== next.palette[i].toLowerCase()));
    if (available.length) next.palette = applyPalette(next.palette, available[Math.floor(random() * available.length)].colors, locks.palette);
  }
  next.id = `${next.family}-${next.seed}`.slice(0, 64);
  next.name = `${families[next.family].name} ${next.seed}`;
  return validateRecipe(next);
}
