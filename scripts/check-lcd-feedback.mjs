import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { launch, openConsumer } from './browser-support.mjs';

const url = process.env.SEEDBANK_URL || 'http://127.0.0.1:5187';
const out = process.env.LCD_REVIEW_DIR || 'artifacts/broken-lcd-feedback';
try { await access(`${out}/ACCEPTED`); throw new Error('Choose a fresh LCD_REVIEW_DIR; accepted evidence is protected.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(`${out}/motion`, { recursive: true });
const browser = await launch();
try {
  const { page, errors } = await openConsumer(browser, url, 'webgl2');
  const result = await page.evaluate(async family => {
    const runtime = window.seedbank.runtime;
    const recipe = window.seedbank.presets.find(r => r.family === family);
    if (!recipe) throw new Error(`Unknown feedback family: ${family}`); runtime.setRecipe(recipe); runtime.resize(640, 640); await runtime.compile();
    const capture = async time => {
      const blob = await runtime.capture(time);
      return new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
    };
    const reference = await capture(recipe.time);
    await capture(recipe.time + .5);
    const backwardSeek = reference === await capture(recipe.time);
    runtime.setRecipe(recipe);
    const resetRepeat = reference === await capture(recipe.time);
    // Cross a feedback epoch by small steps, then compare to a fresh direct seek.
    const before = (512 - 3) / (60 * recipe.parameters.speed);
    const after = (512 + 3) / (60 * recipe.parameters.speed);
    await capture(before);
    const timings = [];
    for (let n = 510; n <= 515; n++) {
      const start = performance.now(); runtime.render(n / (60 * recipe.parameters.speed));
      timings.push(performance.now() - start);
    }
    const continuous = await capture(after);
    runtime.setRecipe(recipe);
    const epochSeek = continuous === await capture(after);
    runtime.setRecipe(recipe); runtime.render(3600);
    const maxTime = (await capture(3600)) === (await capture(3600));
    runtime.setRecipe(recipe); runtime.resize(480, 640); await capture(recipe.time);
    runtime.resize(640, 640);
    const resizeRepeat = reference === await capture(recipe.time);
    const frames = [];
    for (let n = 0; n < 60; n++) frames.push(await capture(recipe.time + n / 30));
    const environment = runtime.environment();
    return { backwardSeek, resetRepeat, epochSeek, maxTime, resizeRepeat, epochSubmissionMs: timings, frames, environment };
  }, process.env.LCD_FAMILY || 'broken-lcd');
  for (const key of ['backwardSeek', 'resetRepeat', 'epochSeek', 'maxTime', 'resizeRepeat']) assert.equal(result[key], true, key);
  assert.deepEqual(errors, []);
  for (let n = 0; n < result.frames.length; n++) await writeFile(`${out}/motion/${String(n).padStart(3, '0')}.png`, Buffer.from(result.frames[n].split(',')[1], 'base64'));
  const { frames, ...report } = result;
  await writeFile(`${out}/feedback-report.json`, JSON.stringify({ ...report, frames: frames.length, fps: 30,
    methodology: 'Explicit-time replay, backward seek, recipe and resize resets, epoch boundary and max legal time. 60 PNGs at 30 fps for motion review. Software GPU; submission timings do not measure GPU completion.', errors }, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
