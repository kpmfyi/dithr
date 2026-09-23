import assert from 'node:assert/strict';
import test from 'node:test';
import { demos, allDemos, findDemo } from '../src/demos/catalog.ts';
import { presets, allPresets, parseRecipe, serializeRecipe } from '../src/seedbank/recipes.ts';

test('every shader has a separate, portable context recipe without shared mutable catalog inputs', () => {
  assert.deepEqual(demos.map(demo => demo.family).sort(), presets.map(recipe => recipe.family).sort());
  assert.equal(new Set(demos.map(demo => demo.recipe.id)).size, presets.length);
  assert.deepEqual(allDemos.map(d => d.family).sort(), allPresets.map(r => r.family).sort());
  assert.deepEqual(demos.map(d => d.family), presets.map(r => r.family));
  for (const demo of allDemos) {
    const original = allPresets.find(recipe => recipe.family === demo.family)!;
    assert.notEqual(demo.recipe.id, original.id);
    assert.notStrictEqual(demo.recipe.parameters, original.parameters);
    assert.notStrictEqual(demo.recipe.palette, original.palette);
    assert.notStrictEqual(demo.recipe.tags, original.tags);
    assert.deepEqual(parseRecipe(serializeRecipe(demo.recipe)), demo.recipe);
  }
});

test('demo links resolve only explicit built-in family names', () => {
  for (const family of [null, '', '__proto__', 'toString', 'constructor', '../../etc', 'CAUSTICS', '<script>']) assert.equal(findDemo(family), undefined);
  for (const demo of allDemos) assert.equal(findDemo(demo.family), demo);
});
