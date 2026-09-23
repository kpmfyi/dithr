import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { launch } from './browser-support.mjs';
import { departureFamilies, presets } from '../src/seedbank/recipes.ts';
const out = process.env.SHARPNESS_EVIDENCE_DIR || 'artifacts/departure-sharpness-01';
const batch = process.env.DEPARTURE_BATCH_DIR || 'artifacts/departures-sharp-01-webgl2';
const url = process.env.SEEDBANK_URL || 'http://127.0.0.1:5187';
try { await access(`${out}/ACCEPTED`); throw new Error('Choose a fresh SHARPNESS_EVIDENCE_DIR; accepted evidence is protected.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(out, { recursive: true });
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 1 });
  const rows = [], reports = [];
  for (const family of departureFamilies) {
    const recipe = presets.find(r => r.family === family);
    const images = await Promise.all([`artifacts/departures-03-webgl2/${recipe.id}/frozen.png`, `${batch}/${recipe.id}/frozen.png`].map(async path => `data:image/png;base64,${(await readFile(path)).toString('base64')}`));
    const stats = await page.evaluate(async ({ images, family }) => {
      const frames = [];
      for (const src of images) {
        const image = new Image(); image.src = src; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
        const colors = new Set(); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 0; i < pixels.length; i += 4) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
        const crop = document.createElement('canvas'); crop.width = 480; crop.height = 320;
        const c = crop.getContext('2d'); c.imageSmoothingEnabled = false;
        c.drawImage(image, family === 'shockfront' ? 580 : 280, 230, 240, 160, 0, 0, 480, 320);
        frames.push({ width: canvas.width, height: canvas.height, colors: colors.size, crop: crop.toDataURL() });
      }
      return frames;
    }, { images, family });
    assert.ok(stats[0].colors > 100, `${family}: historical baseline contains interpolated shading`);
    assert.ok(stats[1].colors >= 3 && stats[1].colors <= 16, `${family}: flat tones remain discrete (allowing GPU rounding)`);
    const batchReport = JSON.parse(await readFile(`${batch}/${recipe.id}/report.json`, 'utf8'));
    const beforeReport = JSON.parse(await readFile(`artifacts/departures-03-webgl2/${recipe.id}/report.json`, 'utf8'));
    assert.equal(beforeReport.recipeSha256, batchReport.recipeSha256, 'Before/after sharpness comparison requires identical recipes');
    reports.push({ family, beforeColors: stats[0].colors, afterColors: stats[1].colors, width: stats[1].width, height: stats[1].height, environment: batchReport.measurement });
    rows.push(`<section><h2>${family}</h2><div class="pair"><figure><img src="${images[0]}"/><figcaption>Before · ${stats[0].colors} RGB values</figcaption></figure><figure><img src="${images[1]}"/><figcaption>After · ${stats[1].colors} RGB values</figcaption></figure><figure><img src="${stats[0].crop}"/><figcaption>Before · 2× crop, no smoothing</figcaption></figure><figure><img src="${stats[1].crop}"/><figcaption>After · 2× crop, no smoothing</figcaption></figure></div></section>`);
  }
  const html = `<!doctype html><html><meta charset="utf-8"><title>Departure pixel sharpness</title><style>body{background:#f5f3ec;color:#252b27;margin:24px;font:13px system-ui}h1{font-size:26px}h2{font-size:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}img{width:100%;display:block;image-rendering:pixelated}figcaption{padding:7px 0}section{margin-bottom:24px}</style><h1>Same recipes / sharp display revision</h1><p>Native exports at 960 × 640. Fixed time 3.25s. Palette and simulation inputs unchanged. Each enlarged crop shows individual display pixels.</p>${rows.join('')}</html>`;
  await writeFile(`${out}/comparison.html`, html); await page.setContent(html);
  for (let i = 0; i < departureFamilies.length; i++) await page.locator('section').nth(i).screenshot({ path: `${out}/${departureFamilies[i]}-comparison.png` });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const ui = await context.newPage(); ui.on('pageerror', e => errors.push(e.message));
  await ui.goto(`${url}/?demo=rotor`, { waitUntil: 'networkidle' });
  await ui.waitForFunction(() => !document.querySelector('.play-button')?.disabled);
  assert.equal(await ui.locator('canvas').evaluate(c => getComputedStyle(c).imageRendering), 'pixelated');
  await ui.locator('.canvas-frame').screenshot({ path: `${out}/workbench-dpr2.png` });
  await ui.goto(`${url}/demos?study=rotor`, { waitUntil: 'networkidle' });
  await ui.waitForSelector('.shader-surface[data-ready=true]');
  assert.equal(await ui.locator('canvas').evaluate(c => getComputedStyle(c).imageRendering), 'pixelated');
  assert.equal(await ui.locator('.shader-fallback').evaluate(c => getComputedStyle(c).imageRendering), 'pixelated');
  await ui.locator('.usage-stage').screenshot({ path: `${out}/context-dpr2.png` });
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ browser: await browser.version(), reports, cssChecks: ['workbench canvas at DPR 2', 'context canvas and fallback at DPR 2'], errors,
    methodology: 'Same default recipes and native frozen dimensions as preserved baseline. Full-frame RGB cardinality checks the removal of smooth palette ramps, not aesthetic merit. Two-times crops use nearest-neighbor scaling. Software WebGL2 rendering, no hardware performance claim.' }, null, 2));
  console.log(JSON.stringify(reports.map(({ family, beforeColors, afterColors }) => ({ family, beforeColors, afterColors })), null, 2));
} finally { await browser.close(); }
