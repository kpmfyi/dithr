import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { launch, openConsumer } from './browser-support.mjs';

const out = process.env.LCD_REVIEW_DIR || 'artifacts/broken-lcd-lifecycle';
try { await access(`${out}/ACCEPTED`); throw new Error('Choose a new LCD_REVIEW_DIR; accepted evidence is protected.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(`${out}/lifecycle`, { recursive: true });
const browser = await launch();
try {
  const { page, errors } = await openConsumer(browser, process.env.SEEDBANK_URL || 'http://127.0.0.1:5187', 'webgl2');
  const result = await page.evaluate(async family => {
    const runtime = window.seedbank.runtime;
    const recipe = window.seedbank.presets.find(r => r.family === family);
    if (!recipe) throw new Error(`Unknown feedback family: ${family}`); runtime.setRecipe(recipe); runtime.resize(480, 480); await runtime.compile();
    const canvas = document.querySelector('canvas');
    const capture = async t => {
      const blob = await runtime.capture(t);
      return new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
    };
    const frames = [];
    // A full minute of simulated life, rendered sequentially across every
    // feedback boundary. Preserve a still every 2 s for composition review.
    for (let n = 0; n <= 1800; n++) {
      runtime.render(n / 30);
      if (n % 60 === 0) frames.push({ time: n / 30, png: await capture(n / 30) });
      if (n % 15 === 0) await new Promise(requestAnimationFrame);
    }
    const sequential = await capture(60);
    runtime.setRecipe(recipe);
    const directSeekAfterMinute = sequential === await capture(60);
    const signatures = new Set(frames.map(f => f.png));
    return { frames, environment: runtime.environment(), directSeekAfterMinute,
      allKeyframesDistinct: signatures.size === frames.length, canvas: { width: canvas.width, height: canvas.height } };
  }, process.env.LCD_FAMILY || 'broken-lcd');
  assert.equal(result.directSeekAfterMinute, true, 'One minute of continuous history matches a fresh direct seek');
  assert.equal(result.allKeyframesDistinct, true);
  assert.deepEqual(errors, []);
  for (let i = 0; i < result.frames.length; i++) await writeFile(`${out}/lifecycle/${String(i).padStart(2, '0')}.png`, Buffer.from(result.frames[i].png.split(',')[1], 'base64'));
  const { frames, ...report } = result;
  await writeFile(`${out}/lifecycle-report.json`, JSON.stringify({ ...report, seconds: 60,
    keyframeTimes: frames.map(f => f.time), simulationInputFps: 30,
    methodology: 'Sequential explicit-time simulation for 60 seconds with stills every 2 seconds; checks include a fresh seek after the full run. Distinct frames do not establish aesthetic non-repetition. Software GPU; this is not a performance benchmark.', errors }, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
