import assert from 'node:assert/strict';
import test from 'node:test';
import { controls, parseRecipe, allPresets as presets, serializeRecipe } from '../src/seedbank/recipes.ts';
import { applyPalette, defaultLocks, explore, palettePresets, parameterKeys, type ExploreAction, type Locks } from '../src/workbench/exploration.ts';
import { editRecipe, travelRecipe, type RecipeHistory } from '../src/workbench/history.ts';

const unlocked: Locks = { seed: false, scale: false, speed: false, intensity: false, detail: false, palette: [false, false, false] };
const actions: ExploreAction[] = ['all', 'parameters', 'nudge', 'seed', 'palette', 'shuffle'];
test('exploration remains portable and deterministic for every family at parameter boundaries', () => {
  for (const base of presets) for (const action of actions) for (const entropy of [0, 1, 4294967295]) {
    const next = explore(base, action, entropy, unlocked, 1);
    assert.deepEqual(next, explore(base, action, entropy, unlocked, 1));
    assert.deepEqual(parseRecipe(serializeRecipe(next)), next);
    assert.equal(next.family, base.family); assert.equal(next.time, base.time); assert.equal(next.name, base.name);
    assert.notEqual(next, base);
  }
  for (const boundary of ['min', 'max'] as const) {
    const base = structuredClone(presets[0]);
    for (const key of parameterKeys) base.parameters[key] = controls[key][boundary];
    for (let entropy = 0; entropy < 100; entropy++) parseRecipe(serializeRecipe(explore(base, 'nudge', entropy, unlocked, 1)));
  }
  assert.throws(() => explore(presets[0], 'all', NaN, unlocked));
  assert.throws(() => explore(presets[0], 'nudge', 1, unlocked, Infinity));
});
test('all random actions respect individual locks and frozen time', () => {
  const base = presets.at(-1)!;
  const locked: Locks = { seed: true, scale: true, speed: true, intensity: true, detail: true, palette: [true, true, true] };
  for (const action of actions) assert.deepEqual(explore(base, action, 59, locked), base);
  for (const key of [...parameterKeys, 'seed'] as const) {
    const next = explore(base, 'all', 673, { ...unlocked, [key]: true });
    assert.equal(key === 'seed' ? next.seed : next.parameters[key], key === 'seed' ? base.seed : base.parameters[key]);
  }
  for (let i = 0; i < 3; i++) for (const action of actions) {
    const locks = structuredClone(unlocked); locks.palette[i] = true;
    assert.equal(explore(base, action, 578, locks).palette[i], base.palette[i]);
  }
  assert.equal(explore(base, 'all', 945, defaultLocks).parameters.speed, base.parameters.speed);
});
test('focused rerolls do not disturb other inputs and nudge respects its distance', () => {
  const base = presets[16];
  const seed = explore(base, 'seed', 22, unlocked);
  assert.notEqual(seed.seed, base.seed); assert.deepEqual(seed.parameters, base.parameters); assert.deepEqual(seed.palette, base.palette);
  const params = explore(base, 'parameters', 22, unlocked);
  assert.equal(params.seed, base.seed); assert.deepEqual(params.palette, base.palette); assert.notDeepEqual(params.parameters, base.parameters);
  const palette = explore(base, 'palette', 22, unlocked);
  assert.equal(palette.seed, base.seed); assert.deepEqual(palette.parameters, base.parameters); assert.notDeepEqual(palette.palette, base.palette);
  for (let entropy = 0; entropy < 100; entropy++) {
    const nudge = explore(base, 'nudge', entropy, unlocked, 0.02);
    assert.equal(nudge.seed, base.seed); assert.deepEqual(nudge.palette, base.palette);
    for (const key of parameterKeys) assert.ok(Math.abs(nudge.parameters[key] - base.parameters[key]) <= 0.02 * (controls[key].max - controls[key].min) + 0.00051);
  }
  const swapped = explore(base, 'shuffle', 67, { ...unlocked, palette: [true, false, false] });
  assert.deepEqual(swapped.palette, [base.palette[0], base.palette[2], base.palette[1]]);
  for (const p of palettePresets) {
    assert.deepEqual(applyPalette(base.palette, p.colors, [true, false, false]), [base.palette[0], p.colors[1], p.colors[2]]);
    parseRecipe(serializeRecipe({ ...base, palette: p.colors }));
  }
});
test('history groups a drag, restores exact recipes, branches safely and bounds memory', () => {
  const start = presets[0];
  let h: RecipeHistory = { past: [], present: start, future: [] };
  h = editRecipe(h, { ...start, parameters: { ...start.parameters, scale: 2.001 } });
  h = editRecipe(h, { ...start, parameters: { ...start.parameters, scale: 2.019 } }, true);
  assert.equal(h.past.length, 1);
  const final = h.present;
  h = travelRecipe(h, 'undo'); assert.deepEqual(h.present, start);
  h = travelRecipe(h, 'redo'); assert.deepEqual(h.present, final);
  h = travelRecipe(h, 'undo');
  h = editRecipe(h, explore(start, 'all', 91, unlocked));
  assert.equal(h.future.length, 0);
  assert.equal(editRecipe(h, h.present), h);
  for (let i = 0; i < 100; i++) h = editRecipe(h, { ...h.present, seed: i });
  assert.equal(h.past.length, 80);
});
