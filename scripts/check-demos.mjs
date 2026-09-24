import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { demos, allDemos } from '../src/demos/catalog.ts';
import { isDeparture, isDamage, isEntropy, isIntricacy, isMechanism, presets, validateRecipe } from '../src/seedbank/recipes.ts';
import { launch, openConsumer } from './browser-support.mjs';

const url = process.env.SEEDBANK_URL || 'http://127.0.0.1:5187';
const publish = process.argv.includes('--publish');
const out = process.env.DEMO_EVIDENCE_DIR || 'artifacts/context-01';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try { await access(`${out}/ACCEPTED`); throw new Error('Do not overwrite accepted demo evidence; choose DEMO_EVIDENCE_DIR.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(out, { recursive: true });
if (publish) { await mkdir('public/demo-textures', { recursive: true }); await mkdir('public/context-previews', { recursive: true }); }
assert.deepEqual(demos.map(demo => demo.family).sort(), presets.map(recipe => recipe.family).sort());
for (const demo of demos) { assert.deepEqual(validateRecipe(demo.recipe), demo.recipe); assert.notEqual(demo.recipe.id, presets.find(preset => preset.family === demo.family).id); }
const browser = await launch();
const rendering = [];
const errors = [];
try {
  const { page: consumer, errors: consumerErrors } = await openConsumer(browser, url, 'webgl2');
  for (const demo of demos) {
    const result = await consumer.evaluate(async recipe => {
      const runtime = window.seedbank.runtime;
      runtime.setRecipe(recipe); runtime.resize(960, 640); await runtime.compile();
      const capture = async time => {
        const blob = await runtime.capture(time);
        return new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
      };
      const frame = await capture(recipe.time);
      const stable = frame === await capture(recipe.time);
      const animated = frame !== await capture(recipe.time + 2);
      const image = await createImageBitmap(await (await fetch(frame)).blob());
      const flat = document.createElement('canvas'); flat.width = 960; flat.height = 640;
      const ctx = flat.getContext('2d'); ctx.drawImage(image, 0, 0); image.close();
      const pixels = ctx.getImageData(0, 0, 960, 640).data;
      const colors = new Set(); for (let i = 0; i < pixels.length; i += 64) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
      return { frame, stable, animated, sampledColors: colors.size, environment: runtime.environment() };
    }, demo.recipe);
    // Sharp departure displays deliberately use three flat colors at three
    // exposure levels, rather than the old continuously shaded palette.
    const minimumSampledColors = (isDeparture(demo.family) || isDamage(demo.family) || isEntropy(demo.family) || isIntricacy(demo.family) || isMechanism(demo.family)) ? 3 : 21;
    const maximumSampledColors = (isDeparture(demo.family) || isDamage(demo.family) || isEntropy(demo.family) || isIntricacy(demo.family) || isMechanism(demo.family)) ? 16 : Infinity;
    assert.ok(result.stable && result.animated && result.sampledColors >= minimumSampledColors && result.sampledColors <= maximumSampledColors, `${demo.family}: reproducible, animated, nonblank surface`);
    const bytes = Buffer.from(result.frame.split(',')[1], 'base64');
    await writeFile(`${out}/${demo.family}-texture.png`, bytes);
    if (publish) await writeFile(`public/demo-textures/${demo.family}.png`, bytes);
    rendering.push({ family: demo.family, recipe: demo.recipe, pngSha256: hash(bytes), stable: result.stable, animated: result.animated, sampledColors: result.sampledColors, minimumSampledColors, maximumSampledColors: Number.isFinite(maximumSampledColors) ? maximumSampledColors : undefined, environment: result.environment });
    console.log(`Surface ${demo.family}: deterministic, animated, ${result.sampledColors} sampled colors`);
  }
  assert.deepEqual(consumerErrors, []); await consumer.close();
  const page = await browser.newPage({ viewport: { width: 1380, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  const waitReady = async () => {
    // A deep link can briefly show the SSR default before client hydration.
    const requested = new URL(page.url()).searchParams.get('study');
    const family = allDemos.find(demo => demo.family === requested)?.family || demos[0].family;
    try { await page.waitForSelector(`.usage-stage[data-family="${family}"] .shader-surface[data-ready="true"]`, { timeout: 45000 }); }
    catch (error) {
      await page.screenshot({ path: `${out}/last-failure.png`, fullPage: true });
      await writeFile(`${out}/last-failure.json`, JSON.stringify({ url: page.url(), family, errors, status: await page.locator('.demo-render-state').allTextContents(), detail: await page.locator('.demo-error').allTextContents() }, null, 2));
      throw error;
    }
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.usage-stage canvas').count(), 1);
  };
  await page.goto(`${url}/demos`, { waitUntil: 'networkidle' });
  await waitReady();
  for (const demo of demos) {
    await page.setViewportSize({ width: 1380, height: 1000 });
    await page.getByLabel('Choose a usage demo').selectOption(demo.family);
    await waitReady();
    assert.ok(await page.getByRole('button', { name: 'Play demo motion', exact: true }).isVisible(), 'Reduced motion starts frozen');
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download tuned recipe' }).click();
    await (await downloaded).saveAs(`${out}/${demo.family}.json`);
    assert.deepEqual(JSON.parse(await readFile(`${out}/${demo.family}.json`, 'utf8')), demo.recipe);
    await page.locator('.usage-stage').screenshot({ path: `${out}/${demo.family}-desktop.png` });
    if (publish) await copyFile(`${out}/${demo.family}-desktop.png`, `public/context-previews/${demo.family}.png`);
    const environment = await page.locator('.usage-stage canvas').getAttribute('data-environment');
    rendering.find(item => item.family === demo.family).compositionEnvironment = JSON.parse(environment);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${demo.family} at ${width}px: no horizontal overflow`);
      if (width === 390) await page.locator('.usage-stage').screenshot({ path: `${out}/${demo.family}-mobile.png` });
    }
    console.log(`Composition ${demo.family}: desktop + 390/320px mobile, exact recipe download`);
  }
  await page.setViewportSize({ width: 1380, height: 1000 });
  await page.getByLabel('Choose a usage demo').selectOption('broken-lcd'); await waitReady();
  const time = () => page.locator('.usage-stage canvas').getAttribute('data-time');
  const before = await time();
  await page.getByRole('button', { name: 'Play demo motion', exact: true }).click();
  await page.waitForFunction(previous => document.querySelector('.usage-stage canvas').dataset.time !== previous, before);
  await page.getByRole('button', { name: 'Pause demo motion', exact: true }).click();
  const paused = await time(); await page.waitForTimeout(200); assert.equal(await time(), paused);
  await page.getByRole('button', { name: 'Reset still' }).click(); assert.equal(Number(await time()), demos[0].recipe.time);
  await page.getByRole('button', { name: 'Play demo motion', exact: true }).click();
  await page.locator('#all-demos').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
  const outside = await time(); await page.waitForTimeout(200); assert.equal(await time(), outside, 'Offscreen animation stops');
  await page.getByRole('link', { name: /Raster bloom \/ motion study — Art/ }).click();
  await waitReady(); assert.match(page.url(), /study=raster-bloom/);
  await page.getByRole('button', { name: 'Previous usage demo' }).click(); await waitReady(); assert.match(page.url(), /study=delamination/);
  await page.goBack(); await waitReady(); assert.equal(await page.getByLabel('Choose a usage demo').inputValue(), 'raster-bloom');
  await page.reload({ waitUntil: 'networkidle' }); await waitReady(); assert.equal(await page.getByLabel('Choose a usage demo').inputValue(), 'raster-bloom');
  await page.getByText('Use this surface in your project', { exact: false }).click();
  assert.match(await page.locator('.integration-body code').innerText(), /context-raster-bloom.json/);
  await page.getByText('Use this surface in your project', { exact: false }).click();
  // Every thumbnail is a real rendered composition, not the source texture.
  await page.locator('.context-thumbnail img').evaluateAll(imgs => Promise.all(imgs.map(img => { img.loading = 'eager'; return img.decode(); })));
  await page.locator('.demo-gallery').screenshot({ path: `${out}/gallery.png` });
  await page.getByLabel('Choose a usage demo').selectOption('puncture'); await waitReady();
  await page.screenshot({ path: `${out}/page-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/page-mobile.png`, fullPage: true });
  // Deep links carry only allowlisted built-in recipes into the existing workbench.
  for (const family of ['caustics', 'iridescence', 'glass', 'faultline', 'filament', 'address-drift', 'puncture', 'raster-bloom', 'rift', 'confluence']) {
    const demo = allDemos.find(item => item.family === family);
    await page.goto(`${url}/demos?study=${family}`, { waitUntil: 'networkidle' }); await waitReady();
    await page.getByRole('link', { name: 'Edit this recipe' }).click();
    await page.waitForFunction(() => !document.querySelector('.play-button')?.disabled);
    assert.equal(await page.getByLabel('Preset name').inputValue(), demo.recipe.name);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Recipe ↓', exact: true }).click();
    await (await downloaded).saveAs(`${out}/workbench-${family}.json`);
    assert.deepEqual(JSON.parse(await readFile(`${out}/workbench-${family}.json`, 'utf8')), demo.recipe);
    await page.getByRole('link', { name: 'See in context' }).click(); await waitReady();
    assert.equal(await page.getByLabel('Choose a usage demo').inputValue(), family);
  }
  await page.goto(`${url}/demos?study=__proto__`, { waitUntil: 'networkidle' }); await waitReady();
  assert.equal(await page.getByLabel('Choose a usage demo').inputValue(), 'broken-lcd');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${url}/demos?study=weave`, { waitUntil: 'networkidle' }); await waitReady();
  assert.ok(await page.getByRole('button', { name: 'Play demo motion', exact: true }).isVisible(), 'Physical materials start still without reduced-motion preference');
  await page.getByLabel('Choose a usage demo').selectOption('puncture'); await waitReady();
  assert.ok(await page.getByRole('button', { name: 'Pause demo motion', exact: true }).isVisible(), 'Atmospheres animate without reduced-motion preference');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Play demo motion', exact: true }).waitFor();
  const fallback = await browser.newPage({ viewport: { width: 1380, height: 1000 }, reducedMotion: 'reduce' });
  fallback.on('pageerror', error => errors.push(error.message));
  await fallback.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { value: undefined });
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return ['webgl', 'webgl2', 'experimental-webgl', 'webgpu'].includes(kind) ? null : getContext.call(this, kind, ...args);
    };
  });
  await fallback.goto(`${url}/demos?study=shockfront`, { waitUntil: 'networkidle' });
  await fallback.getByRole('status').filter({ hasText: 'live renderer unavailable' }).waitFor();
  await fallback.locator('.shader-fallback').evaluate(img => img.decode());
  assert.ok(await fallback.getByRole('button', { name: 'Play demo motion', exact: true }).isDisabled());
  assert.equal(await fallback.locator('.usage-stage canvas').evaluate(canvas => getComputedStyle(canvas).opacity), '0');
  assert.ok(await fallback.getByRole('button', { name: 'Download tuned recipe' }).isEnabled());
  await fallback.locator('.usage-stage').screenshot({ path: `${out}/unavailable-renderer-still.png` });
  await fallback.close();
  assert.deepEqual(errors, []);
  const sources = {};
  for (const file of ['src/demos/catalog.ts', 'app/demos/page.tsx', 'app/demos/ShaderSurface.tsx', 'app/demos/Scenes.tsx', 'app/demos/demos.css']) sources[file] = hash(await readFile(file));
  await writeFile(`${out}/report.json`, JSON.stringify({ checkedAt: new Date().toISOString(), url, browser: await browser.version(), methodology: 'Frozen visual captures at recipe time, repeated consumer PNG equality, later-time inequality; interaction and responsive layout checks. No performance benchmark. SwiftShader software rendering is not hardware performance evidence.', sources, rendering, checks: [`${demos.length} tuned recipes reproduce in independent consumer`, `${demos.length} contextual desktop and mobile compositions`, '390px and 320px no overflow', `${demos.length} exact recipe downloads`, 'play, pause, reset, offscreen suspension', 'gallery navigation, previous, browser back, deep link reload', 'workbench recipe round trips for legacy and new families', 'unknown demo safely falls back', 'material stills and ambient animation defaults', 'initial and changed reduced-motion preference', 'one live canvas per composition', 'saved texture fallback when graphics contexts are unavailable', 'no page errors'], errors }, null, 2) + '\n');
  console.log(`All usage demos passed. Evidence: ${out}`);
} finally { await browser.close(); }
