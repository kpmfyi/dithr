import test from 'node:test';
import assert from 'node:assert/strict';
import { allPresets, GENERATOR_VERSION, parseRecipe, serializeRecipe, validateRecipe } from '../src/seedbank/recipes.ts';
import { completePalette, palettePresets, paletteVariant } from '../src/workbench/palettes.ts';
import { defaultLocks, explore } from '../src/workbench/exploration.ts';
import { integrationCode, reactCode, typescriptCode } from '../src/workbench/export.ts';
import { rotatePalette } from '../src/workbench/color.ts';

test('every family round trips 2–5 colors and exports every selected color', () => {
  for (const base of allPresets) for (const size of [2, 3, 4, 5] as const) {
    const recipe = { ...base, generatorVersion: GENERATOR_VERSION, palette: paletteVariant(completePalette(base.palette), size) };
    assert.deepEqual(parseRecipe(serializeRecipe(recipe)), recipe);
    const output = { width: 640, height: 480, animate: true, backend: 'auto' as const };
    for (const code of [integrationCode(recipe, output), reactCode(recipe, output), typescriptCode(recipe, output)]) {
      assert.ok(code.includes(serializeRecipe(recipe).trim()));
    }
    assert.equal(rotatePalette(recipe.palette, 45).length, size);
  }
  for (const palette of [[], ['#000000'], Array(6).fill('#000000'), ['#000000', null], Array(3), ['#000000', '#fff']]) {
    assert.throws(() => validateRecipe({ ...allPresets[0], generatorVersion: GENERATOR_VERSION, palette }));
  }
  assert.throws(() => validateRecipe({ ...allPresets[0], generatorVersion: '1.7.0', palette: ['#000000', '#ffffff'] }), /1.8.0/);
});

test('catalog reductions preserve role order; resizing never discards active custom hex values', () => {
  for (const p of palettePresets) {
    assert.equal(p.colors.length, 5);
    assert.equal(new Set(p.colors).size, 5);
    for (const size of [2, 3, 4, 5] as const) assert.deepEqual(paletteVariant(p.colors, size), p.colors.slice(0, size));
  }
  const custom = ['#121212', '#323232'] as [string, string];
  assert.deepEqual(completePalette(custom).slice(0, 2), custom);
  assert.deepEqual(completePalette(completePalette(custom)), completePalette(custom));
});

test('rerolls and permutations preserve count, locks and selected palette pool at every size', () => {
  for (const size of [2, 3, 4, 5] as const) {
    const base = { ...allPresets[0], generatorVersion: GENERATOR_VERSION, palette: paletteVariant(palettePresets[0].colors, size) };
    const locked = { ...defaultLocks, palette: [true, false, false, false, true] };
    for (const action of ['all', 'palette', 'shuffle'] as const) for (const entropy of [0, 27, 65535]) {
      const next = explore(base, action, entropy, locked, .08, palettePresets.slice(1, 3));
      assert.equal(next.palette.length, size);
      assert.equal(next.palette[0], base.palette[0]);
      if (size === 5) assert.equal(next.palette[4], base.palette[4]);
      assert.deepEqual(parseRecipe(serializeRecipe(next)), next);
      if (action === 'shuffle') assert.deepEqual([...next.palette].sort(), [...base.palette].sort());
    }
    const allLocked = { ...defaultLocks, palette: Array(5).fill(true) };
    assert.deepEqual(explore(base, 'palette', 4, allLocked), base);
    assert.deepEqual(explore(base, 'shuffle', 4, allLocked), base);
  }
});
