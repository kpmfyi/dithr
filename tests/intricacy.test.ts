import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntricacyEvolution, intricacyRandom } from '../src/seedbank/intricacy-evolution.ts';
import { advanceTime, timeLimit, presets, intricacyFamilies, parseRecipe, serializeRecipe, validateRecipe } from '../src/seedbank/recipes.ts';

test('intricacy scores retain fresh events beyond a 32-bit index and the previous ten-year horizon', () => {
  for (const seed of [0, 32173, 65535]) {
    const evolution = createIntricacyEvolution(seed);
    for (const index of [-1, 0, 4096, 4294967295, 4294967296, 1e12]) {
      assert.notEqual(intricacyRandom(seed, index, 91), intricacyRandom(seed, index + 4294967296, 91));
    }
    for (const time of [-3, 0, 3.25, 3600, 315360000, 1e10, 2e12]) {
      const a = evolution.sample(time);
      assert.deepEqual(a, createIntricacyEvolution(seed).sample(time));
      assert.ok(a.events.some(e => e.a[3] > 0));
      assert.ok([...a.drift, ...a.warp, ...a.events.flatMap(e => [...e.a, ...e.b])].every(Number.isFinite));
      assert.notDeepEqual(a, evolution.sample(time + .25));
      assert.notDeepEqual(a, evolution.sample(time + 3600));
    }
  }
});

test('new recipes round-trip late time, preserve old bounds and reject incompatible generators', () => {
  for (const family of intricacyFamilies) {
    const recipe = presets.find(r => r.family === family)!;
    for (const time of [3600.1, 315360001, 1e10, timeLimit(family)]) {
      assert.deepEqual(parseRecipe(serializeRecipe({ ...recipe, time })), { ...recipe, time });
    }
    assert.ok(advanceTime(family, 3599.99, .02) > 3600);
    assert.ok(advanceTime(family, 315360000, .1) > 315360000);
    assert.equal(advanceTime(family, timeLimit(family), 1), timeLimit(family));
    for (const generatorVersion of ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0']) {
      assert.throws(() => validateRecipe({ ...recipe, generatorVersion }), /requires generator/);
    }
    for (const time of [NaN, Infinity, -1, timeLimit(family) + 1]) assert.throws(() => validateRecipe({ ...recipe, time }));
  }
  assert.equal(timeLimit('rift'), 315360000);
  assert.equal(timeLimit('broken-lcd'), 3600);
});
