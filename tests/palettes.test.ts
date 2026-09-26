import assert from 'node:assert/strict';
import test from 'node:test';
import { paletteCollections, palettePresets, paletteQuality, filterPalettes, paletteVariant } from '../src/workbench/palettes.ts';
import { defaultLocks, explore, type Locks } from '../src/workbench/exploration.ts';
import { presets, parseRecipe, serializeRecipe, GENERATOR_VERSION } from '../src/seedbank/recipes.ts';

test('1000 palettes contain distinct combinations, portable hex colors and perceptually separated roles', () => {
  assert.equal(palettePresets.length, 1000);
  assert.equal(new Set(palettePresets.map(p => p.id)).size, 1000);
  assert.equal(new Set(palettePresets.map(p => p.name)).size, 1000);
  // A reordered color set does not count as an additional color combination.
  assert.equal(new Set(palettePresets.map(p => [...p.colors].sort().join(','))).size, 1000);
  for (const collection of paletteCollections) assert.equal(filterPalettes(collection.id).length, collection.id === 'signature' ? 12 : ({ mood: 35, hours: 12, weather: 12, cinema: 12, genre: 14, machines: 14, movements: 14, materials: 14, now: 14, glitch: 14, circuits: 14, signage: 14, maps: 13 } as Record<string, number>)[collection.id] ?? 72);
  // Hand-authored collections carry five distinct roles.
  for (const id of ['signature', 'mood', 'hours', 'weather', 'cinema', 'genre', 'machines', 'movements', 'materials', 'now', 'glitch', 'circuits', 'signage', 'maps']) assert.ok(filterPalettes(id).every(p => p.colors.length === 5 && new Set(p.colors).size === 5), id);
  for (const palette of palettePresets) {
    const quality = paletteQuality(palette.colors);
    assert.ok(quality.contrast >= (palette.collection === 'signature' ? 3 : 5), palette.id);
    // Perceptual (OKLab) separation replaces the earlier RGB-distance gate; RGB stays as a floor.
    assert.ok(quality.minDeltaE >= .085, `${palette.id} ΔE ${quality.minDeltaE.toFixed(3)}`);
    assert.ok(quality.minDistance >= .15, palette.id);
    const input = { ...presets.find(p => p.family === 'broken-lcd')!, generatorVersion: GENERATOR_VERSION, palette: palette.colors };
    assert.deepEqual(parseRecipe(serializeRecipe(input)), input);
  }
  assert.equal(paletteQuality(['#000000', '#808080', '#ffffff']).contrast, 21);
  assert.deepEqual(palettePresets.find(p => p.id === 'hot-press')?.colors.slice(0, 3), ['#ece3d0', '#ff4b2e', '#1b2432']);
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
    assert.ok(pool.some(p => JSON.stringify(paletteVariant(p.colors, 3)) === JSON.stringify(next.palette)));
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

test('generated structures sit on evenly spaced OKLCH hues with a balanced mix of grounds and energy', async () => {
  const { hexToOklch } = await import('../src/workbench/oklab.ts');
  const { paletteVibes } = await import('../src/workbench/palettes.ts');
  // Each structure's 18 variants keep one value pattern: ground lightness varies little around the wheel.
  for (const collection of ['electric', 'print', 'night', 'earth', 'pastel', 'duotone', 'industrial', 'experimental', 'signal', 'bitmap', 'midtone']) {
    const byTemplate = new Map<string, number[]>();
    for (const p of filterPalettes(collection)) { const t = p.name.split(' ').slice(1).join(' '); byTemplate.set(t, [...(byTemplate.get(t) ?? []), hexToOklch(p.colors[0])[0]]); }
    for (const [name, grounds] of byTemplate) { assert.equal(grounds.length, 18, name); assert.ok(Math.max(...grounds) - Math.min(...grounds) < .16, `${name} ground lightness spread`); }
  }
  const vibes = palettePresets.map(p => paletteVibes(p.colors));
  const share = (key: 'tone' | 'energy' | 'temperature', value: string) => vibes.filter(v => v[key] === value).length / vibes.length;
  for (const tone of ['light', 'mid', 'dark']) assert.ok(share('tone', tone) >= .15, tone);
  for (const energy of ['muted', 'balanced', 'vivid']) assert.ok(share('energy', energy) >= .12, energy);
  for (const temperature of ['warm', 'cool', 'neutral']) assert.ok(share('temperature', temperature) >= .15, temperature);
  // Vibe words are searchable and intersect with other terms.
  assert.ok(filterPalettes('all', 'dark vivid').length > 20);
  assert.ok(filterPalettes('all', 'dark vivid').every(p => paletteVibes(p.colors).tone === 'dark' || p.name.toLowerCase().includes('dark')));
});
test('completing a custom palette keeps its colors and stays inside its hue families', async () => {
  const { completePalette } = await import('../src/workbench/palettes.ts');
  const { hexToOklch, deltaE } = await import('../src/workbench/oklab.ts');
  const custom: [string, string, string] = ['#1b2a41', '#e4572e', '#f2eee3'];
  const full = completePalette(custom);
  assert.deepEqual(full.slice(0, 3), custom);
  for (const added of full.slice(3)) {
    assert.ok(custom.every(c => deltaE(c, added) >= .08), added);
    const hue = hexToOklch(added)[2];
    assert.ok(custom.some(c => { const [, C, h] = hexToOklch(c); const d = Math.abs(((hue - h + 540) % 360) - 180); return C < .02 || d <= 31; }), `${added} hue`);
  }
});
