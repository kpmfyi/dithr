import { createSeedbank, advanceTime, presets, allPresets, type Backend } from '../../src/seedbank/index';
const params = new URLSearchParams(location.search);
const backend = (params.get('backend') || 'auto') as Backend;
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const status = document.querySelector<HTMLElement>('#status')!;
const frozen = params.has('frozen') || matchMedia('(prefers-reduced-motion: reduce)').matches;
try {
  const runtime = await createSeedbank(canvas, presets[0], backend);
  let selected = presets[0], time = selected.time, raf = 0, playing = !frozen;
  for (const recipe of presets) {
    const button = document.createElement('button'); button.textContent = recipe.family;
    button.onclick = () => { selected = recipe; time = recipe.time; runtime.setRecipe(recipe); runtime.render(time); status.textContent = `${recipe.name} / ${runtime.backend}`; };
    document.querySelector('#controls')!.append(button);
  }
  const pause = document.createElement('button'); pause.textContent = playing ? 'Pause' : 'Play';
  pause.onclick = () => { playing = !playing; pause.textContent = playing ? 'Pause' : 'Play'; };
  document.querySelector('#controls')!.append(pause);
  let last = performance.now();
  const tick = (now: number) => { if (playing && !document.hidden) { time = advanceTime(selected.family, time, Math.min((now - last) / 1000, .05)); runtime.render(time); } last = now; raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  status.textContent = `${selected.name} / ${runtime.backend}`;
  document.querySelector('#environment')!.textContent = JSON.stringify(runtime.environment(), null, 2);
  // Documented integration hook for the bounded renderer and consumer smoke test.
  Object.assign(window, { seedbank: { runtime, presets, allPresets, setPlaying: (value: boolean) => { playing = value; } } });
  addEventListener('pagehide', () => { cancelAnimationFrame(raf); runtime.dispose(); }, { once: true });
} catch (error) { status.textContent = `Render unavailable: ${(error as Error).message}`; Object.assign(window, { seedbankError: (error as Error).message }); }
