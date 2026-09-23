import assert from 'node:assert/strict';
import test from 'node:test';
import { presets, allPresets, deprecatedPresets, damageFamilies, entropyFamilies, intricacyFamilies, isIntricacy, isEntropy, isCrisp, isDamage, isPixelSorter, isDeparture, parseRecipe, serializeRecipe, validateRecipe, variation } from '../src/seedbank/recipes.ts';

test('all catalog recipes survive export and reopen with every rendering input intact', () => {
  for (const recipe of allPresets) {
    assert.deepEqual(parseRecipe(serializeRecipe(recipe)), recipe);
    const copy = validateRecipe(recipe); copy.palette[0] = '#ffffff'; copy.parameters.scale = 11;
    assert.notDeepEqual(copy, recipe); assert.notEqual(copy.palette[0], recipe.palette[0]);
  }
});
test('rejects untrusted or incompatible recipes before they reach the GPU', () => {
  for (const patch of [ { schemaVersion: 2 }, { generatorVersion: '9.0.0' }, { generatorVersion: ['1.1.0'] }, { generatorVersion: null }, { family: '__proto__' }, { family: 'toString' }, { seed: NaN }, { seed: 1.2 }, { seed: -1 }, { seed: 65536 }, { time: Infinity }, { time: -0.1 }, { palette: ['red', '#000000', '#ffffff'] }, { name: '' }, { id: '../escape' }, { kind: 'script' }, { parameters: { ...presets[0].parameters, scale: 1000 } }, { review: 'approved-by-ai' } ]) {
    assert.throws(() => validateRecipe({ ...presets[0], ...patch }), JSON.stringify(patch));
  }
  assert.throws(() => parseRecipe('x'.repeat(16385)));
  assert.throws(() => parseRecipe('not JSON'));
});
test('variations are deterministic and change geometry rather than only palette', () => {
  for (const preset of allPresets) for (const seed of [0, 1, 284, 65535]) {
    const next = variation(preset, seed);
    assert.deepEqual(next, variation(preset, seed)); assert.deepEqual(next.palette, preset.palette);
    assert.notDeepEqual(next.parameters, preset.parameters); assert.equal(next.review, 'candidate');
    assert.deepEqual(validateRecipe(next), next);
  }
});

test('legacy recipes reopen unchanged while new families require the newer generator', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const recipe of allPresets.filter(recipe => recipe.generatorVersion === '1.0.0')) {
    const stored = JSON.parse(await readFile(new URL(`../catalog/recipes/${recipe.id}.json`, import.meta.url), 'utf8'));
    assert.deepEqual(parseRecipe(serializeRecipe(stored)), stored);
    assert.deepEqual(recipe, stored);
    assert.equal(recipe.generatorVersion, '1.0.0');
  }
  for (const recipe of allPresets.filter(recipe => recipe.generatorVersion !== '1.0.0')) {
    assert.equal(recipe.generatorVersion, isIntricacy(recipe.family) ? '1.6.0' : isEntropy(recipe.family) ? '1.5.0' : isDamage(recipe.family) ? '1.4.0' : isDeparture(recipe.family) ? '1.3.0' : isPixelSorter(recipe.family) ? '1.2.0' : '1.1.0');
    if (isEntropy(recipe.family)) for (const generatorVersion of ['1.1.0', '1.2.0', '1.3.0', '1.4.0']) assert.throws(() => validateRecipe({ ...recipe, generatorVersion }), /requires generator/);
    if (isDamage(recipe.family)) for (const generatorVersion of ['1.1.0', '1.2.0', '1.3.0']) assert.throws(() => validateRecipe({ ...recipe, generatorVersion }), /requires generator/);
    assert.deepEqual(validateRecipe({ ...recipe, generatorVersion: '1.6.0' }).family, recipe.family);
    if (isDeparture(recipe.family)) for (const generatorVersion of ['1.1.0', '1.2.0']) assert.throws(() => validateRecipe({ ...recipe, generatorVersion }), /requires generator/);
    if (isPixelSorter(recipe.family)) assert.throws(() => validateRecipe({ ...recipe, generatorVersion: '1.1.0' }), /requires generator/);
    assert.throws(() => validateRecipe({ ...recipe, generatorVersion: '1.0.0' }), /requires generator/);
  }
});

test('every registered study has a unique recipe and one complete family definition', async () => {
  const { families } = await import('../src/seedbank/recipes.ts');
  assert.equal(new Set(allPresets.map(r => r.id)).size, allPresets.length);
  assert.deepEqual(allPresets.map(r => r.family).sort(), Object.keys(families).sort());
  assert.equal(new Set(Object.values(families).map(f => f.number)).size, allPresets.length);
});

// Browsing order and compatibility are separate contracts.
test('forty sharp studies lead with the ten endorsed studies; old recipes stay archived', () => {
  assert.deepEqual(presets.slice(0, 10).map(r => r.family), ['broken-lcd', 'crosscurrent', 'undertow', 'downpour', 'faultline', 'rotor', 'slingshot', 'cell-division', 'shockfront', 'filament']);
  assert.deepEqual(presets.slice(10, 20).map(r => r.family), [...damageFamilies]);
  assert.deepEqual(presets.slice(20, 30).map(r => r.family), [...entropyFamilies]);
  assert.deepEqual(presets.slice(30).map(r => r.family), [...intricacyFamilies]);
  assert.equal(presets.length, 40); assert.equal(deprecatedPresets.length, 15); assert.equal(allPresets.length, 55);
  assert.ok(presets.every(r => isCrisp(r.family)));
  assert.ok(deprecatedPresets.every(r => !isCrisp(r.family)));
  assert.equal(presets.filter(r => r.tags.includes('grid only')).length, 5);
  assert.equal(new Set([...presets, ...deprecatedPresets].map(r => r.family)).size, allPresets.length);
});
