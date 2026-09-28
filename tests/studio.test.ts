import assert from 'node:assert/strict';
import test from 'node:test';
import { allPresets, presets, deprecatedPresets, validateRecipe, controls, GENERATOR_VERSION } from '../src/seedbank/recipes.ts';
import { decodeRecipe, encodeRecipe, recipeFromHash, recipeHash } from '../src/workbench/share.ts';
import { paletteTheme } from '../src/workbench/theme.ts';
import { defaultLocks, defaultScope, roll } from '../src/workbench/exploration.ts';
import { palettePresets, filterPalettes } from '../src/workbench/palettes.ts';
import { series, studiesIn } from '../src/workbench/series.ts';

test('share links round-trip every study and reject damaged tokens', () => {
  for (const recipe of allPresets) {
    const token = encodeRecipe(recipe);
    assert.match(token, /^[A-Za-z0-9_-]+$/);
    assert.deepEqual(decodeRecipe(token), recipe);
    assert.deepEqual(recipeFromHash(recipeHash(recipe)), recipe);
  }
  const named = { ...presets[0], name: 'Ünïcode · “quotes” ✳' };
  assert.deepEqual(decodeRecipe(encodeRecipe(named)), named);
  assert.equal(recipeFromHash(''), null);
  assert.equal(recipeFromHash('#section'), null);
  for (const bad of ['#r=', '#r=%%%', '#r=bm90IGpzb24', `#r=${encodeRecipe(presets[0]).slice(0, 40)}`]) assert.throws(() => recipeFromHash(bad));
  assert.throws(() => decodeRecipe(btoa(JSON.stringify({ ...presets[0], family: '__proto__' }))));
});

test('interface accents come from the palette and stay legible on the neutral chrome', () => {
  for (const palette of palettePresets) {
    for (const size of [2, 3, 5]) {
      const theme = paletteTheme(palette.colors.slice(0, size));
      assert.equal(theme.roles.length, 5);
      assert.ok(palette.colors.includes(theme.accent), palette.id);
      assert.ok(['#111111', '#f5f5f5'].includes(theme.onAccent));
      assert.match(theme.accentText, /^#[0-9a-f]{6}$/);
    }
  }
});

test('the public roll stays near each study\'s defaults, respects locks and draws from the chosen pools', () => {
  const pool = filterPalettes('machines');
  const studyPool = studiesIn('raster');
  let base = presets[0];
  const families = new Set<string>();
  for (let entropy = 1; entropy < 400; entropy++) {
    const next = roll(base, defaultScope, entropy * 2654435761 >>> 0, defaultLocks, pool, studyPool);
    assert.deepEqual(validateRecipe(next), next);
    assert.equal(next.generatorVersion, GENERATOR_VERSION);
    assert.ok(studyPool.some(r => r.family === next.family));
    assert.notEqual(next.family, base.family);
    families.add(next.family);
    const defaults = allPresets.find(r => r.family === next.family)!.parameters;
    assert.equal(next.parameters.speed, defaults.speed, 'motion stays locked by default');
    assert.ok(next.parameters.intensity >= .45 && next.parameters.intensity <= 1.8);
    assert.ok(next.parameters.scale >= controls.scale.min && next.parameters.scale <= controls.scale.max);
    assert.ok(pool.some(p => p.colors.slice(0, next.palette.length).join() === next.palette.join()));
    base = next;
  }
  assert.equal(families.size, studyPool.length);
  // Only the seed changes when only the seed is in scope.
  const seedOnly = roll(presets[5], { study: false, palette: false, shape: false, seed: true }, 99, defaultLocks);
  assert.equal(seedOnly.family, presets[5].family); assert.deepEqual(seedOnly.parameters, presets[5].parameters); assert.deepEqual(seedOnly.palette, presets[5].palette);
  // Locked colors and parameters survive a full roll.
  const locks = { ...defaultLocks, scale: true, palette: [true, false, true, false, false] };
  const locked = roll(presets[3], defaultScope, 1234, locks);
  assert.equal(locked.palette[0], presets[3].palette[0]); assert.equal(locked.palette[2], presets[3].palette[2]);
  assert.equal(roll(presets[3], defaultScope, 7, locks, palettePresets, [presets[3]]).family, presets[3].family);
});

test('series cover the active catalog exactly once, in order', () => {
  const listed = series.flatMap(s => s.families);
  assert.deepEqual(listed, presets.map(r => r.family));
  assert.equal(studiesIn('all').length, presets.length);
  for (const s of series) assert.equal(studiesIn(s.id).length, 10);
});

test('default study rolls use the active catalog while legacy recipes remain editable', () => {
  const active = new Set(presets.map(recipe => recipe.family));
  for (const base of deprecatedPresets) {
    assert.deepEqual(decodeRecipe(encodeRecipe(base)), base);
    for (let entropy = 0; entropy < 100; entropy++) {
      assert.ok(active.has(roll(base, defaultScope, entropy, defaultLocks).family));
    }
    const edited = roll(base, { ...defaultScope, study: false }, 42, defaultLocks);
    assert.equal(edited.family, base.family);
    assert.deepEqual(validateRecipe(edited), edited);
  }
});
