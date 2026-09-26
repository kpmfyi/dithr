import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { launch, openConsumer } from './browser-support.mjs';
const url = process.env.SEEDBANK_URL || 'http://127.0.0.1:5187';
const out = process.env.EXPANSION_EVIDENCE_DIR || 'artifacts/expansion-ui';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile('catalog/manifest.json', 'utf8'));
const active = manifest.entries.filter(entry => entry.status !== 'deprecated');
const archived = manifest.entries.filter(entry => entry.status === 'deprecated');
const latest = active.at(-1);
const browser = await launch();
try {
  const checks = [];
  if (process.env.EXPANSION_UI_ONLY !== '1') {
  const { page: consumer, errors } = await openConsumer(browser, url, 'webgl2');
  for (const entry of manifest.entries) {
    const recipe = JSON.parse(await readFile(`catalog/${entry.recipe}`, 'utf8'));
    const result = await consumer.evaluate(async ({ recipe, probeControls }) => {
      const runtime = window.seedbank.runtime;
      const capture = async time => { const b = await runtime.capture(time); return new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(b); }); };
      runtime.setRecipe(recipe); runtime.resize(960, 640); await runtime.compile();
      const frame = await capture(recipe.time);
      const checks = {};
      if (probeControls && recipe.generatorVersion !== '1.0.0') {
        for (const key of ['scale', 'intensity', 'detail']) {
          const choices = { scale: [2.1, 7.3], intensity: [.6, 1.7], detail: [.1, .9] }[key];
          const value = choices.find(value => value !== recipe.parameters[key]);
          runtime.setRecipe({ ...recipe, parameters: { ...recipe.parameters, [key]: value } });
          checks[key] = (await capture(recipe.time)) !== frame;
        }
        runtime.setRecipe({ ...recipe, seed: (recipe.seed + 2345) % 65536 }); checks.seed = (await capture(recipe.time)) !== frame;
        runtime.setRecipe({ ...recipe, palette: ['#291b36', '#88cc99', '#ffbb33'] }); checks.palette = (await capture(recipe.time)) !== frame;
        runtime.setRecipe({ ...recipe, parameters: { ...recipe.parameters, speed: 0 } }); checks.zeroSpeedStable = (await capture(2)) === (await capture(8));
      }
      return { frame, checks };
    }, { recipe, probeControls: process.env.EXPANSION_CONTROLS !== 'new' || recipe.generatorVersion === '1.7.0' });
    const report = JSON.parse(await readFile(`catalog/${entry.checks.webgl2}`, 'utf8'));
    assert.equal(hash(Buffer.from(result.frame.split(',')[1], 'base64')), report.pngSha256, `${entry.id}: independent consumer reproduces frozen evidence`);
    for (const [key, passed] of Object.entries(result.checks)) assert.equal(passed, true, `${entry.id}: ${key} has the intended effect`);
    checks.push({ id: entry.id, reproducedEvidence: true, ...result.checks });
    console.log(`Verified ${entry.id}: export + ${Object.keys(result.checks).join(', ') || 'legacy pixels'}`);
  }
  assert.deepEqual(errors, []);
  await consumer.close();
  await writeFile(`${out}/consumer-checks.json`, JSON.stringify({ checks },null,2));
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const uiErrors = []; page.on('pageerror', e => uiErrors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('.play-button')?.disabled);
  assert.equal(await page.locator('.preset-card').count(), active.length);
  assert.deepEqual(await page.locator('.preset-image img').evaluateAll(imgs => imgs.map(img => img.getAttribute('src').split('/').pop().replace('.png', ''))), active.map(entry => entry.family));
  for (const entry of active) {
    await page.getByRole('searchbox', { name: 'Search studies' }).fill(entry.name);
    assert.equal(await page.locator('.preset-card').count(), 1);
    await page.locator('.preset-card').click();
    assert.equal(await page.getByLabel('Preset name').inputValue(), entry.name);
    await page.locator('.preset-image img').evaluate(img => { img.loading = 'eager'; });
    await page.waitForFunction(family => { const img = document.querySelector('.preset-image img'); return img?.getAttribute('src') === `/previews/${family}.png` && img.complete && img.naturalWidth > 0; }, entry.family).catch(async error => { await writeFile(`${out}/preview-failure.json`, JSON.stringify({ family: entry.family, images: await page.locator('.preset-image img').evaluateAll(imgs => imgs.map(i => ({ src: i.getAttribute('src'), currentSrc: i.currentSrc, complete: i.complete, width: i.naturalWidth }))) },null,2)); throw error; });
  }
  await page.getByRole('button', { name: /Save preset/ }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /Saved/ }).click();
  await page.getByRole('button', { name: new RegExp(`${latest.name} seed`) }).click();
  await page.getByRole('tab', {name:'Export ↗',exact:true}).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Recipe ↓', exact: true }).click();
  await (await downloadPromise).saveAs(`${out}/saved-new-recipe.json`);
  const reopened = JSON.parse(await readFile(`${out}/saved-new-recipe.json`, 'utf8'));
  assert.equal(reopened.generatorVersion, latest.generatorVersion); assert.equal(reopened.family, latest.family);
  await page.getByRole('tab', { name: 'Studies', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search studies' }).fill('a study that does not exist');
  assert.equal(await page.locator('.preset-card').count(), 0);
  await page.getByRole('button', { name: 'Clear search' }).click();
  assert.equal(await page.locator('.preset-card').count(), active.length);
  await page.getByRole('tab', { name: /Archive/ }).click();
  assert.equal(await page.locator('.preset-card').count(), archived.length);
  await page.getByRole('searchbox', { name: 'Search studies' }).fill('textile');
  assert.equal(await page.locator('.preset-card').count(), 1);
  await page.getByRole('searchbox', { name: 'Search studies' }).fill('Aurora');
  await page.locator('.preset-card').click();
  await page.screenshot({ path: `${out}/archive-desktop.png`, fullPage: true });
  await page.getByRole('tab', { name: 'Studies', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search studies' }).fill('Row collapse');
  await page.locator('.preset-card').click();
  await page.screenshot({ path: `${out}/viewer-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('searchbox', { name: 'Search studies' }).fill('');
  await page.locator('.preset-card').last().click();
  assert.equal(await page.getByLabel('Preset name').inputValue(), latest.name);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No mobile overflow with all studies');
  await page.screenshot({ path: `${out}/viewer-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${url}/studies/index.html`, { waitUntil: 'networkidle' });
  await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
  await page.screenshot({ path: `${out}/contact-sheet.png`, fullPage: true });
  assert.deepEqual(uiErrors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ checkedAt: new Date().toISOString(), browser: await browser.version(), rendering: checks, viewer: [`all ${active.length} active studies present; ${archived.length} deprecated studies available in archive`, 'new studies searchable by name and selectable', 'tag search', 'no-results recovery', `${latest.generatorVersion} saved preset survives reload and exports`, 'last study reachable on mobile', '390px mobile no overflow'], errors: uiErrors }, null, 2));
} finally { await browser.close(); }
