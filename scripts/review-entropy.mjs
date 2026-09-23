// Extended visual evidence: adjacent frames, a full minute, and late timelines.
import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { launch, openConsumer } from './browser-support.mjs';
const family = process.env.ENTROPY_FAMILY || 'rift';
const out = process.env.ENTROPY_REVIEW_DIR || `artifacts/entropy-review-01-${family}`;
try { await access(`${out}/ACCEPTED`); throw new Error('Choose fresh entropy evidence; accepted artifacts are protected.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(`${out}/lifecycle`, { recursive: true }); await mkdir(`${out}/late`, { recursive: true });
const browser = await launch();
try {
  const { page, errors } = await openConsumer(browser, process.env.SEEDBANK_URL || 'http://127.0.0.1:5187', 'webgl2');
  const result = await page.evaluate(async family => {
    const runtime = window.seedbank.runtime, recipe = window.seedbank.presets.find(r => r.family === family);
    runtime.setRecipe(recipe); runtime.resize(480, 480); await runtime.compile();
    const capture = async time => {
      const blob = await runtime.capture(time);
      return new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
    };
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
    const signatures = [], frames = [];
    for (let n = 0; n <= 1800; n++) {
      runtime.render(n / 30);
      if (n % 60 === 0) {
        const png = await capture(n / 30); frames.push({ time: n / 30, png });
        const img = new Image(); img.src = png; await img.decode(); context.drawImage(img, 0, 0, 64, 64);
        signatures.push([...context.getImageData(0, 0, 64, 64).data]);
      }
      if (n % 15 === 0) await new Promise(requestAnimationFrame);
    }
    const sequential = await capture(60); runtime.setRecipe(recipe);
    const minuteReplay = sequential === await capture(60);
    const changed = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]) > 10) n++; return n / 4096; };
    const nearestRecurrence = [];
    for (let i = 0; i < signatures.length; i++) for (let j = i + 4; j < signatures.length; j++) nearestRecurrence.push({ first: i*2, second: j*2, changedFraction: changed(signatures[i], signatures[j]) });
    nearestRecurrence.sort((a,b) => a.changedFraction-b.changedFraction);
    const late = [];
    for (const time of [123.25, 603.25, 3600.01, 3603.25, 86403.25, 604803.25, 31536003.25, 315359998]) {
      runtime.setRecipe(recipe); const png = await capture(time);
      const moving = png !== await capture(time + .25);
      runtime.setRecipe(recipe); const repeated = png === await capture(time);
      late.push({ time, png, moving, repeated });
    }
    // Sequentially cross the historical one-hour loop and a very late epoch.
    const boundaries = [];
    for (const start of [3599.8, 86400.8, 315359997.8]) {
      runtime.setRecipe(recipe); runtime.render(start);
      for (let n = 1; n <= 18; n++) runtime.render(start + n / 30);
      const a = await capture(start + .6); runtime.setRecipe(recipe);
      boundaries.push({ start, identical: a === await capture(start + .6) });
    }
    return { frames, late, boundaries, minuteReplay, allMinuteFramesDistinct: new Set(frames.map(f => f.png)).size === frames.length,
      closestLongRangeFrames: nearestRecurrence.slice(0, 8), environment: runtime.environment() };
  }, family);
  assert.ok(result.minuteReplay && result.allMinuteFramesDistinct);
  assert.ok(result.late.every(f => f.moving && f.repeated), 'Late fields remain active and deterministic');
  assert.ok(result.boundaries.every(b => b.identical), 'Late continuous history matches exact seeking');
  assert.deepEqual(errors, []);
  for (const [i, frame] of result.frames.entries()) await writeFile(`${out}/lifecycle/${String(i).padStart(2,'0')}.png`, Buffer.from(frame.png.split(',')[1], 'base64'));
  for (const [i, frame] of result.late.entries()) await writeFile(`${out}/late/${String(i).padStart(2,'0')}.png`, Buffer.from(frame.png.split(',')[1], 'base64'));
  const {frames,late,...rest} = result;
  await writeFile(`${out}/lifecycle-report.json`, JSON.stringify({ family, ...rest, seconds: 60, keyframeTimes: frames.map(f=>f.time), late: late.map(f => ({ time: f.time, moving: f.moving, repeated: f.repeated })), methodology: '60 seconds sequential at 30 fps input, 480px square. 64px nearest-pixel recurrence comparisons only flag frames for human review; they do not prove perceptual non-repetition. Late seeks through ten years and continuous boundary checks. Software GPU correctness evidence, not hardware performance.', errors }, null, 2));
  console.log(`${family}: minute replay, continuing late events, one-hour/day/late boundaries passed. Nearest long-range difference: ${(result.closestLongRangeFrames[0].changedFraction*100).toFixed(1)}%.`);
} finally { await browser.close(); }
