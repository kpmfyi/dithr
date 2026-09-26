import assert from 'node:assert/strict';
import test from 'node:test';
import { createSynthesisEvolution, synthesisLattice } from '../src/seedbank/synthesis-evolution.ts';
import { synthesisFamilies, presets, parseRecipe, serializeRecipe, validateRecipe, timeLimit, advanceTime } from '../src/seedbank/recipes.ts';

test('cached synthesis scores reproduce fresh seeks regardless of sample order', () => {
  for (const seed of [0, 42433, 65535]) {
    const evolution = createSynthesisEvolution(seed);
    for (const t of [0, 3.25, 3.27, -2.13, 3600, 2e12, 60, 0, 1e10]) {
      const actual = structuredClone(evolution.sample(t));
      assert.deepEqual(actual, createSynthesisEvolution(seed).sample(t));
      assert.ok([...actual.drift,...actual.events.flatMap(e=>[...e.a,...e.b])].every(Number.isFinite));
      assert.ok(actual.events.some(e=>e.a[3]>0), `continuous arrivals at ${t}`);
      assert.notDeepEqual(actual, structuredClone(evolution.sample(t+.25)));
      assert.notDeepEqual(actual, structuredClone(evolution.sample(t+3600)));
    }
  }
});
test('synthesis recipe contract preserves late time and rejects older generators', () => {
  for (const family of synthesisFamilies) {
    const recipe = presets.find(r=>r.family===family)!;
    for (const time of [3.25,3600.1,1e10,timeLimit(family)]) assert.deepEqual(parseRecipe(serializeRecipe({...recipe,time})),{...recipe,time});
    assert.ok(advanceTime(family,3599.99,.1)>3600);
    assert.equal(advanceTime(family,timeLimit(family),.1),timeLimit(family));
    for (const generatorVersion of ['1.0.0','1.1.0','1.2.0','1.3.0','1.4.0','1.5.0','1.6.0']) assert.throws(()=>validateRecipe({...recipe,generatorVersion}),/requires generator/);
    for (const time of [-1,NaN,Infinity,timeLimit(family)+1]) assert.throws(()=>validateRecipe({...recipe,time}));
  }
});
test('the source lattice is reproducible, seed sensitive and bounded in memory', () => {
  const a=synthesisLattice(42433);
  assert.equal(a.byteLength,65536); assert.deepEqual(a,synthesisLattice(42433)); assert.notDeepEqual(a,synthesisLattice(42434));
});
