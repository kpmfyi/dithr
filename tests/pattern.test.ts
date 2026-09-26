import assert from 'node:assert/strict';
import test from 'node:test';
import { createKitEvolution } from '../src/seedbank/kit-evolution.ts';
import { bandHeights, frameWrap, patternControls, patternSalt } from '../src/seedbank/pattern-evolution.ts';
import { patternFamilies } from '../src/seedbank/pattern-meta.ts';
import { advanceTime, parseRecipe, presets, serializeRecipe, timeLimit, validateRecipe } from '../src/seedbank/recipes.ts';

// Priming starts before frame 0; late frames reach the 10¹² s horizon at 60 Hz.
const frames = [-129, -1, 0, 1, 4096, 4294967296, 1e10, 1e12 * 60 * 2 - 3];
const evolution = (family: typeof patternFamilies[number], seed: number) => createKitEvolution(seed, patternSalt, patternControls(family));

test('pattern controls are deterministic, finite, bounded and keep changing at late frames', () => {
  for (const family of patternFamilies) for (const seed of [0, 23981, 65535]) {
    const score = evolution(family, seed);
    for (const frame of frames) {
      const a = score.sample(frame);
      assert.deepEqual(a, evolution(family, seed).sample(frame), `${family} ${frame}`);
      const values = [...a.control, ...a.control2];
      assert.ok(values.every(Number.isFinite), `${family} finite at ${frame}`);
      // Everything reaches the GPU as float32: keep magnitudes where integers stay exact.
      assert.ok(values.every(v => Math.abs(v) < 16777216), `${family} bounded at ${frame}: ${values}`);
      assert.notDeepEqual([a.control, a.control2, a.drift], (() => { const b = score.sample(frame + 900); return [b.control, b.control2, b.drift]; })(), `${family} changes`);
    }
  }
});

test('wrapped phases are seamless: every wrap lands on a whole visual period', () => {
  // Shared counter F wraps where belts (150 × 64), retypes (1800), re-dyes (2400) and climbs align.
  for (const period of [150 * 64, 1800, 2400]) assert.equal(frameWrap % period, 0, String(period));
  for (const height of bandHeights) assert.equal((frameWrap / 8) % (8 * height), 0, `band ${height}`);
  const at = (family: typeof patternFamilies[number], frame: number) => evolution(family, 7).sample(frame);
  // Truchet fronts wrap after an even number of passes, so tile parity is unchanged.
  const wrapTruchet = 280 * 512;
  const jump = at('truchet', wrapTruchet).control2[0] - at('truchet', wrapTruchet - 1).control2[0];
  assert.ok(Math.abs(jump + 512 - 1 / 280) < 1e-9, `truchet wrap ${jump}`);
  // Bauhaus turns wrap after four quarter turns (a whole revolution).
  assert.ok(at('bauhaus', 479).control2[0] < 4 && at('bauhaus', 480).control2[0] === 0);
  // Ikat bundle walks wrap at 256 targets; T and the previous T stay one step apart.
  for (const frame of [-1, 0, 23039, 23040]) {
    const [T, before] = at('ikat', frame).control2;
    assert.ok(Math.abs(((T - before) % 256 + 256) % 256 - 1 / 90) < 1e-9, `ikat step at ${frame}`);
  }
});

test('pan deltas and shuttle positions stay within one step per frame', () => {
  for (const seed of [0, 23981]) for (const start of [0, 1e9, 1e12 * 60 * 2 - 5000]) {
    const score = evolution('tartan', seed);
    for (let frame = start; frame < start + 2000; frame += 7) {
      const [, , shuttle] = score.sample(frame).control, [, , dx, dy] = score.sample(frame).control2;
      assert.ok(Math.abs(dx) <= 2 && Math.abs(dy) <= 2, `pan delta ${dx},${dy}`);
      assert.ok(shuttle >= 0 && shuttle <= 1.02);
    }
  }
  const drops = evolution('marbling', 1);
  for (let frame = 0; frame <= 600; frame += 600) assert.equal(drops.sample(frame).control2[2], 0, 'stone drops start and end at zero radius');
});

test('pattern recipes are the ten studies 61–70 and require generator 1.9.0', () => {
  const recipes = patternFamilies.map(family => presets.find(r => r.family === family)!);
  assert.deepEqual(recipes.map(r => r.family), [...patternFamilies]);
  for (const recipe of recipes) {
    assert.equal(recipe.generatorVersion, '1.9.0');
    assert.equal(recipe.palette.length, 5);
    assert.deepEqual(parseRecipe(serializeRecipe({ ...recipe, time: 1e10 })), { ...recipe, time: 1e10 });
    assert.equal(advanceTime(recipe.family, timeLimit(recipe.family), 1), timeLimit(recipe.family));
    for (const generatorVersion of ['1.7.0', '1.8.0']) assert.throws(() => validateRecipe({ ...recipe, generatorVersion }), /requires generator/);
  }
});
