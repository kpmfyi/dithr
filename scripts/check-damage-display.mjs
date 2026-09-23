// Native color budget, enlarged pixel inspection and high-DPI presentation.
import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { damageFamilies, presets } from '../src/seedbank/recipes.ts';
import { launch, openConsumer } from './browser-support.mjs';
const out = process.env.DAMAGE_DISPLAY_DIR || 'artifacts/damage-display-01';
const url = process.env.SEEDBANK_URL || 'http://127.0.0.1:5187';
try { await access(`${out}/ACCEPTED`); throw new Error('Choose a fresh DAMAGE_DISPLAY_DIR; accepted evidence is protected.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(out, { recursive: true });
const browser = await launch();
try {
  const { page, errors } = await openConsumer(browser, url, 'webgl2');
  const results = [];
  for (const family of damageFamilies) {
    const recipe = presets.find(r => r.family === family);
    const result = await page.evaluate(async recipe => {
      const runtime = window.seedbank.runtime;
      runtime.setRecipe(recipe); runtime.resize(960, 640); await runtime.compile();
      const png = await runtime.capture(recipe.time);
      const image = await createImageBitmap(png);
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 640;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, 960, 640).data, colors = new Map();
      for (let i = 0; i < pixels.length; i += 4) {
        const rgb = `${pixels[i]},${pixels[i+1]},${pixels[i+2]}`;
        colors.set(rgb, (colors.get(rgb) || 0) + 1);
      }
      const crop = document.createElement('canvas'); crop.width = 960; crop.height = 640;
      const c = crop.getContext('2d'); c.imageSmoothingEnabled = false;
      c.drawImage(canvas, 360, 240, 240, 160, 0, 0, 960, 640);
      return { native: canvas.toDataURL(), crop: crop.toDataURL(), colorCounts: [...colors], environment: runtime.environment() };
    }, recipe);
    assert.ok(result.colorCounts.length >= 3 && result.colorCounts.length <= 16, `${family} must use discrete flat tones`);
    for (const key of ['native', 'crop']) await writeFile(`${out}/${family}-${key}.png`, Buffer.from(result[key].split(',')[1], 'base64'));
    results.push({ family, colors: result.colorCounts.length, colorCounts: result.colorCounts, environment: result.environment });
  }
  assert.deepEqual(errors, []); await page.close();
  const ui = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const uiErrors = []; ui.on('pageerror', e => uiErrors.push(e.message));
  await ui.goto(`${url}/?demo=puncture`, { waitUntil: 'networkidle' });
  await ui.waitForFunction(() => !document.querySelector('.play-button')?.disabled);
  assert.equal(await ui.locator('canvas').evaluate(c => getComputedStyle(c).imageRendering), 'pixelated');
  await ui.locator('.canvas-frame').screenshot({ path: `${out}/puncture-workbench-2x.png` });
  await ui.goto(`${url}/demos?study=address-drift`, { waitUntil: 'networkidle' });
  await ui.waitForSelector('.usage-stage[data-family="address-drift"] .shader-surface[data-ready="true"]');
  for (const selector of ['canvas', '.shader-fallback']) assert.equal(await ui.locator(`.usage-stage ${selector}`).evaluate(c => getComputedStyle(c).imageRendering), 'pixelated');
  await ui.locator('.usage-stage').screenshot({ path: `${out}/address-drift-context-2x.png` });
  assert.deepEqual(uiErrors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ browser: await browser.version(), results, display: 'Output-pixel coverage; native 960×640 + 4× nearest-neighbor center crops. All native colors counted. Workbench and context inspected at deviceScaleFactor 2.', performance: 'SwiftShader correctness evidence, not hardware performance.', errors, uiErrors }, null, 2));
  await writeFile(`${out}/index.html`, `<!doctype html><meta charset="utf-8"><title>Damage studies / pixel review</title><style>body{background:#171e1d;color:#f4f1df;font:14px system-ui;margin:24px}section{display:grid;grid-template-columns:3fr 2fr;gap:20px;margin-bottom:36px}img{width:100%;image-rendering:pixelated}h2{font-size:22px}figure{margin:0}figcaption{padding:8px}</style><h1>Damage studies / native frame and 4× crop</h1>${results.map(r => `<h2>${r.family} · ${r.colors} discrete RGB colors</h2><section><figure><img src="${r.family}-native.png"><figcaption>960 × 640, frozen at 3.25s</figcaption></figure><figure><img src="${r.family}-crop.png"><figcaption>240 × 160 center crop, enlarged 4× without interpolation</figcaption></figure></section>`).join('')}`);
  console.log(`Verified crisp display for ${results.length} damage studies. Evidence: ${out}`);
} finally { await browser.close(); }
