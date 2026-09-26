import { serializeRecipe, validateRecipe, type Backend, type Recipe } from '../seedbank/recipes.ts';

export type OutputSettings = { width: number; height: number; animate: boolean; backend: Backend };
export function validateOutput(value: OutputSettings): OutputSettings {
  if (![value.width, value.height].every(n => Number.isInteger(n) && n >= 16 && n <= 2048)) throw new Error('Output dimensions must be whole pixels from 16 to 2048.');
  if (typeof value.animate !== 'boolean' || !['auto', 'webgl2', 'webgpu'].includes(value.backend)) throw new Error('Invalid playback or renderer setting.');
  return { width: value.width, height: value.height, animate: value.animate, backend: value.backend };
}

/** Generated JS uses a local bundled runtime; it never depends on this viewer or a CDN. */
export function integrationCode(input: Recipe, settings: OutputSettings) {
  const recipe = validateRecipe(input), output = validateOutput(settings);
  return `import { createSeedbank, advanceTime } from './seedbank.js';

const recipe = ${serializeRecipe(recipe).trim()};
const canvas = document.querySelector('#shader');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const study = await createSeedbank(canvas, recipe, ${JSON.stringify(output.backend)});
study.resize(${output.width}, ${output.height});
study.render(recipe.time);

let time = recipe.time;
let playing = ${output.animate} && !reducedMotion.matches;
let previous = performance.now();
let request = 0;
function frame(now) {
  if (playing && !document.hidden) {
    time = advanceTime(recipe.family, time, Math.min((now - previous) / 1000, 0.05));
    study.render(time);
  }
  previous = now;
  request = requestAnimationFrame(frame);
}
request = requestAnimationFrame(frame);

// Optional example controls. The renderer has no dependency on these controls or React.
const play = document.querySelector('#play');
function updateLabel() { if (play) play.textContent = playing ? 'Pause' : 'Play'; }
function toggle() { playing = !playing; previous = performance.now(); updateLabel(); }
function motionChanged() { if (reducedMotion.matches) { playing = false; updateLabel(); } }
play?.addEventListener('click', toggle);
reducedMotion.addEventListener('change', motionChanged);
updateLabel();
export function seek(seconds) { study.render(seconds); time = seconds; }
export function dispose() {
  cancelAnimationFrame(request);
  play?.removeEventListener('click', toggle);
  reducedMotion.removeEventListener('change', motionChanged);
  study.dispose();
}
window.addEventListener('pagehide', dispose, { once: true });
export { study, recipe };
`;
}

