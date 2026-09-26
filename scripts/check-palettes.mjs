import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { paletteCollections, palettePresets, filterPalettes, paletteVariant } from '../src/workbench/palettes.ts';
import { presets, GENERATOR_VERSION } from '../src/seedbank/recipes.ts';
import { launch, openConsumer } from './browser-support.mjs';
const out = process.env.PALETTE_EVIDENCE_DIR || 'artifacts/palette-library';
const url = process.env.SEEDBANK_URL || 'http://127.0.0.1:5187';
await mkdir(out, { recursive: true });
const browser = await launch(), errors = [], checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByLabel('Renderer backend').selectOption('webgl2');
  await page.waitForFunction(() => !document.querySelector('.play-button').disabled);
  await page.getByLabel('Search studies').fill('Broken LCD');
  await page.getByRole('button', { name: /Broken LCD/ }).click();
  await page.getByRole('button', { name: 'Inspect recipe ↗' }).click();
  const recipe = async () => JSON.parse(await page.locator('.recipe-code').innerText());
  await page.getByRole('tab', {name:'Color',exact:true}).click();
  const paletteButton = page.getByRole('button', { name: '⤨ Reroll', exact: true });
  await page.getByText('Browse 673 palette ideas', { exact: true }).click();
  assert.equal(await page.locator('.palette-grid button').count(), 12);
  assert.equal(await page.getByRole('button', { name: 'Previous palette page' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Next palette page' }).click();
  assert.equal(await page.locator('.palette-pagination>span').innerText(), '2 / 49');
  assert.equal(await page.locator('.palette-grid button').first().getAttribute('aria-label'), 'Use Scarlet Voltage palette');
  await page.getByLabel('Palette collection').selectOption('earth');
  assert.equal(await page.locator('.palette-pagination>span').innerText(), '1 / 6');
  assert.match(await page.locator('.palette-pool-note').innerText(), /72 palettes/);
  await page.getByLabel('Search palettes').fill('Copper');
  assert.equal(await page.locator('.palette-grid button').count(), 4);
  await page.getByRole('button', { name: 'Use Copper Patina palette', exact: true }).click();
  assert.deepEqual((await recipe()).palette, paletteVariant(palettePresets.find(p => p.id === 'earth-copper-patina').colors, 3));
  await page.getByLabel('Search palettes').fill('Copper Patina');
  assert.equal(await paletteButton.isDisabled(), true, 'single current palette has no different reroll');
  await page.getByRole('button', { name: 'Clear palette search' }).click();
  for (let i = 0; i < 5; i++) {
    const before = await recipe(); await paletteButton.click();
    const after = await recipe();
    assert.ok(filterPalettes('earth').some(p => JSON.stringify(paletteVariant(p.colors, 3)) === JSON.stringify(after.palette)));
    assert.notDeepEqual(after.palette, before.palette);
    assert.deepEqual(after.parameters, before.parameters); assert.equal(after.seed, before.seed);
  }
  const beforeAll = await recipe();
  await page.getByRole('button', { name: 'Generate a new variation' }).click();
  const allReroll = await recipe();
  assert.ok(filterPalettes('earth').some(p => JSON.stringify(paletteVariant(p.colors, 3)) === JSON.stringify(allReroll.palette)));
  await page.getByRole('button', { name: 'Undo recipe change' }).click();
  assert.deepEqual(await recipe(), beforeAll);
  checks.push('673 palettes; bounded pagination; collection/search intersection; single-option handling; scoped rerolls and undo');
  await page.getByRole('button', { name: 'Lock color 1', exact: true }).click();
  const locked = await recipe(); await paletteButton.click();
  const afterLock = await recipe(); assert.equal(afterLock.palette[0], locked.palette[0]);
  assert.ok(filterPalettes('earth').some(p => p.colors[1] === afterLock.palette[1] && p.colors[2] === afterLock.palette[2]));
  await page.getByLabel('Search palettes').fill('no such palette');
  assert.equal(await page.locator('.palette-grid button').count(), 0);
  assert.equal(await paletteButton.isDisabled(), true);
  assert.deepEqual(await recipe(), afterLock);
  await page.getByRole('button', { name: 'Clear palette search' }).click();
  await page.getByRole('button', { name: 'Lock color 1', exact: true }).click();
  await page.getByLabel('Palette collection').selectOption('experimental');
  await page.getByRole('button', { name: 'Next palette page' }).click();
  await page.getByRole('button', { name: 'Hide recipe ↗' }).click();
  await page.locator('.palette-editor').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/palette-browser-desktop.png` });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('.palette-editor').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${out}/palette-browser-${width}.png` });
  }
  checks.push('color locks preserved; empty search is safe; desktop and 390px/320px palette layouts');
  await page.close();

  const board = await context.newPage(); await board.setViewportSize({ width: 1280, height: 850 });
  const style = '<style>body{background:#f5f3ec;color:#252b27;font:13px system-ui;margin:24px}h1{font-size:23px}main{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}article{border:1px solid #d4d4ca;padding:6px}figure{display:flex;height:32px;margin:0 0 5px}figure i{flex:1}small{font-size:10px}</style>';
  for (const collection of paletteCollections) {
    const palettes = filterPalettes(collection.id);
    const html = `${style}<h1>${collection.name} · ${palettes.length} palettes</h1><main>${palettes.map(p => `<article><figure>${p.colors.map(c => `<i style="background:${c}"></i>`).join('')}</figure><small>${p.name}</small></article>`).join('')}</main>`;
    await writeFile(`${out}/swatches-${collection.id}.html`, html);
    await board.setContent(html); await board.screenshot({ path: `${out}/swatches-${collection.id}.png`, fullPage: true });
  }
  const { page: consumer, errors: consumerErrors } = await openConsumer(browser, url, 'webgl2');
  const rendered = [];
  for (const [group, collection] of paletteCollections.filter(c => c.id !== 'signature').entries()) {
    const pool = filterPalettes(collection.id);
    const samples = [pool[(5 + group * 7) % pool.length], pool[(39 + group * 11) % pool.length]];
    for (let index = 0; index < samples.length; index++) {
      const palette = samples[index], family = index ? 'rotor' : 'broken-lcd';
      const input = { ...presets.find(p => p.family === family), generatorVersion: GENERATOR_VERSION, palette: palette.colors };
      const result = await consumer.evaluate(async recipe => {
        const r = window.seedbank.runtime; r.setRecipe(recipe); r.resize(480, 320); await r.compile();
        const blob = await r.capture(recipe.time);
        const data = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
        return { data, environment: r.environment() };
      }, input);
      await writeFile(`${out}/${palette.id}-${family}.png`, Buffer.from(result.data.split(',')[1], 'base64'));
      rendered.push({ palette, family, ...result });
    }
  }
  const sheet = `<style>body{background:#eeeae0;color:#222;font:12px system-ui;margin:16px}h1{font-size:22px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article img{width:100%;display:block;margin-bottom:5px}</style><h1>Palette samples · Broken LCD + Rotor · frozen at 3.25s</h1><main>${rendered.map(r => `<article><img src="${r.data}"/><b>${r.palette.name}</b> · ${r.family}</article>`).join('')}</main>`;
  await writeFile(`${out}/shader-samples.html`, sheet);
  await board.setContent(sheet); await board.screenshot({ path: `${out}/shader-samples.png`, fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(consumerErrors, []);
  const report = { checkedAt: new Date().toISOString(), browser: await browser.version(), palettes: palettePresets.length, checks, errors,
    methodology: '16 representative frozen renders at 480×320, explicit recipe time, WebGL2/SwiftShader. Visual evidence, not hardware performance or aesthetic acceptance.',
    renders: rendered.map(({ palette, family, environment }) => ({ palette: palette.id, family, environment })) };
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ palettes: report.palettes, checks, rendered: rendered.length, errors }, null, 2));
} finally { await browser.close(); }
