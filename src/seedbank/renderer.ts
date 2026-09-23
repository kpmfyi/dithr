import { Mesh, OrthographicCamera, PlaneGeometry, Scene, SRGBColorSpace, NoToneMapping } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { probeWebGPU } from './capabilities';
import { createEffect } from './effects';
import { timeLimit, validateRecipe, type Backend, type Recipe } from './recipes';

export type Runtime = Awaited<ReturnType<typeof createSeedbank>>;
export async function createSeedbank(canvas: HTMLCanvasElement, input: Recipe, backend: Backend = 'auto') {
  let recipe = validateRecipe(input);
  if (!['auto', 'webgpu', 'webgl2'].includes(backend)) throw new Error('Unknown renderer backend.');
  const capability = backend === 'webgl2' ? null : await probeWebGPU();
  if (backend === 'webgpu' && !capability?.supported) throw new Error(capability?.reason || 'WebGPU is unavailable.');
  const fallbackReason = backend === 'auto' && !capability?.supported ? capability?.reason : undefined;
  const renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false, forceWebGL: backend === 'webgl2' || !!fallbackReason });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setPixelRatio(1);
  let effect = createEffect(recipe);
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;
  const geometry = new PlaneGeometry(2, 2);
  const mesh = new Mesh(geometry, effect.material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  try {
    await renderer.init();
    const actual = (renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
    if (backend === 'webgpu' && actual !== 'webgpu') throw new Error('WebGPU is unavailable on this browser. Choose WebGL2 or Auto.');
  } catch (error) {
    effect.feedback?.dispose(); effect.material.dispose(); geometry.dispose(); renderer.dispose(); throw error;
  }
  const actualBackend = (renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  let disposed = false;
  const alive = () => { if (disposed) throw new Error('Renderer has been disposed.'); };
  const runtime = {
    backend: actualBackend, fallbackReason,
    get recipe() { return validateRecipe(recipe); },
    setRecipe(input: Recipe) {
      alive();
      const next = validateRecipe(input);
      if (next.family !== recipe.family) {
        const old = effect;
        effect = createEffect(next);
        effect.uniforms.aspect.value = canvas.width / canvas.height;
        mesh.material = effect.material;
        effect.feedback?.resize(canvas.width, canvas.height);
        old.feedback?.dispose(); old.material.dispose();
      } else effect.update(next);
      recipe = next;
    },
    resize(width: number, height: number) {
      alive();
      if (![width, height].every(n => Number.isInteger(n) && n >= 1 && n <= 2048)) throw new Error('Render size must be 1–2048 pixels per side.');
      renderer.setSize(width, height, false);
      effect.uniforms.aspect.value = width / height;
      effect.feedback?.resize(width, height);
    },
    render(time: number) {
      alive();
      if (!Number.isFinite(time) || time < 0 || time > timeLimit(recipe.family)) throw new Error(`Time must be between 0 and ${timeLimit(recipe.family)} seconds.`);
      effect.uniforms.time.value = time;
      effect.feedback?.advance(renderer, time);
      renderer.render(scene, camera);
    },
    async compile() { alive(); await effect.feedback?.compile(renderer); await renderer.compileAsync(scene, camera); },
    async capture(time = recipe.time) {
      runtime.render(time);
      return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
    },
    async measure(samples = 60) {
      alive();
      if (!Number.isInteger(samples) || samples < 10 || samples > 240) throw new Error('Measurement requires 10–240 frames.');
      const timings: number[] = [];
      for (let i = 0; i < samples + 10; i++) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const start = performance.now(); runtime.render(Math.min(timeLimit(recipe.family), recipe.time + i / 60));
        if (i >= 10) timings.push(performance.now() - start);
      }
      timings.sort((a, b) => a - b);
      runtime.render(recipe.time);
      return { ...runtime.environment(), samples, warmupFrames: 10, metric: 'CPU render submission (not GPU execution or FPS)', medianMs: timings[Math.floor(samples / 2)], p95Ms: timings[Math.floor(samples * 0.95)], measuredAt: new Date().toISOString() };
    },
    environment() {
      const native = renderer.backend as unknown as { gl?: WebGL2RenderingContext; device?: { adapterInfo?: { vendor: string; architecture: string; device: string; description: string } } };
      const gl = native.gl;
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      const info = native.device?.adapterInfo;
      return { ...effect.feedback?.environment(), backend: actualBackend, fallbackReason, browser: navigator.userAgent, width: canvas.width, height: canvas.height, pixelRatio: 1, adapter: gl ? (ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))) : info ? `${info.vendor} ${info.architecture} ${info.device} ${info.description}`.trim() : 'not exposed' };
    },
    dispose() { if (disposed) return; disposed = true; effect.feedback?.dispose(); effect.material.dispose(); geometry.dispose(); renderer.dispose(); },
  };
  try {
    runtime.resize(960, 640);
    await runtime.compile();
    runtime.render(recipe.time);
  } catch (error) { runtime.dispose(); throw error; }
  return runtime;
}
