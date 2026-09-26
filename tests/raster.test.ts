import assert from 'node:assert/strict';
import test from 'node:test';
import { createKitEvolution } from '../src/seedbank/kit-evolution.ts';
import { BEAM_POINTS, COPPER_BARS, ORBIT_STAMPS, TWISTER_COLUMNS, beamPath, copperBars, orbitCloud, rasterControls, rasterSalt, twisterColumns } from '../src/seedbank/raster-evolution.ts';
import { rasterFamilies } from '../src/seedbank/raster-meta.ts';
import { presets, parseRecipe, serializeRecipe, timeLimit, validateRecipe } from '../src/seedbank/recipes.ts';

// Up to the 10¹² s horizon at 2× speed: 1.2e14 frames.
const lateFrames = [0, 4096, 4294967296, 1e10, 1e12 * 60 * 2];
const tools = (seed: number) => createKitEvolution(seed, rasterSalt).tools;

test('raster scores are deterministic, finite and bounded for the GPU at late frames', () => {
  for (const family of rasterFamilies) for (const seed of [0, 24011, 65535]) {
    const evolution = createKitEvolution(seed, rasterSalt, rasterControls(family));
    for (const frame of lateFrames) {
      const a = evolution.sample(frame);
      assert.deepEqual(a, createKitEvolution(seed, rasterSalt, rasterControls(family)).sample(frame));
      const values = [...a.control, ...a.control2];
      assert.ok(values.every(Number.isFinite), `${family} ${frame}`);
      // Float uniforms stay small enough for exact-enough GPU arithmetic.
      assert.ok(values.every(v => Math.abs(v) < 1e5), `${family} ${frame} ${values}`);
      assert.notDeepEqual(a, evolution.sample(frame + 1));
      assert.notDeepEqual(a.control, evolution.sample(frame + 216000).control, family);
    }
  }
});

test('beam path is continuous across frames and figure changes', () => {
  for (const seed of [0, 41933, 65535]) for (const start of [0, 659 * 1, 660 * 7 - 3, 1e10, 1e12 * 60 * 2 - 40]) {
    const t = tools(seed);
    let previous = beamPath(t, start, .6, 2.6);
    assert.equal(previous.length, BEAM_POINTS * 2);
    for (let frame = start + 1; frame < start + 30; frame++) {
      const path = beamPath(t, frame, .6, 2.6);
      assert.ok(path.every(Number.isFinite) && path.every(v => Math.abs(v) < .7));
      // The first sample continues the previous frame's last sample exactly.
      assert.ok(Math.abs(path[0] - previous[previous.length - 2]) < 1e-9 && Math.abs(path[1] - previous[previous.length - 1]) < 1e-9);
      for (let j = 2; j < path.length; j += 2) assert.ok(Math.hypot(path[j] - path[j - 2], path[j + 1] - path[j - 1]) < .12, `jump at ${frame}`);
      previous = path;
    }
  }
});

test('orbit, copper and twister schedules stay in range at every density', () => {
  for (const seed of [0, 51277, 65535]) for (const frame of lateFrames) for (const detail of [0, .6, 1]) {
    const t = tools(seed);
    const cloud = orbitCloud(t, frame, detail, 2.6);
    assert.equal(cloud.length, ORBIT_STAMPS * 4);
    for (let j = 0; j < ORBIT_STAMPS; j++) {
      const [x, y, tone, size] = cloud.slice(4 * j, 4 * j + 4);
      assert.ok(Math.abs(x) < 1.2 && Math.abs(y) < 1.2 && tone >= 0 && tone <= 1 && [0, 1, 2].includes(size));
    }
    assert.deepEqual(cloud, orbitCloud(tools(seed), frame, detail, 2.6));
    const bars = copperBars(t, frame, detail);
    assert.equal(bars.length, COPPER_BARS * 4);
    for (let i = 0; i < COPPER_BARS; i++) {
      const [y, half, tone, active] = bars.slice(4 * i, 4 * i + 4);
      assert.ok(y >= 0 && y <= 1 && half > 0 && half < .2 && Number.isInteger(tone) && tone >= 0 && tone < 5 && (active === 0 || active === 1));
    }
    assert.equal(bars.filter((_, i) => i % 4 === 3).reduce((a, b) => a + b, 0), 2 + Math.round(detail * 5));
    const columns = twisterColumns(t, frame, detail);
    assert.equal(columns.length, TWISTER_COLUMNS * 4);
    assert.equal(columns.filter((v, i) => i % 4 === 1 && v > 0).length, 2 + Math.round(detail * 4));
    for (let i = 0; i < TWISTER_COLUMNS; i++) {
      const [x, radius, angle, twist] = columns.slice(4 * i, 4 * i + 4);
      assert.ok(radius >= 0 && radius < .2 && Math.abs(angle) < 2 * Math.PI + 3.3 && Math.abs(twist) <= 14 && Number.isFinite(x));
      if (radius > 0) assert.ok(x > -.5 && x < 1.5, `column ${i} at ${x}`);
    }
  }
});

test('raster recipes round-trip late time and require generator 1.9.0', () => {
  for (const family of rasterFamilies) {
    const recipe = presets.find(r => r.family === family)!;
    assert.equal(recipe.generatorVersion, '1.9.0');
    assert.equal(recipe.palette.length, 5);
    for (const time of [3600.1, 315360001, 1e10, timeLimit(family)]) assert.deepEqual(parseRecipe(serializeRecipe({ ...recipe, time })), { ...recipe, time });
    for (const generatorVersion of ['1.0.0', '1.7.0', '1.8.0']) assert.throws(() => validateRecipe({ ...recipe, generatorVersion }), /requires generator/);
  }
});
