import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { launch, openConsumer } from './browser-support.mjs';

const out = process.env.SORTER_REVIEW_DIR || 'artifacts/sorter-comparison-01';
try { await access(`${out}/ACCEPTED`); throw new Error('Choose a fresh SORTER_REVIEW_DIR; accepted evidence is protected.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(out, { recursive: true });
const browser = await launch();
try {
  const { page, errors } = await openConsumer(browser, process.env.SEEDBANK_URL || 'http://127.0.0.1:5187', 'webgl2');
  const results = [];
  const families = (process.env.REVIEW_FAMILIES || 'broken-lcd,crosscurrent,undertow,downpour,faultline').split(',');
  for (const family of families) {
    const result = await page.evaluate(async family => {
      const runtime = window.seedbank.runtime;
      const benchmark = window.seedbank.presets.find(r => r.family === 'broken-lcd');
      const own = window.seedbank.presets.find(r => r.family === family);
      const common = { ...own, seed: benchmark.seed, palette: [...benchmark.palette], parameters: { ...benchmark.parameters } };
      runtime.setRecipe(common); runtime.resize(640, 640); await runtime.compile();
      const capture = async time => {
        const blob = await runtime.capture(time);
        return new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
      };
      const images = [];
      for (const time of [3.25, 9, 23]) images.push({ time, png: await capture(time) });
      runtime.setRecipe(own); runtime.resize(960, 640); runtime.render(own.time);
      // Sequential live work; no other canvases animate during this sample.
      let start = performance.now();
      for (let n = 0; n < 30; n++) {
        const now = await new Promise(requestAnimationFrame);
        runtime.render(own.time + (now - start) / 1000);
      }
      const warmupSeconds = (performance.now() - start) / 1000;
      start = performance.now();
      const frames = [];
      while (performance.now() - start < 5000) {
        const now = await new Promise(requestAnimationFrame);
        runtime.render(own.time + warmupSeconds + (now - start) / 1000);
        frames.push(now);
      }
      const intervals = frames.slice(1).map((t, i) => t - frames[i]).sort((a, b) => a - b);
      return { images, sharedInputs: { seed: common.seed, parameters: common.parameters, palette: common.palette },
        environment: runtime.environment(), fps: (frames.length - 1) * 1000 / (frames.at(-1) - frames[0]),
        frames: frames.length, durationMs: frames.at(-1) - frames[0],
        medianIntervalMs: intervals[Math.floor(intervals.length / 2)], p95IntervalMs: intervals[Math.floor(intervals.length * .95)] };
    }, family);
    const { images, ...report } = result;
    const hashes = [];
    for (const { time, png } of images) {
      const bytes = Buffer.from(png.split(',')[1], 'base64');
      await writeFile(`${out}/${family}-${time}.png`, bytes);
      hashes.push(createHash('sha256').update(bytes).digest('hex'));
    }
    results.push({ family, ...report, hashes });
    console.log(`${family}: ${result.fps.toFixed(1)} software RAF fps; shared-input comparison captured`);
  }
  assert.equal(new Set(results.map(r => r.hashes[0])).size, families.length, 'Same inputs produce different compositions');
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ browser: await browser.version(), results, errors,
    methodology: '640-square stills with identical seed, parameters and palette at three explicit times; hashes establish differing output, not aesthetic merit. Performance: 960x640 canvas, default recipe, 30 warmup callbacks then 5 seconds of RAF-driven rendering, one effect at a time. Software rendering; not a physical GPU benchmark.' }, null, 2) + '\n');
} finally { await browser.close(); }