export function exampleHtml(settings: OutputSettings) {
  const { width, height } = validateOutput(settings);
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dithr export</title>
<style>body{margin:0;background:#151b19;color:#f5f3ec;font:14px system-ui;display:grid;place-items:center;min-height:100svh}main{width:min(100%,${width}px)}canvas{display:block;width:100%;height:auto;aspect-ratio:${width}/${height};image-rendering:pixelated}button{margin:16px 0;padding:10px 24px;cursor:pointer}#error{white-space:pre-wrap}</style>
<main><canvas id="shader" width="${width}" height="${height}" aria-label="Animated shader"></canvas><button id="play">Play</button><p id="error" role="alert"></p></main>
<script type="module">import('./main.js').catch(error=>{document.querySelector('#error').textContent='Could not start shader: '+error.message;});</script></html>
`;
}

export function typescriptCode(recipe: Recipe, settings: OutputSettings) {
  return integrationCode(recipe,settings)
    .replace("import { createSeedbank, advanceTime } from './seedbank.js';", "import { createSeedbank, advanceTime, type Recipe } from './src/seedbank';")
    .replace('const recipe = ', 'const recipe: Recipe = ')
    .replace("document.querySelector('#shader')", "document.querySelector<HTMLCanvasElement>('#shader')!")
    .replace('function frame(now)', 'function frame(now: number)')
    .replace('function seek(seconds)', 'function seek(seconds: number)');
}

export function reactCode(input: Recipe, settings: OutputSettings) {
  const recipe=validateRecipe(input),o=validateOutput(settings);
  return `'use client';
import { useEffect, useRef, useState } from 'react';
import { createSeedbank, advanceTime, type Recipe } from './src/seedbank';

const recipe: Recipe = ${serializeRecipe(recipe).trim()};

export default function Shader({ animate = ${o.animate} }: { animate?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false, request = 0;
    let study: Awaited<ReturnType<typeof createSeedbank>> | undefined;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    // A fresh element also supports React Strict Mode's setup/cleanup cycle.
    const target = host.current!;
    const ownedCanvas = document.createElement('canvas');
    ownedCanvas.style.cssText = 'display:block;width:100%;height:auto;aspect-ratio:${o.width}/${o.height};image-rendering:pixelated';
    ownedCanvas.setAttribute('aria-label', 'Animated shader');
    target.appendChild(ownedCanvas);
    createSeedbank(ownedCanvas, recipe, ${JSON.stringify(o.backend)}).then(instance => {
      if (cancelled) { instance.dispose(); return; }
      study = instance;
      instance.resize(${o.width}, ${o.height});
      instance.render(recipe.time);
      setError('');
      let time = recipe.time, previous = performance.now();
      function tick(now: number) {
        if (animate && !reducedMotion.matches && !document.hidden) {
          time = advanceTime(recipe.family, time, Math.min((now - previous) / 1000, 0.05));
          instance.render(time);
        }
        previous = now;
        request = requestAnimationFrame(tick);
      }
      request = requestAnimationFrame(tick);
    }).catch(e => { if (!cancelled) setError(String(e.message || e)); });
    return () => { cancelled = true; cancelAnimationFrame(request); study?.dispose(); ownedCanvas.remove(); };
  }, [animate]);
  return <div>
    <div ref={host} />
    {error && <p role="alert">{error}</p>}
  </div>;
}
`;
}

export function exportReadme(recipe: Recipe, settings: OutputSettings) {
  const o = validateOutput(settings);
  return `# ${validateRecipe(recipe).name}\n\nGenerated from Shader Seedbank.\n\n## Run\n\nServe this folder over HTTP, for example with Python 3: python3 -m http.server 8080\nOpen http://localhost:8080. Opening index.html directly as a file will not load ES modules. No network dependency or package installation is needed once downloaded.\n\n## Contents\n\n- index.html + main.js: runnable example and your exact validated recipe.\n- Shader.tsx: React component with cleanup and reduced-motion support.\n- integration.ts: typed Three.js integration.\n- seedbank.js: bundled ES module, including Three.js 0.185.1.\n- recipe.json: importable recipe for the workbench.\n- output.json: ${o.width} × ${o.height}, ${o.backend} renderer, autoplay ${o.animate}.\n- src/seedbank/: editable TypeScript sources for the portable runtime and shader graphs. Copy alongside Shader.tsx or integration.ts in a TypeScript/bundler project; install three@0.185.1 and @types/three@0.185.0. React example also requires React and its types.\n- THIRD_PARTY_LICENSES.txt: bundled Three.js license.\n\nThe renderer owns GPU resources; your application owns animation scheduling. Use study.setRecipe(), study.resize(), study.render(seconds), study.capture(), and study.dispose(). The included example respects reduced motion and hidden tabs, and exposes cleanup. Call dispose when removing it in a single-page app. Output dimensions are fixed to preserve the exported composition; CSS scales the canvas with nearest-pixel presentation.\n\nThis uses multipass feedback shaders. A single fragment shader would not reproduce the effect; retain the runtime, history buffers and time scheduler. Cross-device pixel equality is not guaranteed. The project code's license has not yet been selected; dependency licenses are included separately.\n`;
}

/** Small uncompressed ZIP writer. Fixed metadata avoids leaking device paths/timestamps. */
export function createZip(files: { name: string; data: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder(), chunks: Uint8Array[] = [], directory: Uint8Array[] = [];
  const names = new Set<string>(); let offset = 0;
  for (const file of files) {
    if (!/^[a-zA-Z0-9_.\-/]+$/.test(file.name) || file.name.startsWith('/') || file.name.split('/').some(p => p === '..' || p === '.' || !p) || names.has(file.name)) throw new Error('Invalid archive filename.');
    names.add(file.name);
    const name = encoder.encode(file.name); let crc = 0xffffffff;
    for (const byte of file.data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true); h.setUint16(4,20,true); h.setUint16(12,33,true);
    h.setUint32(14,crc,true); h.setUint32(18,file.data.length,true); h.setUint32(22,file.data.length,true); h.setUint16(26,name.length,true); header.set(name,30);
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(14,33,true);
    c.setUint32(16,crc,true); c.setUint32(20,file.data.length,true); c.setUint32(24,file.data.length,true); c.setUint16(28,name.length,true); c.setUint32(42,offset,true); central.set(name,46);
    chunks.push(header,file.data); directory.push(central); offset += header.length + file.data.length;
  }
  const size = directory.reduce((sum,part)=>sum+part.length,0), end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true); e.setUint16(8,files.length,true); e.setUint16(10,files.length,true); e.setUint32(12,size,true); e.setUint32(16,offset,true);
  const result = new Uint8Array(offset+size+22); let position=0;
  for (const part of [...chunks,...directory,end]) { result.set(part,position); position+=part.length; }
  return result;
}
