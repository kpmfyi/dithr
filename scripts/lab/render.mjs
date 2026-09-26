// Usage: node scripts/lab/render.mjs <family> [outDir] [--times=3.25,3.3,20,75] [--size=480x320] [--palettes] [--params=scale:3,detail:.2]
// Renders frames of one family through the lab page (port 5189) and writes PNGs plus a contact sheet.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const [family, outDir = `artifacts/lab/${process.argv[2]}`] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flag = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const times = flag('times', '3.25,3.3,12,40,75').split(',').map(Number);
const [width, height] = flag('size', '480x320').split('x').map(Number);
const params = Object.fromEntries((flag('params', '') || '').split(',').filter(Boolean).map(kv => { const [k, v] = kv.split(':'); return [k, Number(v)]; }));
const seed = flag('seed', '') ? Number(flag('seed', '')) : undefined;
// Palette probes: light ground, dark ground, mid ground, muted, two and three colors.
const probes = {
  base: undefined,
  paper: ['#f2eee3', '#e4572e', '#17202a', '#3d6fb6', '#f2c14e'],
  night: ['#0c0f1c', '#ff4f8b', '#e8f1ff', '#3b3f8f', '#46e0c8'],
  field: ['#3c6e71', '#f4d35e', '#fbf6ea', '#1d2d3a', '#ee964b'],
  muted: ['#e4e0d6', '#9aa58f', '#2f3a33', '#b5876b', '#6f7d8c'],
  duo: ['#101a2c', '#ff7a45'],
  trio: ['#f5f0e6', '#0057ff', '#101010'],
};
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:5189/', { waitUntil: 'load' });
await page.waitForFunction(() => window.lab?.ready || document.querySelector('#status')?.textContent !== 'loading', null, { timeout: 120000 });
const files = [];
const save = async (name, url) => { const file = `${outDir}/${name}.png`; await writeFile(file, Buffer.from(url.split(',')[1], 'base64')); files.push(file); };
const input = { family, parameters: params, ...(seed !== undefined ? { seed } : {}) };
const frames = await page.evaluate(([input, w, h, t]) => window.lab.render(input, w, h, t), [input, width, height, times]);
for (let i = 0; i < frames.length; i++) await save(`t${times[i]}`, frames[i]);
if (process.argv.includes('--palettes')) for (const [name, palette] of Object.entries(probes)) {
  if (!palette) continue;
  const [url] = await page.evaluate(([input, w, h]) => window.lab.render(input, w, h, [20]), [{ ...input, palette }, width, height]);
  await save(`palette-${name}`, url);
}
if (process.argv.includes('--params-sweep')) for (const [key, values] of Object.entries({ scale: [1.5, 6], detail: [0, 1], intensity: [.3, 1.9] })) for (const v of values) {
  const [url] = await page.evaluate(([input, w, h]) => window.lab.render(input, w, h, [20]), [{ ...input, parameters: { ...params, [key]: v } }, width, height]);
  await save(`param-${key}-${v}`, url);
}
if (process.argv.includes('--handoff')) console.log('handoff diffs', JSON.stringify(await page.evaluate(f => window.lab.handoff(f), family)));
if (process.argv.includes('--timing')) console.log('ms/frame(960x640, software)', await page.evaluate(f => window.lab.timing(f), family));
await browser.close();
execFileSync('montage', [...files, '-tile', '4x', '-geometry', `${width}x${height}+3+3`, '-background', '#222', '-title', family, `${outDir}/sheet.png`]);
console.log(JSON.stringify({ outDir, sheet: `${outDir}/sheet.png`, errors: errors.slice(0, 5) }));
