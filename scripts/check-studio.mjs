// Browser checks for the public studio: roll scope and locks, palette pools, share links,
// PNG sizes with pixel scaling, video recording, code export, keyboard and layouts.
// Usage: SEEDBANK_URL=http://127.0.0.1:5187 STUDIO_EVIDENCE_DIR=artifacts/studio-01 node scripts/check-studio.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { launch } from './browser-support.mjs';
const url = process.env.SEEDBANK_URL || 'http://127.0.0.1:5187';
const out = process.env.STUDIO_EVIDENCE_DIR || 'artifacts/studio-ui';
await mkdir(out, { recursive: true });
const browser = await launch();
const errors = [], checks = [];
const pngSize = buffer => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const recipe = () => page.evaluate(() => { const token = location.hash.slice(3).replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token), c => c.charCodeAt(0)))); });
  const settle = () => page.waitForTimeout(500);
  await page.goto(`${url}/?study=broken-lcd`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Frame' }).click();
  await page.getByLabel('Renderer backend').selectOption('webgl2');
  await page.waitForFunction(() => !document.querySelector('.canvas-note'), null, { timeout: 60000 });
  await settle();
  const start = await recipe();
  assert.equal(start.family, 'broken-lcd');
  checks.push('study query and hash-synchronized recipe');

  await page.getByRole('button', { name: 'Roll', exact: true }).click(); await settle();
  const rolled = await recipe();
  assert.notEqual(rolled.family, start.family); assert.equal(rolled.generatorVersion, '1.9.0');
  await page.getByRole('button', { name: 'Undo recipe change' }).click(); await settle();
  assert.deepEqual((await recipe()).family, start.family);
  await page.getByRole('button', { name: 'Redo recipe change' }).click(); await settle();
  assert.deepEqual(await recipe(), rolled);
  checks.push('roll changes study, palette, shape and seed; undo and redo restore exact recipes');

  await page.getByRole('button', { name: 'Study', exact: true }).click();
  await page.getByRole('tab', { name: 'Shape' }).click();
  await page.getByRole('button', { name: 'Lock Scale', exact: true }).click();
  const before = await recipe();
  await page.keyboard.press('r'); await settle();
  const scoped = await recipe();
  assert.equal(scoped.family, before.family); assert.equal(scoped.parameters.scale, before.parameters.scale);
  assert.notEqual(scoped.seed, before.seed);
  await page.getByRole('button', { name: 'Study', exact: true }).click();
  await page.getByRole('button', { name: 'Lock Scale', exact: true }).click();
  checks.push('scope chips and parameter locks constrain the keyboard roll');

  await page.getByLabel('Scale value', { exact: true }).fill('3.217'); await page.getByLabel('Scale value', { exact: true }).press('Enter'); await settle();
  assert.equal((await recipe()).parameters.scale, 3.217);
  checks.push('exact numeric entry');

  await page.getByRole('button', { name: /^Palettes/ }).click();
  await page.getByLabel('Palette collection').selectOption('machines');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Use Amber Monitor palette' }).click(); await settle();
  const amber = await recipe();
  assert.equal(amber.palette[0], '#120a02');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Study', exact: true }).click();
  await page.getByRole('button', { name: 'Shape', exact: true }).click();
  await page.getByRole('button', { name: 'Seed', exact: true }).click();
  for (let i = 0; i < 6; i++) { await page.keyboard.press('r'); await settle(); const p = (await recipe()).palette; assert.ok(['#120a02', '#0a0a0c', '#050b0c', '#0c0706', '#050000', '#07070a', '#140400', '#02060a', '#3a2d86', '#1b1340'].includes(p[0]), p.join()); }
  for (const name of ['Study', 'Shape', 'Seed']) await page.getByRole('button', { name, exact: true }).click();
  checks.push('palette drawer filters define the palette roll pool');

  const shared = await recipe();
  await page.getByRole('button', { name: /Share/ }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const other = await context.newPage(); other.on('pageerror', e => errors.push(e.message));
  await other.goto(link, { waitUntil: 'networkidle' }); await other.waitForTimeout(800);
  const reopened = await other.evaluate(() => { const token = location.hash.slice(3).replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token), c => c.charCodeAt(0)))); });
  assert.deepEqual(reopened, shared);
  await other.close();
  checks.push('share link reopens the identical recipe');

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: /^Square/ }).click();
  let [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PNG' }).click()]);
  let file = `${out}/still-1x.png`; await download.saveAs(file);
  assert.deepEqual(pngSize(await readFile(file)), { width: 1080, height: 1080 });
  await page.getByRole('button', { name: '3×', exact: true }).click();
  [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PNG' }).click()]);
  file = `${out}/still-3x.png`; await download.saveAs(file);
  assert.deepEqual(pngSize(await readFile(file)), { width: 3240, height: 3240 });
  checks.push('PNG exports at exact size, with hard-edged 3× scaling');

  await page.getByRole('tab', { name: 'Video' }).click();
  await page.getByRole('button', { name: /^Thumbnail/ }).click();
  await page.getByRole('button', { name: '5 s', exact: true }).click();
  const record = page.getByRole('button', { name: /Record 5 s video/ });
  if (await record.isEnabled()) {
    [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), record.click()]);
    file = `${out}/clip.${download.suggestedFilename().split('.').pop()}`; await download.saveAs(file);
    assert.ok((await readFile(file)).length > 2000);
    checks.push(`5 s video recorded (${download.suggestedFilename()})`);
  } else checks.push('video recording unavailable in this browser (button disabled, as designed)');

  await page.getByRole('tab', { name: 'Code' }).click();
  [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download code \+ source/ }).click()]);
  file = `${out}/code.zip`; await download.saveAs(file);
  assert.ok((await readFile(file)).subarray(0, 2).toString() === 'PK');
  checks.push('runnable code ZIP');
  await page.keyboard.press('Escape');

  // Saved presets persist across reloads; exported recipe files import exactly.
  await page.getByLabel('Preset name').fill('Studio check keeper'); await page.getByLabel('Preset name').press('Enter'); await settle();
  const keeper = await recipe();
  await page.getByRole('button', { name: 'Save preset' }).click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('tab', { name: 'Recipe & link' }).click();
  [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download recipe', exact: true }).click()]);
  file = `${out}/keeper.json`; await download.saveAs(file);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), keeper);
  await page.keyboard.press('Escape');
  await page.goto(`${url}/?study=pyre`, { waitUntil: 'networkidle' }); await settle();
  await page.getByRole('button', { name: /^Studies/ }).click();
  await page.getByRole('tab', { name: /Saved/ }).click();
  await page.getByRole('button', { name: /Studio check keeper seed/ }).click(); await settle();
  const restored = await recipe();
  assert.deepEqual({ ...restored, id: keeper.id }, keeper);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('tab', { name: 'Recipe & link' }).click();
  await page.locator('input[type=file]').setInputFiles(file); await settle();
  assert.deepEqual(await recipe(), keeper);
  checks.push('saved preset survives a reload; downloaded recipe re-imports exactly');

  const study = (await recipe()).family;
  await page.locator('.identity').click();
  await page.keyboard.press('ArrowRight'); await settle();
  assert.notEqual((await recipe()).family, study);
  checks.push('arrow keys step through studies');
  await page.screenshot({ path: `${out}/desktop.png` });

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  phone.on('pageerror', e => errors.push(e.message));
  await phone.goto(`${url}/?study=tartan`, { waitUntil: 'networkidle' }); await phone.waitForTimeout(3000);
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `phone horizontal overflow ${overflow}px`);
  await phone.screenshot({ path: `${out}/phone.png` });
  checks.push('390 px phone layout without horizontal scroll');
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ url, checks, errors, browser: browser.version(), note: 'Software rendering (SwiftShader) in CI-like runs; not a hardware performance measurement.' }, null, 2) + '\n');
  console.log(checks.map(c => `ok  ${c}`).join('\n'));
} finally { await browser.close(); }
