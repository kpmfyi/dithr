// Isolated context compositions avoid retaining dozens of software GL contexts
// in one browser page. The full shelf/switching regression runs separately.
import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { demos } from '../src/demos/catalog.ts';
import { isIntricacy } from '../src/seedbank/recipes.ts';
import { launch } from './browser-support.mjs';
const out = process.env.INTRICACY_CONTEXT_DIR || 'artifacts/intricacy-context-isolated-01';
try { await access(`${out}/ACCEPTED`); throw new Error('Choose a fresh INTRICACY_CONTEXT_DIR; accepted evidence is protected.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const url = process.env.SEEDBANK_URL || 'http://127.0.0.1:9466';
await mkdir(out, { recursive: true });
const browser = await launch();
const reports = [];
try {
  for (const demo of demos.filter(d => isIntricacy(d.family) || ['alveoli', 'confluence'].includes(d.family))) {
    const page = await browser.newPage({ viewport: { width: 1380, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${url}/demos?study=${demo.family}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`.usage-stage[data-family="${demo.family}"] .shader-surface[data-ready="true"]`, { timeout: 45000 });
    assert.ok(await page.getByRole('button', { name: 'Play demo motion', exact: true }).isVisible());
    const surface = page.locator('.usage-stage canvas');
    const environment = JSON.parse(await surface.getAttribute('data-environment'));
    await page.locator('.usage-stage').screenshot({ path: `${out}/${demo.family}-desktop.png` });
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download tuned recipe' }).click();
    const download = await downloading; const stream = await download.createReadStream();
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), demo.recipe);
    const before = await surface.getAttribute('data-time');
    await page.getByRole('button', { name: 'Play demo motion', exact: true }).click();
    await page.waitForFunction(before => document.querySelector('.usage-stage canvas').dataset.time !== before, before);
    await page.getByRole('button', { name: 'Pause demo motion', exact: true }).click();
    await page.getByRole('button', { name: 'Reset still' }).click();
    assert.equal(Number(await surface.getAttribute('data-time')), demo.recipe.time);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
      assert.equal(await surface.evaluate(c => getComputedStyle(c).imageRendering), 'pixelated');
      if (width === 390) await page.locator('.usage-stage').screenshot({ path: `${out}/${demo.family}-mobile.png` });
    }
    await page.getByRole('link', { name: 'Edit this recipe' }).click();
    await page.waitForFunction(() => !document.querySelector('.play-button')?.disabled);
    assert.equal(await page.getByLabel('Preset name').inputValue(), demo.recipe.name);
    assert.deepEqual(errors, []);
    reports.push({ family: demo.family, environment, exactRecipe: true, motionAndReset: true, mobileWidths: [390, 320], workbenchHandoff: true, errors });
    await page.close(); console.log(`${demo.family}: context, motion, recipe, mobile and handoff passed`);
  }
  await writeFile(`${out}/report.json`, JSON.stringify({ browser: await browser.version(), reports, methodology: 'Fresh browser page per context; desktop at 1380×1000, mobile at 390/320×844; software WebGL2 correctness, not hardware performance.' }, null, 2));
} finally { await browser.close(); }
