import assert from 'node:assert/strict';
import test from 'node:test';
import { createKitEvolution } from '../src/seedbank/kit-evolution.ts';
import { logicControls, logicSalt, STUTTER_WRAP } from '../src/seedbank/logic-evolution.ts';
import { logicFamilies, logicPresets } from '../src/seedbank/logic-meta.ts';
import { advanceTime, timeLimit, parseRecipe, serializeRecipe, validateRecipe, families, presets } from '../src/seedbank/recipes.ts';

const score = (seed: number, family: typeof logicFamilies[number]) => createKitEvolution(seed, logicSalt, logicControls(family));
// Priming starts before frame 0; late frames reach the 10¹² s horizon at the fastest motion (2×, 60 Hz).
const frames = [-129, -1, 0, 1, 4096, 11816, 4294967296, 1e10, 1e12 * 60 * 2 - 3];

test('logic controls are deterministic, finite, float32-safe and keep changing at late frames', () => {
  for (const family of logicFamilies) for (const seed of [0, 23981, 65535]) {
    const evolution = score(seed, family);
    for (const frame of frames) {
      const a = evolution.sample(frame);
      assert.deepEqual(a, score(seed, family).sample(frame), `${family} ${frame}`);
      const values = [...a.control, ...a.control2];
      assert.ok(values.every(Number.isFinite), `${family} finite at ${frame}`);
      // Integers sent as float32 stay exact below 2²⁴; everything else is a bounded track or a wrapped phase.
      assert.ok(values.every(v => Math.abs(v) < 16777216), `${family} bounded at ${frame}: ${values}`);
      const later = evolution.sample(frame + 900);
      assert.notDeepEqual([a.control, a.control2, a.drift], [later.control, later.control2, later.drift], `${family} changes at ${frame}`);
    }
  }
});

test('wrapped phases land on their periods and the stutter counter is in phase with every clock', () => {
  assert.equal(STUTTER_WRAP, 27720);
  for (let period = 1; period <= 12; period++) assert.equal(STUTTER_WRAP % period, 0, `period ${period}`);
  for (const frame of frames) {
    const munch = score(1, 'munch').sample(frame);
    const [ox, oy] = munch.control;
    assert.ok(ox >= 0 && ox < 256 && oy >= 0 && oy < 256, `munch offsets ${ox} ${oy}`);
    [munch.control[2], munch.control[3], munch.control2[0], munch.control2[1]].forEach((clock, k) => {
      const period = [41, 59, 73, 97][k];
      assert.ok(Number.isInteger(clock) && clock >= 0 && clock < period, `munch clock ${k}: ${clock}`);
      assert.equal(clock, ((frame % period) + period) % period);
    });
    const counter = score(1, 'stutter').sample(frame).control[0];
    assert.ok(Number.isInteger(counter) && counter >= 0 && counter < STUTTER_WRAP, `stutter counter ${counter}`);
    assert.equal(counter, ((frame % STUTTER_WRAP) + STUTTER_WRAP) % STUTTER_WRAP);
    for (const family of ['residual', 'compass', 'collage'] as const) {
      const [angle] = score(1, family).sample(frame).control;
      assert.ok(angle >= 0 && angle < Math.PI * 2, `${family} angle ${angle}`);
    }
    const [cx, cy, size, direction] = score(1, 'catmap').sample(frame).control;
    assert.ok(cx > 0 && cx < 1 && cy > 0 && cy < 1 && size >= 6 && size <= 22 && (direction === 0 || direction === 1));
    const [kind, i, j] = score(1, 'butterfly').sample(frame).control;
    assert.ok(Number.isInteger(kind) && kind >= 0 && kind < 5 && i >= 0 && i < 1 && j >= 0 && j < 1);
    for (const v of [...score(1, 'misregister').sample(frame).control, ...score(1, 'misregister').sample(frame).control2]) assert.ok(v >= -1 && v <= 1);
    for (const s of [score(1, 'collage').sample(frame).control[3], score(1, 'collage').sample(frame).control2[3]]) assert.ok(s >= .42 && s <= .7, 'collage maps contract');
  }
});

test('the stutter counter advances by exactly one frame per frame across its wrap', () => {
  const evolution = score(9, 'stutter');
  for (const start of [0, STUTTER_WRAP - 3, 1e12 * 60 * 2 - 30]) for (let frame = start; frame < start + 6; frame++) {
    const now = evolution.sample(frame).control[0], next = evolution.sample(frame + 1).control[0];
    assert.equal((next - now + STUTTER_WRAP) % STUTTER_WRAP, 1, `frame ${frame}`);
  }
});

test('logic recipes are the ten studies 91–100, ship five-colour palettes and require generator 1.9.0', () => {
  assert.equal(logicPresets.length, 10);
  assert.deepEqual(logicPresets.map(r => r.family), [...logicFamilies]);
  assert.deepEqual(presets.slice(90).map(r => r.family), [...logicFamilies]);
  for (const recipe of logicPresets) {
    assert.ok(families[recipe.family]);
    assert.equal(Number(families[recipe.family].number) >= 91 && Number(families[recipe.family].number) <= 100, true);
    assert.equal(recipe.generatorVersion, '1.9.0');
    assert.equal(recipe.palette.length, 5);
    assert.ok(recipe.parameters.speed >= 1.3, 'the logic batch keeps the energetic default motion of the first ten');
    assert.deepEqual(validateRecipe(recipe), recipe);
    for (const time of [3600.1, 315360001, 1e10, timeLimit(recipe.family)]) assert.deepEqual(parseRecipe(serializeRecipe({ ...recipe, time })), { ...recipe, time });
    assert.equal(advanceTime(recipe.family, timeLimit(recipe.family), 1), timeLimit(recipe.family));
    for (const generatorVersion of ['1.0.0', '1.6.0', '1.7.0', '1.8.0']) assert.throws(() => validateRecipe({ ...recipe, generatorVersion }), /requires generator/);
  }
});
