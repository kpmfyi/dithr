import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { presets, deprecatedPresets, isIntricacy, isDamage, isEntropy, families, isPixelSorter, isDeparture, GENERATOR_VERSION, serializeRecipe } from '../src/seedbank/recipes.ts';

// Publish only technically complete evidence that matches the exact recipe and source.
// Existing accepted artifact directories are inputs, never write targets.
const evidence = resolve(process.argv[2] || 'artifacts/expansion-01-webgl2');
const originalEvidence = resolve('artifacts/verified-webgl2');
const lcdEvidence = resolve(process.argv[3] || 'artifacts/broken-lcd-19-webgl2');
const sorterEvidence = resolve(process.argv[4] || 'artifacts/pixel-sorters-01-webgl2');
const departureEvidence = resolve(process.argv[5] || 'artifacts/departures-sharp-01-webgl2');
const damageEvidence = resolve(process.argv[6] || 'artifacts/damage-04-webgl2');
const entropyEvidence = resolve(process.argv[7] || 'artifacts/entropy-03-webgl2');
const intricacyEvidence = resolve(process.argv[8] || 'artifacts/intricacy-01-webgl2');
const hash = data => createHash('sha256').update(data).digest('hex');
await mkdir('catalog/recipes', { recursive: true });
await mkdir('public/previews', { recursive: true });
const entries = [];
for (const recipe of [...presets, ...deprecatedPresets]) {
  const original = recipe.generatorVersion === '1.0.0';
  const deprecated = deprecatedPresets.some(item => item.family === recipe.family);
  const promoted = presets.slice(0, 10).some(item => item.family === recipe.family);
  const directory = join(isIntricacy(recipe.family) ? intricacyEvidence : original ? originalEvidence : recipe.family === 'broken-lcd' ? lcdEvidence : isPixelSorter(recipe.family) ? sorterEvidence : isEntropy(recipe.family) ? entropyEvidence : isDamage(recipe.family) ? damageEvidence : isDeparture(recipe.family) ? departureEvidence : evidence, recipe.id);
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
  await cp(join(directory, 'frozen.png'), `public/previews/${recipe.family}.png`);
  entries.push({ id: recipe.id, status: deprecated ? 'deprecated' : 'active', featured: promoted, displayNumber: families[recipe.family].number, kind: recipe.kind, name: recipe.name, family: recipe.family, generatorVersion: recipe.generatorVersion,
    recipe: `recipes/${recipe.id}.json`, source: `../${report.source}`, sourceSha256: hash(await readFile(report.source)), evidenceSourceSha256: report.sourceSha256, sourceDependencies: report.sourceDependencies || {},
    preview: `../public/previews/${recipe.family}.png`, runtimeExample: '../examples/consumer/main.ts', tags: recipe.tags,
    review: { status: recipe.review, aestheticApproval: promoted ? 'user endorsed as usable; promoted benchmark, further refinement welcome' : deprecated ? 'archived outside current crisp-pixel direction' : 'pending human review' },
    checks: { webgl2: `../${relative(process.cwd(), directory)}/report.json`, webgpu: isIntricacy(recipe.family) ? '../artifacts/intricacy-01-webgpu/backend-unavailable.json' : isEntropy(recipe.family) ? '../artifacts/entropy-01-webgpu/backend-unavailable.json' : isDamage(recipe.family) ? '../artifacts/damage-01-webgpu/backend-unavailable.json' : isDeparture(recipe.family) ? '../artifacts/departures-sharp-01-webgpu/backend-unavailable.json' : isPixelSorter(recipe.family) ? '../artifacts/pixel-sorters-01-webgpu/backend-unavailable.json' : recipe.family === 'broken-lcd' ? '../artifacts/broken-lcd-19-webgpu/backend-unavailable.json' : original ? '../artifacts/final-webgpu/backend-unavailable.json' : '../artifacts/expansion-webgpu/backend-unavailable.json' }, provenance: '../docs/PROVENANCE.md' });
}
await writeFile('catalog/manifest.json', JSON.stringify({ schemaVersion: 1, generatorVersion: GENERATOR_VERSION, entries }, null, 2) + '\n');
// A lightweight stills sheet accompanies the per-batch motion/contact sheet.
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const cards = presets.map(r => `<figure><img src="../previews/${r.family}.png" alt="${escape(families[r.family].name)}"><figcaption><b>${families[r.family].number} / ${escape(families[r.family].name)}</b><span>${escape(r.name)} · seed ${r.seed}</span></figcaption></figure>`).join('');
await mkdir('public/studies', { recursive: true });
await writeFile('public/studies/index.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shader Seedbank / ${presets.length} studies</title><style>*{box-sizing:border-box}body{margin:0;padding:4vw;background:#f5f3ec;color:#273c33;font:14px system-ui}header{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid #ccd2c5;padding-bottom:20px}h1{font:42px Georgia;margin:0}a{color:inherit}p{color:#6a7868;line-height:1.7}main{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}figure{margin:0;border:1px solid #d5dacd;background:#fafaf3}img{display:block;width:100%;aspect-ratio:1.5;image-rendering:pixelated}figcaption{padding:13px}figcaption b{font-size:13px;font-weight:500}figcaption span{display:block;color:#73806d;font-size:11px;margin-top:6px}@media(max-width:800px){main{grid-template-columns:repeat(2,1fr)}h1{font-size:28px}}@media(max-width:480px){main{grid-template-columns:1fr}}</style><header><h1>Shader Seedbank</h1><a href="/">Open the viewer ↗</a></header><p>${presets.length} sharp-pixel studies / ten foundational studies, ten damage studies, ten entropy studies, ten intricacy studies / frozen at 3.25 seconds<br>Rendered with WebGL2 in software. Physical GPU performance and WebGPU output remain unverified. Earlier soft studies are deprecated and available in the viewer’s Archive.</p><main>${cards}</main></html>`);
console.log(`Published ${entries.length} catalog recipes, verified previews, and /studies/index.html contact sheet.`);
