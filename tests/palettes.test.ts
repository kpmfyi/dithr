import assert from 'node:assert/strict';
import test from 'node:test';
import { paletteCollections, palettePresets, paletteQuality, filterPalettes } from '../src/workbench/palettes.ts';
import { defaultLocks, explore, type Locks } from '../src/workbench/exploration.ts';
import { presets, parseRecipe, serializeRecipe } from '../src/seedbank/recipes.ts';

test('588 palettes contain distinct combinations, portable hex colors and separated values', () => {
  assert.equal(palettePresets.length, 588);
  assert.equal(new Set(palettePresets.map(p => p.id)).size, 588);
  assert.equal(new Set(palettePresets.map(p => p.name)).size, 588);
  // A reordered triplet does not count as an additional color combination.
  assert.equal(new Set(palettePresets.map(p => [...p.colors].sort().join(','))).size, 588);
  for (const collection of paletteCollections) assert.equal(filterPalettes(collection.id).length, collection.id === 'signature' ? 12 : 72);
  for (const palette of palettePresets) {
    const quality = paletteQuality(palette.colors);
    assert.ok(quality.contrast >= (palette.collection === 'signature' ? 3 : 5), palette.id);
    assert.ok(quality.minDistance >= .25, palette.id);
    const input = { ...presets.find(p => p.family === 'broken-lcd')!, palette: palette.colors };
    assert.deepEqual(parseRecipe(serializeRecipe(input)), input);
  }
  assert.equal(paletteQuality(['#000000', '#808080', '#ffffff']).contrast, 21);
  assert.deepEqual(palettePresets.find(p => p.id === 'hot-press')?.colors, ['#ece3d0', '#ff4b2e', '#1b2432']);
});
test('collection, name and hex search support meaningful intersections', () => {
  assert.equal(filterPalettes('electric', 'rose').length, 4);
  assert.equal(filterPalettes('all', '  AMBER   afterhours ').length, 1);
  assert.equal(filterPalettes('all', '#0757ff')[0]?.id, 'electric-paper');
  assert.equal(filterPalettes('pastel', 'night').length, 0);
  assert.equal(filterPalettes('missing').length, 0);
});
test('rerolls use only the chosen palette pool, avoid immediate repeats and preserve locks', () => {
  const base = presets.find(p => p.family === 'broken-lcd')!;
  const pool = filterPalettes('experimental', 'collision');
  const seen = new Set();
  let previous = base;
  for (let entropy = 0; entropy < 200; entropy++) {
    const next = explore(previous, 'palette', entropy, defaultLocks, .08, pool);
    assert.ok(pool.some(p => JSON.stringify(p.colors) === JSON.stringify(next.palette)));
    assert.notDeepEqual(next.palette, previous.palette);
    assert.equal(next.seed, base.seed); assert.deepEqual(next.parameters, base.parameters);
    seen.add(next.palette.join(',')); previous = next;
    const locked: Locks = { ...defaultLocks, palette: [true, false, true] };
    const mixed = explore(base, 'all', entropy, locked, .08, pool);
    assert.equal(mixed.palette[0], base.palette[0]); assert.equal(mixed.palette[2], base.palette[2]);
    assert.ok(pool.some(p => p.colors[1] === mixed.palette[1]));
  }
  assert.equal(seen.size, pool.length);
  assert.deepEqual(explore(base, 'palette', 33, defaultLocks, .08, []), base);
  assert.deepEqual(explore(base, 'all', 33, defaultLocks, .08, []).palette, base.palette);
});
test('role shuffle reaches every alternate ordering while preserving locked slots', () => {
  const base = presets.find(p => p.family === 'broken-lcd')!;
  const seen = new Set();
  for (let entropy = 0; entropy < 100; entropy++) {
    const next = explore(base, 'shuffle', entropy, defaultLocks);
    assert.deepEqual([...next.palette].sort(), [...base.palette].sort());
    assert.notDeepEqual(next.palette, base.palette); seen.add(next.palette.join(','));
  }
  assert.equal(seen.size, 5);
  for (const slot of [0, 1, 2]) {
    const locked = structuredClone(defaultLocks); locked.palette[slot] = true;
    const next = explore(base, 'shuffle', 27, locked);
    assert.equal(next.palette[slot], base.palette[slot]); assert.notDeepEqual(next.palette, base.palette);
  }
});
