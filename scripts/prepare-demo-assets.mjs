// Prepare new demo assets before the production build used by browser QA.
// Existing demos are untouched unless explicitly selected by DEMO_FAMILIES.
import assert from 'node:assert/strict';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { demos } from '../src/demos/catalog.ts';
import { launch, openConsumer } from './browser-support.mjs';
const families = (process.env.DEMO_FAMILIES || '').split(',').filter(Boolean);
if (!families.length) throw new Error('Set DEMO_FAMILIES to the explicit comma-separated families to prepare.');
const selected = families.map(family => {
  const demo = demos.find(d => d.family === family);
  if (!demo) throw new Error(`Unknown demo: ${family}`);
  return demo;
});
const out = process.env.DEMO_ASSET_DIR || 'artifacts/demo-assets';
try { await access(`${out}/ACCEPTED`); throw new Error('Choose a new DEMO_ASSET_DIR; accepted evidence is protected.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(out, { recursive: true });
await mkdir('public/demo-textures', { recursive: true });
await mkdir('public/context-previews', { recursive: true });
const url = process.env.SEEDBANK_URL || 'http://127.0.0.1:5187';
const browser = await launch();
try {
  const { page: consumer, errors } = await openConsumer(browser, url, 'webgl2');
  const reports = [];
  for (const demo of selected) {
    const result = await consumer.evaluate(async recipe => {
      const runtime = window.seedbank.runtime;
      runtime.setRecipe(recipe); runtime.resize(960, 640); await runtime.compile();
      const blob = await runtime.capture(recipe.time);
      const png = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
      return { png, environment: runtime.environment() };
    }, demo.recipe);
    await writeFile(`public/demo-textures/${demo.family}.png`, Buffer.from(result.png.split(',')[1], 'base64'));
    reports.push({ family: demo.family, recipe: demo.recipe, environment: result.environment });
  }
  assert.deepEqual(errors, []); await consumer.close();
  const page = await browser.newPage({ viewport: { width: 1380, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  for (const demo of selected) {
    await page.goto(`${url}/demos?study=${demo.family}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`.usage-stage[data-family="${demo.family}"] .shader-surface[data-ready="true"]`, { timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);
    const bytes = await page.locator('.usage-stage').screenshot();
    await writeFile(`public/context-previews/${demo.family}.png`, bytes);
    await writeFile(`${out}/${demo.family}.png`, bytes);
    console.log(`Prepared ${demo.family}: texture and composition preview`);
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ browser: await browser.version(), reports, errors, methodology: 'Explicit frozen demo time; texture and context screenshot prepared before rebuilding the production bundle. Full gallery verification runs separately.' }, null, 2) + '\n');
} finally { await browser.close(); }
