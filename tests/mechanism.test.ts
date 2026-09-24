import assert from 'node:assert/strict';
import test from 'node:test';
import { automatonRowStep, createMechanismEvolution } from '../src/seedbank/mechanism-evolution.ts';
import { advanceTime, timeLimit, presets, mechanismFamilies, parseRecipe, serializeRecipe, validateRecipe } from '../src/seedbank/recipes.ts';

const lateFrames = [0, 4096, 4294967296, 1e10, 1e12 * 60 * 2];

test('mechanism scores are deterministic, finite and keep changing at late frames', () => {
  for (const family of mechanismFamilies) for (const seed of [0, 24611, 65535]) {
    const evolution = createMechanismEvolution(seed, family);
    for (const frame of lateFrames) {
      const a = evolution.sample(frame);
      assert.deepEqual(a, createMechanismEvolution(seed, family).sample(frame));
      assert.ok([...a.drift, ...a.warp, ...a.slow, ...a.fast, ...a.control, ...a.control2, a.carrier].every(Number.isFinite));
      assert.ok(a.slow[2] >= 0 && a.slow[2] < 1 && a.fast[2] >= 0 && a.fast[2] < 1);
      assert.notDeepEqual(a, evolution.sample(frame + 1));
      assert.notDeepEqual(a.control, evolution.sample(frame + 216000).control);
    }
  }
});

test('shell-sort partners agree for every gap and offset', () => {
  const evolution = createMechanismEvolution(24611, 'shellsort');
  for (let frame = 0; frame < 400; frame++) {
    const [gap, offset] = evolution.sample(frame).control;
    assert.ok(Number.isInteger(gap) && gap >= 1 && Number.isInteger(offset));
    const partner = (i: number) => i + gap * (1 - 2 * (Math.floor((i + offset) / gap) % 2));
    for (let i = 0; i < 200; i++) assert.equal(partner(partner(i)), i);
  }
});

test('write heads revisit every row inside the priming window', () => {
  for (const seed of [0, 28453, 65535]) for (const start of [0, 1e7, 1e12 * 60 * 2 - 2000]) {
    const evolution = createMechanismEvolution(seed, 'scanhead');
    const height = 256, lastSeen = new Array(height).fill(start);
    let previous = evolution.sample(start).control.slice(0, 3);
    for (let frame = start + 1; frame < start + 1200; frame++) {
      const heads = evolution.sample(frame).control.slice(0, 3);
      heads.forEach((head, i) => {
        // The shader marks rows within 2 of each head; a monotone sweep covers the rows between frames.
        const from = Math.floor(previous[i] * height), to = Math.floor(head * height);
        const span = to >= from ? to - from : to + height - from;
        assert.ok(span <= 4, `head ${i} jumped ${span} rows`);
        for (let d = -2; d <= span + 2; d++) lastSeen[((from + d) % height + height) % height] = frame;
      });
      previous = heads;
      if (frame > start + 128) assert.ok(lastSeen.every(seen => frame - seen < 128));
    }
  }
});

test('the automaton dependency cone fits inside the priming window at every legal size', () => {
  for (let height = 2; height <= 384; height++) {
    const step = automatonRowStep(height);
    assert.equal(step % 2, 0);
    assert.ok(Math.ceil(height / step) <= 128, `height ${height}`);
  }
});

test('mechanism recipes round-trip late time and reject older generators', () => {
  for (const family of mechanismFamilies) {
    const recipe = presets.find(r => r.family === family)!;
    assert.equal(recipe.generatorVersion, '1.7.0');
    for (const time of [3600.1, 315360001, 1e10, timeLimit(family)]) {
      assert.deepEqual(parseRecipe(serializeRecipe({ ...recipe, time })), { ...recipe, time });
    }
    assert.ok(advanceTime(family, 3599.99, .02) > 3600);
    assert.equal(advanceTime(family, timeLimit(family), 1), timeLimit(family));
    for (const generatorVersion of ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0']) {
      assert.throws(() => validateRecipe({ ...recipe, generatorVersion }), /requires generator/);
    }
  }
});
