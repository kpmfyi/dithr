import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { presets, isIntricacy, isPixelSorter, isDeparture, isDamage, isEntropy, variation, validateRecipe, serializeRecipe } from '../src/seedbank/recipes.ts';
import { launch, openConsumer } from './browser-support.mjs';
const args = process.argv.slice(2);
const allowed = new Set(['--limit', '--backend', '--out', '--url', '--seed', '--offset']);
for (let i = 0; i < args.length; i += 2) if (!allowed.has(args[i]) || !args[i + 1]) throw new Error(`Unknown or incomplete option: ${args[i]}`);
const option = (key, fallback) => { const i = args.indexOf(key); return i < 0 ? fallback : args[i + 1]; };
const limit = Number(option('--limit', '3'));
if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw new Error('--limit must be 1–12.');
const backend = option('--backend', 'webgl2');
if (!['webgl2', 'webgpu'].includes(backend)) throw new Error('--backend must be webgl2 or webgpu (tested separately).');
const offset = Number(option('--offset', '0'));
if (!Number.isInteger(offset) || offset < 0 || offset >= presets.length) throw new Error(`--offset must be 0–${presets.length - 1}.`);
const baseSeed = args.includes('--seed') ? Number(option('--seed')) : null;
if (baseSeed !== null && (!Number.isInteger(baseSeed) || baseSeed < 0 || baseSeed + limit > 65536)) throw new Error('Seed range exceeds 0–65535.');
const out = resolve(option('--out', `artifacts/batch-${backend}`));
const url = option('--url', process.env.SEEDBANK_URL || 'http://127.0.0.1:5187');
await mkdir(out, { recursive: true });
const queuePath = join(out, 'queue.json');
if (baseSeed === null && offset + limit > presets.length) throw new Error('Selected catalog range exceeds available studies. Reduce --limit or use --seed for variations.');
const proposed = Array.from({ length: limit }, (_, i) => ({ recipe: baseSeed === null ? presets[offset + i] : variation(presets[(offset + i) % presets.length], baseSeed + i), attempts: 0, status: 'pending' }));
let queue;
try {
  queue = JSON.parse(await readFile(queuePath, 'utf8'));
  if (queue.backend !== backend || JSON.stringify(queue.items.map(item => item.recipe)) !== JSON.stringify(proposed.map(item => item.recipe))) throw new Error('Existing queue has different recipes/backend. Choose a fresh --out directory.');
} catch (error) { if (error.code !== 'ENOENT') throw error; queue = { version: 1, backend, items: proposed }; }
const checkpoint = async () => { const temp = `${queuePath}.tmp`; await writeFile(temp, JSON.stringify(queue, null, 2)); await rename(temp, queuePath); };
await checkpoint();
const browser = await launch();
let failed = false;
try {
  const { page, errors } = await openConsumer(browser, url, backend);
  for (const item of queue.items) {
    if (item.status === 'complete') { console.log(`Resume: keeping ${item.recipe.id}`); continue; }
    if (item.attempts >= 3) { failed = true; console.log(`Revision cap: ${item.recipe.id}`); continue; }
    const dir = join(out, item.recipe.id);
    await mkdir(dir, { recursive: true });
    // Explicit acceptance is separate from technical completion and never overwritten.
    try { await access(join(dir, 'ACCEPTED')); console.log(`Protected accepted entry: ${item.recipe.id}`); continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    item.attempts++; item.status = 'running'; await checkpoint();
    try {
      const recipe = validateRecipe(item.recipe);
      const result = await page.evaluate(async recipe => {
        const runtime = window.seedbank.runtime;
        runtime.setRecipe(recipe); runtime.resize(960, 640); await runtime.compile();
        const encode = async blob => new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
        const frame = await encode(await runtime.capture(recipe.time));
        const repeat = await encode(await runtime.capture(recipe.time));
        const later = await encode(await runtime.capture(recipe.time + 1.5));
        const probe = document.createElement('canvas'); probe.width = 960; probe.height = 640;
        const ctx = probe.getContext('2d');
        const decode = async url => { const img = new Image(); img.src = url; await img.decode(); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, 960, 640).data; };
        const pixels = await decode(frame); const next = await decode(later);
        let changed = 0; const colors = new Set();
        for (let i = 0; i < pixels.length; i += 4) { if (Math.abs(pixels[i] - next[i]) + Math.abs(pixels[i + 1] - next[i + 1]) + Math.abs(pixels[i + 2] - next[i + 2]) > 6) changed++; if (i % 256 === 0) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`); }
        const controlResponse = {};
        if (['1.5.0', '1.6.0'].includes(recipe.generatorVersion)) {
          for (const key of ['scale', 'intensity', 'detail']) {
            const value = ({ scale: [2.1, 7.3], intensity: [.6, 1.7], detail: [.1, .9] })[key].find(v => v !== recipe.parameters[key]);
            runtime.setRecipe({ ...recipe, parameters: { ...recipe.parameters, [key]: value } });
            controlResponse[key] = (await encode(await runtime.capture(recipe.time))) !== frame;
          }
          runtime.setRecipe(recipe);
        }
        const measurement = await runtime.measure(60);
        // Compile and render extremes to catch invalid parameter combinations.
        for (const params of [{ scale: 1, speed: 0, intensity: .1, detail: 0 }, { scale: 12, speed: 2, intensity: 2, detail: 1 }]) { runtime.setRecipe({ ...recipe, parameters: params }); runtime.render(recipe.time); }
        runtime.setRecipe(recipe);
        const motion = [];
        for (let i = 0; i < 8; i++) motion.push(await encode(await runtime.capture(recipe.time + i * .25)));
        return { frame, repeat, later, motion, measurement, technical: { frozenRepeatIdentical: frame === repeat, sampledColors: colors.size, changedPixelFraction: changed / (960 * 640), parameterExtremesRendered: true, controlResponse } };
      }, recipe);
      if (errors.length) throw new Error(errors.join('\n'));
      // Flat-tone departure displays use nine tones plus small GPU rounding differences.
      const minimumSampledColors = (isDeparture(recipe.family) || isDamage(recipe.family) || isEntropy(recipe.family) || isIntricacy(recipe.family)) ? 3 : 20;
      const maximumSampledColors = (isDeparture(recipe.family) || isDamage(recipe.family) || isEntropy(recipe.family) || isIntricacy(recipe.family)) ? 16 : Infinity;
      result.technical.minimumSampledColors = minimumSampledColors;
      if (Number.isFinite(maximumSampledColors)) result.technical.maximumSampledColors = maximumSampledColors;
      if (Object.values(result.technical.controlResponse).some(passed => !passed) || !result.technical.frozenRepeatIdentical || result.technical.sampledColors < minimumSampledColors || result.technical.sampledColors > maximumSampledColors || result.technical.changedPixelFraction < .01) throw new Error(`Render validation failed: ${JSON.stringify(result.technical)}`);
      const png = data => Buffer.from(data.split(',')[1], 'base64');
      await writeFile(join(dir, 'recipe.json'), serializeRecipe(recipe));
      await writeFile(join(dir, 'frozen.png'), png(result.frame));
      await writeFile(join(dir, 'later.png'), png(result.later));
      await mkdir(join(dir, 'motion'), { recursive: true });
      for (let i = 0; i < result.motion.length; i++) await writeFile(join(dir, 'motion', `${i.toString().padStart(2, '0')}.png`), png(result.motion[i]));
      const source = isIntricacy(recipe.family) ? 'src/seedbank/intricacy.ts' : isEntropy(recipe.family) ? 'src/seedbank/entropy.ts' : isDamage(recipe.family) ? 'src/seedbank/damage.ts' : isDeparture(recipe.family) ? 'src/seedbank/departures.ts' : isPixelSorter(recipe.family) ? 'src/seedbank/pixel-sorters.ts' : recipe.family === 'broken-lcd' ? 'src/seedbank/broken-lcd.ts' : ['caustics', 'phosphor', 'halftone'].includes(recipe.family) ? 'src/seedbank/effects.ts' : 'src/seedbank/additional-effects.ts';
      const sourceDependencies = recipe.family === 'broken-lcd' || isPixelSorter(recipe.family) || isDeparture(recipe.family) || isDamage(recipe.family) ? { 'src/seedbank/lcd-evolution.ts': createHash('sha256').update(await readFile('src/seedbank/lcd-evolution.ts')).digest('hex') } : {};
      if (isDeparture(recipe.family) || isDamage(recipe.family)) sourceDependencies['src/seedbank/impulse-evolution.ts'] = createHash('sha256').update(await readFile('src/seedbank/impulse-evolution.ts')).digest('hex');
      if (isEntropy(recipe.family)) sourceDependencies['src/seedbank/entropy-evolution.ts'] = createHash('sha256').update(await readFile('src/seedbank/entropy-evolution.ts')).digest('hex');
      if (isIntricacy(recipe.family)) sourceDependencies['src/seedbank/intricacy-evolution.ts'] = createHash('sha256').update(await readFile('src/seedbank/intricacy-evolution.ts')).digest('hex');
      const report = { sourceDependencies, id: recipe.id, recipeSha256: createHash('sha256').update(serializeRecipe(recipe)).digest('hex'), pngSha256: createHash('sha256').update(png(result.frame)).digest('hex'), source, sourceSha256: createHash('sha256').update(await readFile(source)).digest('hex'), runtimeSha256: createHash('sha256').update(await readFile('src/seedbank/renderer.ts')).digest('hex'), review: 'candidate — human aesthetic review pending', technical: result.technical, measurement: result.measurement, motion: { frames: 8, fps: 4, firstTime: recipe.time }, launch: process.env.SEEDBANK_GPU === 'hardware' ? 'default host GPU selection; consult adapter field' : 'SwiftShader software rendering; not physical GPU evidence' };
      await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2));
      item.status = 'complete'; item.report = `${recipe.id}/report.json`; console.log(`Rendered ${recipe.id}: ${result.measurement.backend}, ${result.technical.sampledColors} sampled colors`);
    } catch (error) { item.status = 'failed'; item.error = error.message; failed = true; await writeFile(join(dir, `failure-${item.attempts}.txt`), error.stack || String(error)); console.error(item.recipe.id, error.message); }
    await checkpoint();
  }
  const cards = queue.items.filter(item => item.status === 'complete').map(item => `<article><img src="${item.recipe.id}/frozen.png" alt="${item.recipe.name}"><h2>${item.recipe.name}</h2><p>${item.recipe.family} · seed ${item.recipe.seed} · t=${item.recipe.time}s</p><p>Candidate / technical checks passed / aesthetic review pending</p><a href="${item.recipe.id}/recipe.json">Recipe</a> · <a href="${item.recipe.id}/report.json">Report</a><div class="motion">${Array.from({ length: 8 }, (_, i) => `<img src="${item.recipe.id}/motion/${String(i).padStart(2,'0')}.png" style="--i:${i}" alt="Motion frame ${i}">`).join('')}</div></article>`).join('');
  await writeFile(join(out, 'contact-sheet.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Shader Seedbank / ${backend} contact sheet</title><style>body{background:#f5f3ec;color:#263326;font:14px system-ui;margin:40px}h1{font:44px Georgia}main{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}img{width:100%;display:block}h2{font:24px Georgia}p{font-size:12px}.motion{position:relative;aspect-ratio:1.5}.motion img{position:absolute;inset:0;opacity:0;animation:frame 2s steps(1) infinite;animation-delay:calc(var(--i)*.25s)}@keyframes frame{0%,12.49%{opacity:1}12.5%,100%{opacity:0}}@media(prefers-reduced-motion:reduce){.motion{display:none}}@media(max-width:800px){main{grid-template-columns:1fr}}</style><h1>Shader Seedbank</h1><p>${backend} / frozen studies + 4 fps motion strips / see per-entry environment and timing reports</p><main>${cards}</main></html>`);
  await page.close();
} catch (error) {
  failed = true;
  await writeFile(join(out, 'backend-unavailable.json'), JSON.stringify({ backend, supported: false, checkedAt: new Date().toISOString(), error: error.message, note: 'Failed before recipe evaluation. No successful renders or timings claimed.', browser: await browser.version(), launch: process.env.SEEDBANK_GPU === 'hardware' ? 'default host selection' : 'SwiftShader software' }, null, 2));
  console.error(`${backend} unavailable: ${error.message}`);
} finally { await browser.close(); }
if (failed) process.exitCode = 1;
