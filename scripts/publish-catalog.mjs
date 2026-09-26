import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { presets, deprecatedPresets, isMechanism, isSynthesis, isIntricacy, isDamage, isEntropy, isKit, isPattern, isRaster, isLogic, families, isPixelSorter, isDeparture, GENERATOR_VERSION, serializeRecipe } from '../src/seedbank/recipes.ts';
import { series } from '../src/workbench/series.ts';

// Publish only technically complete evidence that matches the exact recipe and source.
// Existing accepted artifact directories are inputs, never write targets.
// `--sheet-only` rewrites just the /studies contact sheet from the current catalog
// and the previews already in public/, without touching the manifest or recipes.
const sheetOnly = process.argv.includes('--sheet-only');
const evidence = resolve(process.argv[2] || 'artifacts/expansion-01-webgl2');
const originalEvidence = resolve('artifacts/verified-webgl2');
const lcdEvidence = resolve(process.argv[3] || 'artifacts/broken-lcd-19-webgl2');
const sorterEvidence = resolve(process.argv[4] || 'artifacts/pixel-sorters-01-webgl2');
const departureEvidence = resolve(process.argv[5] || 'artifacts/departures-sharp-01-webgl2');
const damageEvidence = resolve(process.argv[6] || 'artifacts/damage-04-webgl2');
const entropyEvidence = resolve(process.argv[7] || 'artifacts/entropy-03-webgl2');
const intricacyEvidence = resolve(process.argv[8] || 'artifacts/intricacy-01-webgl2');
const mechanismEvidence = resolve(process.argv[10] || 'artifacts/mechanism-02-webgl2');
const synthesisEvidence = resolve(process.argv[9] || 'artifacts/synthesis-05-webgl2');
// Studies 61–100 are rendered one series per batch run.
const kitEvidence = family => resolve(isPattern(family) ? 'artifacts/pattern-01-webgl2' : isRaster(family) ? 'artifacts/raster-01-webgl2' : isLogic(family) ? 'artifacts/logic-01-webgl2' : 'artifacts/matter-01-webgl2');
const hash = data => createHash('sha256').update(data).digest('hex');
await mkdir('catalog/recipes', { recursive: true });
await mkdir('public/previews', { recursive: true });
const entries = [];
for (const recipe of sheetOnly ? [] : [...presets, ...deprecatedPresets]) {
  const original = recipe.generatorVersion === '1.0.0';
  const deprecated = deprecatedPresets.some(item => item.family === recipe.family);
  const promoted = presets.slice(0, 10).some(item => item.family === recipe.family);
  const directory = join(isKit(recipe.family) ? kitEvidence(recipe.family) : isMechanism(recipe.family) ? mechanismEvidence : isSynthesis(recipe.family) ? synthesisEvidence : isIntricacy(recipe.family) ? intricacyEvidence : original ? originalEvidence : recipe.family === 'broken-lcd' ? lcdEvidence : isPixelSorter(recipe.family) ? sorterEvidence : isEntropy(recipe.family) ? entropyEvidence : isDamage(recipe.family) ? damageEvidence : isDeparture(recipe.family) ? departureEvidence : evidence, recipe.id);
  const report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'));
  const png = await readFile(join(directory, 'frozen.png'));
  if (!report.technical.frozenRepeatIdentical || report.recipeSha256 !== hash(serializeRecipe(recipe)) || report.pngSha256 !== hash(png)) throw new Error(`Evidence does not match recipe: ${recipe.id}`);
  // The original three retain their historical render evidence. Their
  // pixel output is regression-checked separately after additive changes.
  if (!original && report.sourceSha256 !== hash(await readFile(report.source))) throw new Error(`Shader changed since rendering: ${recipe.id}`);
  for (const [file, expected] of Object.entries(report.sourceDependencies || {})) {
    if (hash(await readFile(file)) !== expected) throw new Error(`Shader dependency changed since rendering: ${file}`);
  }
  await writeFile(`catalog/recipes/${recipe.id}.json`, serializeRecipe(recipe));
  const preview = `public/previews/${recipe.family}.png`;
  let existing;
  try { existing = await readFile(preview); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Preserve unchanged images. Replace changed previews atomically so a live
  // static server never observes and caches a temporarily truncated PNG.
  if (!existing?.equals(png)) { await writeFile(`${preview}.tmp`, png); await rename(`${preview}.tmp`, preview); }
  entries.push({ id: recipe.id, status: deprecated ? 'deprecated' : 'active', featured: promoted, displayNumber: families[recipe.family].number, kind: recipe.kind, name: recipe.name, family: recipe.family, generatorVersion: recipe.generatorVersion,
    recipe: `recipes/${recipe.id}.json`, source: `../${report.source}`, sourceSha256: hash(await readFile(report.source)), evidenceSourceSha256: report.sourceSha256, sourceDependencies: report.sourceDependencies || {},
    preview: `../public/previews/${recipe.family}.png`, runtimeExample: '../examples/consumer/main.ts', tags: recipe.tags,
    review: { status: recipe.review, aestheticApproval: promoted ? 'user endorsed as usable; promoted benchmark, further refinement welcome' : deprecated ? 'archived outside current crisp-pixel direction' : 'pending human review' },
    checks: { webgl2: `../${relative(process.cwd(), directory)}/report.json`, webgpu: isKit(recipe.family) ? '../artifacts/studies-61-90-webgpu/backend-unavailable.json' : isMechanism(recipe.family) ? '../artifacts/mechanism-02-webgpu/backend-unavailable.json' : isSynthesis(recipe.family) ? '../artifacts/synthesis-pilot-01-webgpu/backend-unavailable.json' : isIntricacy(recipe.family) ? '../artifacts/intricacy-01-webgpu/backend-unavailable.json' : isEntropy(recipe.family) ? '../artifacts/entropy-01-webgpu/backend-unavailable.json' : isDamage(recipe.family) ? '../artifacts/damage-01-webgpu/backend-unavailable.json' : isDeparture(recipe.family) ? '../artifacts/departures-sharp-01-webgpu/backend-unavailable.json' : isPixelSorter(recipe.family) ? '../artifacts/pixel-sorters-01-webgpu/backend-unavailable.json' : recipe.family === 'broken-lcd' ? '../artifacts/broken-lcd-19-webgpu/backend-unavailable.json' : original ? '../artifacts/final-webgpu/backend-unavailable.json' : '../artifacts/expansion-webgpu/backend-unavailable.json' }, provenance: '../docs/PROVENANCE.md' });
}
if (!sheetOnly) await writeFile('catalog/manifest.json', JSON.stringify({ schemaVersion: 1, generatorVersion: GENERATOR_VERSION, entries }, null, 2) + '\n');
// A lightweight stills sheet accompanies the per-batch motion/contact sheet.
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const blocks = series.map(group => `<section><h2>${escape(group.name)}<span>${escape(group.note)}</span></h2><div class="grid">${presets.filter(r => group.families.includes(r.family)).map(r => `<a href="/?study=${r.family}"><img src="../previews/${r.family}.png" alt="${escape(families[r.family].name)}" loading="lazy"><b><span>${families[r.family].number}</span>${escape(families[r.family].name)}</b><small>${escape(families[r.family].subtitle)}</small></a>`).join('')}</div></section>`).join('');
await mkdir('public/studies', { recursive: true });
await writeFile('public/studies/index.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shader Seedbank: all ${presets.length} studies</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Doto:wght,ROND@100..900,0..100&family=Geologica:wght@400;600&display=swap"><style>*{box-sizing:border-box}body{margin:0;padding:40px 24px 64px;background:#1b1b1b;color:#ececec;font:14px/1.5 Geologica,system-ui,sans-serif}header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;max-width:1480px;margin:0 auto 12px}h1{margin:0;font:900 clamp(40px,6vw,80px)/.9 Doto,monospace;letter-spacing:1px}header a{color:#ececec;border:1px solid #525252;border-radius:3px;padding:8px 12px;text-decoration:none;white-space:nowrap}p{max-width:1480px;margin:0 auto 32px;color:#a3a3a3}section{max-width:1480px;margin:0 auto 36px}h2{display:flex;align-items:baseline;gap:10px;margin:0 0 12px;font-size:16px;font-weight:600}h2 span{color:#a3a3a3;font-size:13px;font-weight:400}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}.grid a{display:grid;gap:6px;color:inherit;text-decoration:none}img{display:block;width:100%;aspect-ratio:3/2;height:auto;image-rendering:pixelated;outline:1px solid #3a3a3a;outline-offset:-1px;background:#2e2e2e}.grid a:hover img{outline:2px solid #a3a3a3;outline-offset:-2px}b{display:flex;gap:8px;font-size:13px;font-weight:600}b span{color:#7a7a7a;font-weight:400}small{color:#a3a3a3;font-size:12px}@media(max-width:600px){.grid{grid-template-columns:repeat(2,1fr)}}</style><header><h1>${presets.length} studies</h1><a href="/">Open the studio</a></header><p>Every active study at its frozen moment, grouped by series. Each opens in the studio with its own recipe. Rendered with WebGL2 in software; stills can differ slightly across devices. Earlier soft-edged experiments are in the studio’s Archive.</p>${blocks}</html>`);
console.log(sheetOnly ? `Rewrote the /studies/index.html contact sheet for ${presets.length} studies.` : `Published ${entries.length} catalog recipes, verified previews, and /studies/index.html contact sheet.`);
