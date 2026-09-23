import { mkdir, writeFile } from 'node:fs/promises';
import { launch, openConsumer } from './browser-support.mjs';

const url = process.env.SEEDBANK_URL || 'http://127.0.0.1:5187';
const out = process.env.LCD_REVIEW_DIR || 'artifacts/broken-lcd-review-01';
await mkdir(out, { recursive: true });
const browser = await launch();
const errors = [];
try {
  const { page: consumer, errors: consumerErrors } = await openConsumer(browser, url, 'webgl2');
  const result = await consumer.evaluate(async () => {
    const recipe = window.seedbank.presets.find(item => item.family === 'broken-lcd');
    const runtime = window.seedbank.runtime;
    runtime.setRecipe(recipe); runtime.resize(960, 640); await runtime.compile();
    const capture = async time => {
      const blob = await runtime.capture(time);
      return new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
    };
    const frozen = await capture(recipe.time);
    const repeated = frozen === await capture(recipe.time);
    const animated = frozen !== await capture(recipe.time + 1.5);
    const environment = runtime.environment();
    runtime.resize(768, 768);
    const square = await capture(recipe.time);
    return { recipe, frozen, repeated, animated, environment, square };
  });
  if (!result.repeated || !result.animated || consumerErrors.length) throw new Error(`Consumer render failed: ${JSON.stringify({ ...result, frozen: undefined, square: undefined, consumerErrors })}`);
  await writeFile(`${out}/frozen.png`, Buffer.from(result.frozen.split(',')[1], 'base64'));
  await writeFile(`${out}/square.png`, Buffer.from(result.square.split(',')[1], 'base64'));
  await consumer.close();
  const page = await browser.newPage({ viewport: { width: 1380, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${url}/demos?study=broken-lcd`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.usage-stage[data-family="broken-lcd"] .shader-surface[data-ready="true"]', { timeout: 45000 });
  await page.locator('.usage-stage').screenshot({ path: `${out}/poster.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.usage-stage').screenshot({ path: `${out}/poster-mobile.png` });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (errors.length || mobileOverflow) throw new Error(`Demo page failed: ${JSON.stringify({ errors, mobileOverflow })}`);
  await writeFile(`${out}/report.json`, JSON.stringify({ recipe: result.recipe, repeated: result.repeated,
    animated: result.animated, environment: result.environment, browser: await browser.version(),
    methodology: 'Fixed time 960×640 PNG in independent consumer, repeated at identical time and compared with +1.5s; poster screenshots at reduced motion. Software adapter is correctness evidence, not hardware performance.',
    mobileOverflow, errors }, null, 2) + '\n');
} finally { await browser.close(); }
