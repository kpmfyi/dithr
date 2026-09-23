import { controls, validateRecipe, type Parameters, type Recipe } from '../seedbank/recipes.ts';

import { palettePresets, type PalettePreset } from './palettes.ts';
export { palettePresets } from './palettes.ts';

export type Locks = Record<keyof Parameters | 'seed', boolean> & { palette: [boolean, boolean, boolean] };
export const defaultLocks: Locks = { seed: false, scale: false, speed: true, intensity: false, detail: false, palette: [false, false, false] };
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
    const available = palettePool.filter(p => p.colors.some((c, i) => !locks.palette[i] && c.toLowerCase() !== next.palette[i].toLowerCase()));
    if (available.length) next.palette = applyPalette(next.palette, available[Math.floor(random() * available.length)].colors, locks.palette);
  }
  if (action === 'shuffle') {
    // Include all role arrangements, excluding identity and any moved locked slot.
    const permutations = [[1, 0, 2], [2, 1, 0], [0, 2, 1], [1, 2, 0], [2, 0, 1]];
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
  return current.map((c, i) => locked[i] ? c : colors[i]) as Recipe['palette'];
}
