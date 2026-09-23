import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntropyEvolution } from '../src/seedbank/entropy-evolution.ts';
import { advanceTime, timeLimit, presets, parseRecipe, serializeRecipe, validateRecipe } from '../src/seedbank/recipes.ts';

test('event births continue across old loop boundaries and at very late times', () => {
  for (const seed of [0, 11903, 65535]) {
    const score = createEntropyEvolution(seed);
    for (const time of [-3, 0, 3.25, 60, 3600, 7200, 86400, 315360000 * 2]) {
      const sample = score.sample(time);
      assert.deepEqual(sample, createEntropyEvolution(seed).sample(time));
      assert.ok(sample.events.some(e => e.a[3] > 0), `birth schedule remains active at ${time}`);
      assert.ok([...sample.drift, ...sample.warp, ...sample.events.flatMap(e => [...e.a, ...e.b])].every(Number.isFinite));
      assert.notDeepEqual(sample, score.sample(time + 3600));
      assert.notDeepEqual(sample.events.map(e => e.index), score.sample(time + 15).events.map(e => e.index));
    }
    const sample = score.sample(5000);
    const gaps = sample.events.slice(1).map((e, i) => sample.events[i].start - e.start);
    assert.ok(gaps.every(gap => gap > .47 && gap < 3));
    assert.equal(new Set(gaps).size, gaps.length);
    // There is always a continuing event between births, not a pulse/empty cycle.
    for (let t = 0; t <= 180; t += .17) assert.ok(score.sample(t).events.some(e => e.a[3] > 0));
  }
});

test('entropy playback and frozen recipes pass one hour without wrapping', () => {
  const rift = presets.find(r => r.family === 'rift')!;
  assert.ok(Math.abs(advanceTime('rift', 3599.99, .02) - 3600.01) < 1e-9);
  assert.equal(advanceTime('rift', timeLimit('rift'), .1), timeLimit('rift'));
  assert.ok(advanceTime('broken-lcd', 3599.99, .02) < 1);
  for (const time of [3600, 3600.01, 86400, 315360000]) {
    const recipe = { ...rift, time };
    assert.deepEqual(parseRecipe(serializeRecipe(recipe)), recipe);
  }
  assert.throws(() => validateRecipe({ ...rift, time: timeLimit('rift') + 1 }));
  assert.throws(() => validateRecipe({ ...presets[0], time: 3601 }));
});
