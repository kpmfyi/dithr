'use client';
import { useEffect, useRef, useState } from 'react';
import { advanceTime, isCrisp } from '../../src/seedbank/recipes';
import type { Runtime } from '../../src/seedbank/renderer';
import type { UsageDemo } from '../../src/demos/catalog';

export type SurfaceReport = { ready: boolean; backend?: string; width?: number; height?: number; error?: string };

export function ShaderSurface({ demo, playing, reset, onReport }: {
  demo: UsageDemo; playing: boolean; reset: number; onReport: (report: SurfaceReport) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const clock = useRef(demo.recipe.time);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    let stopped = false;
    let owned: Runtime | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let fallbackReason: string | undefined;
    const target = canvas.current!;
    const container = frame.current!;
    const visibility = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    visibility.observe(container);
    onReport({ ready: false });
    Promise.all([import('../../src/seedbank/renderer'), import('../../src/seedbank/capabilities')]).then(async ([{ createSeedbank }, { probeWebGPU }]) => {
      const capability = await probeWebGPU();
      if (stopped) return null;
      fallbackReason = capability.supported ? undefined : capability.reason;
      // Reserve a WebGL context only after ruling out WebGPU. Three's fallback
      // backend assumes getContext succeeds and otherwise rejects internally.
      if (!capability.supported && !target.getContext('webgl2', { antialias: false, alpha: true, depth: true, stencil: false })) {
        throw new Error('This browser has no usable WebGPU or WebGL2 context.');
      }
      return createSeedbank(target, demo.recipe, capability.supported ? 'webgpu' : 'webgl2');
    }).then(instance => {
      if (!instance) return;
      owned = instance;
      if (stopped) { instance.dispose(); return; }
      runtime.current = instance;
      const resize = () => {
        // CSS transforms (the tilted card, book, fabric, and tabletop) must not
        // change the shader's aspect ratio or its untransformed buffer size.
        const { clientWidth: width, clientHeight: height } = container;
        const ratio = Math.min(devicePixelRatio || 1, 1.5, 1200 / Math.max(width, height));
        instance.resize(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)));
        instance.render(clock.current);
        target.dataset.environment = JSON.stringify({ ...instance.environment(), fallbackReason });
        target.dataset.time = String(clock.current);
        onReport({ ready: true, backend: instance.backend, width: target.width, height: target.height });
      };
      resize();
      resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
      setReady(true);
    }).catch(error => { if (!stopped) onReport({ ready: false, error: String(error.message || error) }); });
    return () => {
      stopped = true; visibility.disconnect(); resizeObserver?.disconnect();
      if (runtime.current === owned) runtime.current = null;
      owned?.dispose();
    };
  }, [demo, onReport]);

  useEffect(() => {
    clock.current = demo.recipe.time;
    runtime.current?.render(clock.current);
    if (canvas.current) canvas.current.dataset.time = String(clock.current);
  }, [reset, demo]);

  useEffect(() => {
    if (!ready || !playing || !inView) return;
    let request = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      clock.current = advanceTime(demo.family, clock.current, Math.min((now - previous) / 1000, 0.05));
      previous = now;
      try {
        runtime.current?.render(clock.current);
        if (canvas.current) canvas.current.dataset.time = String(clock.current);
      } catch (error) {
        setReady(false); onReport({ ready: false, error: (error as Error).message }); return;
      }
      request = requestAnimationFrame(tick);
    };
    const visibilityChanged = () => {
      cancelAnimationFrame(request);
      if (!document.hidden) { previous = performance.now(); request = requestAnimationFrame(tick); }
    };
    visibilityChanged(); document.addEventListener('visibilitychange', visibilityChanged);
    return () => { cancelAnimationFrame(request); document.removeEventListener('visibilitychange', visibilityChanged); };
  }, [ready, playing, inView, onReport]);

  return <div ref={frame} className="shader-surface" data-ready={ready}>
    <img src={`/demo-textures/${demo.family}.png`} alt="" className="shader-fallback" style={{ imageRendering: isCrisp(demo.family) ? 'pixelated' : undefined }}/>
    <canvas ref={canvas} aria-label={`${demo.title} shader surface`} style={{ opacity: ready ? 1 : 0, imageRendering: isCrisp(demo.family) ? 'pixelated' : undefined }}/>
  </div>;
}
