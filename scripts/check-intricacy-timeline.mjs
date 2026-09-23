// Verify the workbench clock and portable recipes beyond the former hour loop.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { launch, openConsumer } from './browser-support.mjs';
const url = process.env.SEEDBANK_URL || 'http://127.0.0.1:5187';
const out = process.env.INTRICACY_TIMELINE_DIR || 'artifacts/intricacy-timeline-01';
await mkdir(out, { recursive: true });
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', acceptDownloads: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${url}/?demo=intaglio`, { waitUntil: 'networkidle' });
  await page.getByLabel('Renderer backend').selectOption('webgl2');
  await page.waitForFunction(() => !document.querySelector('.play-button')?.disabled);
  const frozen = page.getByLabel('Frozen time in seconds');
  assert.equal(await frozen.getAttribute('max'), '1000000000000');
  await frozen.fill('3599.9'); await frozen.press('Tab');
  await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  await page.waitForFunction(() => parseFloat(document.querySelector('.time-readout').textContent) > 3600.15);
  await page.getByRole('button', { name: 'Freeze this frame' }).click();
  assert.ok(Number(await frozen.inputValue()) > 3600);
  const crossedHourAt = Number(await frozen.inputValue());
  await frozen.fill('10000000000.25'); await frozen.press('Tab');
  await page.getByLabel('Preset name').fill('Late intricacy replay');
  await page.getByRole('button', { name: /Save preset/ }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /Saved/ }).click();
  await page.getByRole('button', { name: /Late intricacy replay seed/ }).click();
  assert.equal(await frozen.inputValue(), '10000000000.25');
  await page.getByLabel('Renderer backend').selectOption('webgl2');
  await page.waitForFunction(() => !document.querySelector('.play-button')?.disabled);
  const download = async (name, file) => {
    const next = page.waitForEvent('download'); await page.getByRole('button', { name, exact: true }).click();
    await (await next).saveAs(`${out}/${file}`);
  };
  await download('Recipe ↓', 'late-recipe.json');
  await download('Export PNG ↗', 'late-frame.png');
  const recipe = JSON.parse(await readFile(`${out}/late-recipe.json`, 'utf8'));
  assert.equal(recipe.time, 10000000000.25); assert.equal(recipe.family, 'intaglio');
  const size = await page.locator('canvas').evaluate(c => ({ width: c.width, height: c.height }));
  const { page: consumer, errors: consumerErrors } = await openConsumer(browser, url, 'webgl2');
  const png = await consumer.evaluate(async ({ recipe, width, height }) => {
    const r = window.seedbank.runtime; r.setRecipe(recipe); r.resize(width, height); await r.compile();
    const blob = await r.capture();
    return new Promise(resolve => { const f = new FileReader(); f.onload = () => resolve(f.result); f.readAsDataURL(blob); });
  }, { recipe, ...size });
  assert.deepEqual(Buffer.from(png.split(',')[1], 'base64'), await readFile(`${out}/late-frame.png`));
  await frozen.fill('999999999998'); await frozen.press('Tab');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${out}/late-mobile.png`, fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(consumerErrors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ browser: await browser.version(), crossedHourAt, lateRecipeRoundTrip: true,
    independentLatePngIdentical: true, lateMobileNoOverflow: true, errors, consumerErrors }, null, 2));
  console.log('Intricacy workbench passes one hour without wrapping; late saved recipe and PNG reproduce exactly.');
} finally { await browser.close(); }
