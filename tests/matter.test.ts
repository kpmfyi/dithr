import assert from 'node:assert/strict';
import test from 'node:test';
import { createKitEvolution } from '../src/seedbank/kit-evolution.ts';
import { matterControls, matterSalt } from '../src/seedbank/matter-evolution.ts';
import { matterFamilies, matterPresets } from '../src/seedbank/matter-meta.ts';
import { advanceTime, timeLimit, parseRecipe, serializeRecipe, validateRecipe, families } from '../src/seedbank/recipes.ts';

const score = (seed: number, family: typeof matterFamilies[number]) => createKitEvolution(seed, matterSalt, matterControls(family));
// Up to the 10¹² s horizon at the fastest motion setting (2×, 60 Hz).
const lateFrames = [0, 4096, 11816, 4294967296, 1e10, 1e12 * 60 * 2];

test('matter controls are deterministic, finite, GPU-safe and keep changing at late frames', () => {
  for (const family of matterFamilies) for (const seed of [0, 23981, 65535]) {
    const evolution = score(seed, family);
    for (const frame of lateFrames) {
      const a = evolution.sample(frame);
      assert.deepEqual(a, score(seed, family).sample(frame), family);
      const values = [...a.control, ...a.control2];
      assert.ok(values.every(Number.isFinite), `${family} finite at ${frame}`);
      // Everything the shaders receive as float stays small enough for float32 precision.
      assert.ok(values.every(v => Math.abs(v) < 1e5), `${family} bounded at ${frame}: ${values}`);
      const later = evolution.sample(frame + 216000);
      assert.notDeepEqual([...a.control, ...a.control2], [...later.control, ...later.control2], `${family} changes at ${frame}`);
    }
  }
});

test('wrapped offsets land exactly on their periods', () => {
  for (const frame of lateFrames) {
    const clouds = score(1, 'cumulus').sample(frame).control;
    for (const offset of clouds.slice(0, 3)) assert.ok(offset >= 0 && offset < 256);
    const borealis = score(1, 'borealis').sample(frame).control;
    assert.ok(borealis[2] >= 0 && borealis[2] < 64 && borealis[3] >= 0 && borealis[3] < 64);
    const turn = score(1, 'phyllotaxis').sample(frame).control[2];
    assert.ok(turn >= 0 && turn < Math.PI * 2);
    const agate = score(1, 'agate').sample(frame).control2[2];
    assert.ok(agate >= 0 && agate < 64);
    const strata = score(1, 'strata').sample(frame).control;
    assert.ok(strata[0] >= 0 && strata[0] < 3072 && [0, 1].includes(strata[1]));
  }
});

test('frame-to-frame transports are exact integer steps', () => {
  for (const seed of [0, 29581, 65535]) for (const start of [0, 1e7, 1e12 * 60 * 2 - 3000]) {
    const grain = score(seed, 'grain'), strata = score(seed, 'strata');
    for (let frame = start + 1; frame < start + 1500; frame += 7) {
      // Grain receives this frame's and last frame's plank tracks, so the shader's
      // floored difference is the true per-frame displacement.
      const now = grain.sample(frame), before = grain.sample(frame - 1);
      assert.equal(now.control2[0], before.control[0]); assert.equal(now.control2[1], before.control[1]);
      assert.ok(Math.abs(now.control[0] - before.control[0]) * 420 < 3, 'planks move at most a few pixels per frame');
      const sink = strata.sample(frame);
      assert.ok(sink.control[1] === 0 || sink.control[1] === 1);
    }
  }
});

test('strikes are brief, bounded and irregular', () => {
  for (const seed of [0, 60493, 65535]) {
    const evolution = score(seed, 'lightning');
    let lit = 0, dark = 0;
    const runs = [0, 0], longest = [0, 0];
    for (let frame = 0; frame < 20000; frame++) {
      const bolts = [evolution.sample(frame).control, evolution.sample(frame).control2];
      bolts.forEach((bolt, i) => {
        assert.ok(bolt[3] >= 0 && bolt[3] <= 1 && bolt[0] >= 0 && bolt[0] <= 1 && bolt[1] >= 0 && bolt[1] <= 1);
        runs[i] = bolt[3] > 0 ? runs[i] + 1 : 0; longest[i] = Math.max(longest[i], runs[i]);
      });
      if (bolts.some(bolt => bolt[3] > 0)) lit++; else dark++;
    }
    assert.ok(lit > 200 && dark > lit * 4, `seed ${seed}: ${lit} lit / ${dark} dark`);
    // Each bolt's return strokes flicker (never more than three frames in a row).
    assert.ok(longest.every(n => n <= 3), `longest runs ${longest}`);
  }
});

test('matter recipes are complete, round-trip late time and require generator 1.9.0', () => {
  assert.equal(matterPresets.length, 10);
  assert.deepEqual(matterPresets.map(r => r.family), [...matterFamilies]);
  for (const recipe of matterPresets) {
    assert.ok(families[recipe.family]);
    assert.equal(recipe.generatorVersion, '1.9.0');
    assert.equal(recipe.palette.length, 5);
    assert.deepEqual(validateRecipe(recipe), recipe);
    for (const time of [3600.1, 315360001, 1e10, timeLimit(recipe.family)]) {
      assert.deepEqual(parseRecipe(serializeRecipe({ ...recipe, time })), { ...recipe, time });
    }
    assert.ok(advanceTime(recipe.family, 3599.99, .02) > 3600);
    assert.equal(advanceTime(recipe.family, timeLimit(recipe.family), 1), timeLimit(recipe.family));
    for (const generatorVersion of ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0']) {
      assert.throws(() => validateRecipe({ ...recipe, generatorVersion }), /requires generator/);
    }
  }
});
