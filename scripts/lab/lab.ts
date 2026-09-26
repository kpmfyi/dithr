import { createSeedbank } from '../../src/seedbank/renderer';
import { allPresets, GENERATOR_VERSION, validateRecipe, patternFamilies, rasterFamilies, matterFamilies, logicFamilies, type Recipe } from '../../src/seedbank/recipes';
/** Lab hook: render any recipe at explicit times and return PNG data URLs. */
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const status = document.querySelector('#status')!;
const runtime = await createSeedbank(canvas, allPresets.at(-1)!, 'webgl2');
status.textContent = 'ready';
async function render(input: Partial<Recipe> & { family: Recipe['family'] }, width = 480, height = 320, times: number[] = [3.25]) {
  const base = allPresets.find(r => r.family === input.family)!;
  const recipe = validateRecipe({ ...base, ...input, generatorVersion: input.palette && input.palette.length !== 3 ? GENERATOR_VERSION : base.generatorVersion, parameters: { ...base.parameters, ...input.parameters } });
  runtime.setRecipe(recipe);
  runtime.resize(width, height);
  const out: string[] = [];
  for (const t of times) { runtime.render(t); out.push(canvas.toDataURL('image/png')); }
  return out;
}
async function timing(family: Recipe['family'], width = 960, height = 640, frames = 60) {
  const base = allPresets.find(r => r.family === family)!;
  runtime.setRecipe(base); runtime.resize(width, height); runtime.render(base.time);
  const start = performance.now();
  for (let i = 1; i <= frames; i++) runtime.render(base.time + i / 60);
  (runtime as unknown as { environment(): unknown }).environment();
  return (performance.now() - start) / frames;
}
/** Mean absolute RGB change between consecutive frames around the epoch handoff
 * at simulation frame 256·k (k = 1 and a late epoch). The boundary step should
 * look like its neighbours, not like a reset. */
async function handoff(family: Recipe['family'], width = 480, height = 320) {
  const base = allPresets.find(r => r.family === family)!;
  const recipe = validateRecipe({ ...base, parameters: { ...base.parameters, speed: 1 } });
  runtime.setRecipe(recipe); runtime.resize(width, height);
  const gl = document.createElement('canvas'); gl.width = width; gl.height = height;
  const ctx = gl.getContext('2d', { willReadFrequently: true })!;
  const grab = (frame: number) => { runtime.render(frame / 60); ctx.drawImage(canvas, 0, 0); return ctx.getImageData(0, 0, width, height).data; };
  const report: Record<string, number[]> = {};
  for (const boundary of [256, 256 * 4096]) {
    const diffs: number[] = [];
    let previous = grab(boundary - 6);
    for (let f = boundary - 5; f <= boundary + 5; f++) {
      const next = grab(f); let sum = 0;
      for (let i = 0; i < next.length; i += 4) sum += Math.abs(next[i] - previous[i]) + Math.abs(next[i + 1] - previous[i + 1]) + Math.abs(next[i + 2] - previous[i + 2]);
      diffs.push(+(sum / (width * height * 3)).toFixed(2)); previous = next;
    }
    report[`boundary ${boundary} (index 5 is the handoff)`] = diffs;
  }
  return report;
}
Object.assign(window, { lab: { render, timing, handoff, families: [...patternFamilies, ...rasterFamilies, ...matterFamilies, ...logicFamilies], ready: true } });
