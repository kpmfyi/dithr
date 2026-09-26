// GPU correctness and frozen-render regression, independent of viewer UI.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { launch } from './browser-support.mjs';
import { allPresets, GENERATOR_VERSION, isCrisp } from '../src/seedbank/recipes.ts';

const out = process.env.PALETTE_SIZE_EVIDENCE_DIR || 'artifacts/palette-expansion-01';
try { await access(`${out}/ACCEPTED`); throw new Error('Choose a fresh evidence directory.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(out, { recursive: true });
const baseline = await readFile(`${out}/baseline.js`);
const current = await readFile('public/export/seedbank.js');
const bundleHash = createHash('sha256').update(current).digest('hex');
const selected = process.env.PALETTE_FAMILIES ? allPresets.filter(p => process.env.PALETTE_FAMILIES.split(',').includes(p.family)) : allPresets;
const server = createServer((req, res) => {
  res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html');
  res.end(req.url === '/baseline.js' ? baseline : req.url === '/current.js' ? current : '<!doctype html><title>Palette render validation</title>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await launch();
const results = [], errors = [], unavailable = [];
const palette = ['#eeeae0', '#0757ff', '#ceff39', '#ff503d', '#aa51d9'];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const backends = (process.env.PALETTE_BACKENDS || 'webgl2,webgpu').split(',');
  for (const backend of backends) {
    const support = await page.evaluate(async ({ backend, recipe }) => {
      const api = await import('/current.js');
      try { const runtime = await api.createSeedbank(document.createElement('canvas'), recipe, backend); runtime.dispose(); return null; }
      catch (error) { return String(error.message); }
    }, { backend, recipe: allPresets[0] });
    if (support) { unavailable.push({ backend, reason: support }); console.log(`${backend} unavailable: ${support}`); continue; }
    for (const preset of selected) {
    const result = await page.evaluate(async ({ preset, backend, palette, version, review }) => {
      const old = await import('/baseline.js'), current = await import('/current.js');
      const canvas = document.createElement('canvas');
      const oldCanvas = document.createElement('canvas');
      const width = review ? 960 : 192, height = review ? 640 : 128;
      const pixels = async (runtime, time) => {
        const png = await runtime.capture(time), image = await createImageBitmap(png);
        const flat = document.createElement('canvas'); flat.width = width; flat.height = height;
        const ctx = flat.getContext('2d'); ctx.drawImage(image, 0, 0); image.close();
        const bytes = ctx.getImageData(0, 0, width, height).data;
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
        const counts = new Map();
        for (let i = 0; i < bytes.length; i += 4) { const key = Array.from(bytes.slice(i, i + 3)).join(','); counts.set(key, (counts.get(key) || 0) + 1); }
        return { hash, colors: counts.size, png: flat.toDataURL(), bytes, counts: [...counts] };
      };
      const before = await old.createSeedbank(oldCanvas, preset, backend);
      before.resize(width, height);
      const reference = await pixels(before, preset.time); before.dispose();
      const runtime = await current.createSeedbank(canvas, preset, backend);
      runtime.resize(width, height);
      const preserved = await pixels(runtime, preset.time);
      const output = { family: preset.family, backend, environment: runtime.environment(), preserved: reference.hash === preserved.hash, sizes: [] };
      for (const count of [2, 3, 4, 5]) {
        const recipe = { ...preset, generatorVersion: version, palette: palette.slice(0, count) };
        runtime.setRecipe(recipe); await runtime.compile();
        const rendered = await pixels(runtime, preset.time);
        // Changing each exposed slot must visibly affect the actual render.
        const slotChanges = [], slotTimes = [];
        for (let slot = 0; slot < count; slot++) {
          const altered = structuredClone(recipe); altered.palette[slot] = '#000000';
          runtime.setRecipe(altered); await runtime.compile();
          const changed = await pixels(runtime, preset.time);
          let changedPixels = 0;
          for (let i = 0; i < rendered.bytes.length; i += 4) if (rendered.bytes[i] !== changed.bytes[i] || rendered.bytes[i + 1] !== changed.bytes[i + 1] || rendered.bytes[i + 2] !== changed.bytes[i + 2]) changedPixels++;
          let checkedTime = preset.time;
          // A trace pigment may be absent in one quiet frozen frame. Check its
          // actual contribution at later event states without changing inputs.
          for (const delta of [.5, 3.125, 7.25, 30]) {
            if (changedPixels) break;
            checkedTime = preset.time + delta;
            runtime.setRecipe(recipe); const later = await pixels(runtime, checkedTime);
            runtime.setRecipe(altered); const laterChanged = await pixels(runtime, checkedTime);
            for (let i = 0; i < later.bytes.length; i += 4) if (later.bytes[i] !== laterChanged.bytes[i] || later.bytes[i + 1] !== laterChanged.bytes[i + 1] || later.bytes[i + 2] !== laterChanged.bytes[i + 2]) changedPixels++;
          }
          slotChanges.push(changedPixels); slotTimes.push(checkedTime);
        }
        runtime.setRecipe(recipe);
        const restored = await pixels(runtime, preset.time);
        const moving = await pixels(runtime, preset.time + .1);
        output.sizes.push({ count, hash: rendered.hash, colors: rendered.colors, counts: rendered.counts.slice(0, 20), slotChanges, slotTimes, replayEqual: restored.hash === rendered.hash, moving: moving.hash !== rendered.hash, png: rendered.png });
        if (review) {
          const image = await createImageBitmap(await runtime.capture(preset.time));
          const crop = document.createElement('canvas'); crop.width = 960; crop.height = 640;
          const ctx = crop.getContext('2d'); ctx.imageSmoothingEnabled = false;
          ctx.drawImage(image, 360, 240, 240, 160, 0, 0, 960, 640); image.close();
          output.sizes.at(-1).crop = crop.toDataURL();
        }
      }
      // Return to the legacy graph after all count transitions.
      runtime.setRecipe(preset); await runtime.compile();
      output.returnToThree = (await pixels(runtime, preset.time)).hash === reference.hash;
      runtime.dispose();
      return output;
    }, { preset, backend, palette, version: GENERATOR_VERSION, review: process.env.PALETTE_REVIEW === '1' });
    for (const size of result.sizes) {
      if (['broken-lcd', 'rotor', 'rift', 'intaglio', 'magnetron', 'glass', 'avalanche'].includes(preset.family)) await writeFile(`${out}/${backend}-${preset.family}-${size.count}.png`, Buffer.from(size.png.split(',')[1], 'base64'));
      if (size.crop) await writeFile(`${out}/${backend}-${preset.family}-${size.count}-crop.png`, Buffer.from(size.crop.split(',')[1], 'base64'));
      delete size.png; delete size.crop;
    }
    results.push(result);
    await writeFile(`${out}/report.json`, JSON.stringify({ bundleHash, results, errors, unavailable, browser: await browser.version(), methodology: '192×128 matrix / 960×640 with PALETTE_REVIEW=1, frozen frames at preset time. Old bundled renderer compared byte-for-byte with new three-color output. Each palette slot ablated to black; absent trace slots retried at later event states, recorded in slotTimes. Replay and adjacent-time checks. SwiftShader software correctness evidence, not hardware performance. No timing claim.' }, null, 2));
    console.log(`${backend} ${preset.family}: legacy ${result.preserved && result.returnToThree ? 'identical' : 'CHANGED'}; slots ${result.sizes.map(s => `${s.count}:${s.slotChanges.join('/')}`).join(' ')}`);
  }
    }
  await writeFile(`${out}/availability.json`, JSON.stringify({ unavailable, renderedBackends: [...new Set(results.map(r => r.backend))] }, null, 2));
  assert.ok(results.length, 'No render backend was verified; see availability.json');
  assert.deepEqual(errors, []);
  for (const r of results) {
    assert.ok(r.preserved && r.returnToThree, `${r.family} ${r.backend}: three-color regression`);
    for (const s of r.sizes) {
      assert.ok(s.replayEqual, `${r.family}/${s.count}: replay`);
      assert.ok(s.slotChanges.every(n => n > 0), `${r.family}/${s.count}: unused palette slot ${s.slotChanges}`);
      assert.ok(s.moving, `${r.family}/${s.count}: animation`);
      if (isCrisp(r.family)) assert.ok(s.colors > 1, `${r.family}/${s.count}: empty output`);
    }
  }
  console.log(`Passed ${results.length} shader/backend combinations at all four palette sizes.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
