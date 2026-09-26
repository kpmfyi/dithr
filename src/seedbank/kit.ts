import { HalfFloatType, NearestFilter, NoColorSpace, RenderTarget, Vector2, Vector4 } from 'three';
import { MeshBasicNodeMaterial, QuadMesh, type Node, type WebGPURenderer } from 'three/webgpu';
import { Fn, hash as pixelHash, uint, abs, cos, float, floor, fract, max, mix, sin, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { createKitEvolution, type Controls, type KitScore } from './kit-evolution';

export type Scalar = Node<'float'>;
export type Point = Node<'vec2'>;
export type Quad = Node<'vec4'>;
export type Color = Node<'vec3'>;
type ScalarUniform = ReturnType<typeof uniform<'float'>>;
type QuadUniform = ReturnType<typeof uniform<'vec4'>>;
type PointUniform = ReturnType<typeof uniform<'vec2'>>;
export type KitInputs = {
  seed: ScalarUniform; scale: ScalarUniform; speed: ScalarUniform;
  intensity: ScalarUniform; detail: ScalarUniform; aspect: ScalarUniform;
  colors: ReturnType<typeof uniform<'vec3'>>[];
};

export function hash(p: Point): Scalar {
  return fract(sin(p.dot(vec2(127.1, 311.7))).mul(43758.5453));
}
export function noise(p: Point): Scalar {
  const cell = floor(p), f = fract(p);
  const eased = f.mul(f).mul(vec2(3).sub(f.mul(2)));
  return mix(mix(hash(cell), hash(cell.add(vec2(1, 0))), eased.x),
    mix(hash(cell.add(vec2(0, 1))), hash(cell.add(vec2(1, 1))), eased.x), eased.y);
}
/** Two octaves of value noise, still cheap enough to call several times per pixel. */
export const fbm = (p: Point): Scalar => noise(p).mul(.64).add(noise(p.mul(2.13).add(vec2(17.3, 9.1))).mul(.36));
export const equal = (a: Scalar, b: Scalar | number) => float(1).sub(step(.5, abs(a.sub(b))));
export const pick4 = (index: Scalar, value: Quad) => mix(mix(value.x, value.y, step(.5, index)), mix(value.z, value.w, step(2.5, index)), step(1.5, index));
/** Stationary integer hash for integer pixel coordinates plus a salt. */
export const cellHash = (p: Point, salt: Scalar | number = 0) => pixelHash(uint(p.x).add(uint(p.y).mul(65537)).add(typeof salt === 'number' ? uint(salt) : uint(salt)));
/** Ordered-dither thresholds in [0, 1): 2×2, 4×4 or 8×8 Bayer matrices. */
export function bayer(p: Point, size: 2 | 4 | 8 = 4): Scalar {
  const b2 = (a: Point) => { const c = floor(a); return fract(c.x.div(2).add(c.y.mul(c.y).mul(.75))); };
  const b4 = (a: Point) => b2(a.mul(.5)).mul(.25).add(b2(a));
  return size === 2 ? b2(p) : size === 4 ? b4(p) : b4(p.mul(.5)).mul(.25).add(b2(p));
}
export const rotate = (p: Point, angle: Scalar | number) => {
  const a = typeof angle === 'number' ? float(angle) : angle;
  return vec2(p.x.mul(cos(a)).sub(p.y.mul(sin(a))), p.x.mul(sin(a)).add(p.y.mul(cos(a))));
};
/** Triangle wave in [0, 1]: crisp bands when thresholded. */
export const tri = (x: Scalar) => abs(fract(x).sub(.5)).mul(2);

/** Palette roles in tonal-ramp order (ground, body, accent, ink, trace) for the active count. */
export function ramp(role: (index: 0 | 1 | 2 | 3 | 4) => Color, count: number): Color[] {
  const order = count >= 5 ? [0, 3, 1, 2, 4] : count === 4 ? [0, 3, 1, 2] : count === 3 ? [0, 1, 2] : [0, 1];
  return order.map(i => role(i as 0 | 1 | 2 | 3 | 4));
}
/** Selects colors[floor(index)] with hard steps; index is clamped to the list. */
export function choose(index: Scalar, colors: Color[]): Color {
  return colors.slice(1).reduce((color: Color, next, i) => mix(color, next, step(i + .5, index)), colors[0]);
}
/** Maps t in [0, 1] onto a list of flat colors with dithered, stationary boundaries. */
export function steps(t: Scalar, colors: Color[], threshold: Scalar, spread = .8): Color {
  const index = t.mul(colors.length).add(threshold.sub(.5).mul(spread)).floor().clamp(0, colors.length - 1);
  return choose(index, colors);
}
export type Lane = (value: Quad) => Point;
export type StepContext = {
  u: KitInputs; s: Scalar; st: Point; pixel: Point; texel: Point; dimensions: PointUniform;
  tick: ScalarUniform; carrier: ScalarUniform; drift: QuadUniform; warp: QuadUniform;
  slow: QuadUniform; fast: QuadUniform; control: QuadUniform; control2: QuadUniform;
  /** Maps a [0, 1] texture coordinate into the aspect-corrected, scaled pattern domain. */
  toDomain: (point: Point) => Point;
  q: Point; bend: Scalar; fold: Scalar; domain: Point; field: Scalar; other: Scalar;
  arrivals: (point: Point) => { gust: Point; mass: Scalar; level: Scalar; peak: Scalar };
  local: { gust: Point; mass: Scalar; level: Scalar; peak: Scalar };
  /** History at a texture coordinate. At epoch boundaries both lanes read the primed shadow. */
  read: (point: Point) => Quad;
  at: (offset: Point) => Quad;
  wrapped: (offset: Point) => Quad;
  bounded: (point: Point) => Point;
  coin: (salt: number) => Scalar;
  /** Blend history toward a target, then record a slow |Δ| afterimage. */
  finish: (history: Scalar, value: Scalar, echoHistory: Scalar, target: Scalar, injection: Scalar | number, gain?: number) => Point;
};
export type DisplayContext = {
  u: KitInputs; pixel: Point; st: Point; cell: Point; dimensions: PointUniform; screen: PointUniform;
  state: Quad; threshold: Scalar; tick: ScalarUniform; carrier: ScalarUniform;
  /** Current state offset by whole simulation cells (for gradients and edges). */
  sample: (offset: Point) => Quad;
  control: QuadUniform; control2: QuadUniform; slow: QuadUniform; fast: QuadUniform;
  /** Role colors: 0 ground, 1 accent, 2 ink, 3 body, 4 trace. Missing roles fold back. */
  role: (index: 0 | 1 | 2 | 3 | 4) => Color;
  count: number;
};
export type KitGraph = {
  /** Largest simulation edge. Smaller values give chunkier pixels. */
  maxEdge?: number;
  /** Dither in display pixels (default) or in simulation cells for chunky blocks. */
  dither?: 'screen' | 'cell';
  /** Returns the per-lane update and the state used when a lane is (re)primed. */
  step: (ctx: StepContext) => { evolve: (lane: Lane) => Point; seed: Point };
  display: (ctx: DisplayContext) => Color;
  /** Optional CPU hook that runs before each fixed 60 Hz simulation step. */
  update?: (frame: number, score: KitScore, size: { width: number; height: number }) => void;
  environment?: string;
};

/** Shared lifecycle for the pattern, raster and matter studies.
 * RG: signal and slower difference envelope; BA: the priming epoch. A fixed
 * 60 Hz simulation primes BA 128 frames before each 256-frame epoch, so every
 * graph must forget its initial state inside 128 frames (contraction, a bounded
 * dependency cone or a guaranteed rewrite). Seeks rebuild at most 384 steps.
 * Original TSL implementation. */
export function createKitStudy(u: KitInputs, family: string, graph: KitGraph, controls: Controls, salt: number) {
  const maxEdge = graph.maxEdge ?? 384;
  const events = Array.from({ length: 6 }, () => ({ a: uniform(new Vector4()), b: uniform(new Vector4()) }));
  const dimensions = uniform(new Vector2(maxEdge, maxEdge));
  const screen = uniform(new Vector2(960, 640));
  const tick = uniform(0), initialize = uniform(1), carrier = uniform(0);
  const drift = uniform(new Vector4()), warp = uniform(new Vector4());
  const slow = uniform(new Vector4()), fast = uniform(new Vector4());
  const control = uniform(new Vector4()), control2 = uniform(new Vector4());
  let evolutionSeed = -1;
  let evolution = createKitEvolution(0, salt, controls);
  const targets = [0, 1].map(() => new RenderTarget(maxEdge, maxEdge, {
    minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false,
    stencilBuffer: false, type: HalfFloatType, generateMipmaps: false, colorSpace: NoColorSpace,
  }));
  const previous = texture(targets[0].texture);
  const result = texture(targets[0].texture);
  const stepMaterial = new MeshBasicNodeMaterial();
  stepMaterial.depthTest = false; stepMaterial.depthWrite = false; stepMaterial.toneMapped = false;
  stepMaterial.fragmentNode = Fn(() => {
    const st = uv(), s = u.seed;
    const texel = vec2(1).div(dimensions), pixel = floor(st.mul(dimensions));
    const toDomain = (point: Point) => point.sub(.5).mul(vec2(u.aspect, 1)).mul(u.scale);
    const q = toDomain(st);
    const bend = noise(q.mul(.91).add(drift.xy).add(s));
    const fold = noise(q.mul(1.47).sub(drift.zw).sub(s));
    const domain = q.add(vec2(bend, fold).sub(.5).mul(warp.x.mul(2.4)));
    const field = noise(domain.mul(1.5).add(drift.zw).add(s));
    const other = noise(domain.mul(2.1).sub(drift.yx).add(s.mul(.7)));
    const arrivals = (point: Point) => {
      const gust = vec2(0).toVar(), mass = float(.01).toVar(), deposit = float(0).toVar(), peak = float(0).toVar();
      for (const event of events) {
        const delta = point.sub(event.a.xy).mul(vec2(u.aspect, 1));
        const radius = delta.div(vec2(event.b.y, 1)).length().div(event.a.z);
        const footprint = float(1).sub(smoothstep(.25, 1.5, radius)).mul(event.a.w);
        gust.addAssign(vec2(cos(event.b.x), sin(event.b.x)).mul(footprint));
        mass.addAssign(footprint); deposit.addAssign(footprint.mul(event.b.z));
        peak.assign(max(peak, footprint));
      }
      return { gust: gust.div(mass), mass, level: deposit.div(mass), peak };
    };
    const local = arrivals(st);
    const boundary = float(1).sub(step(.5, tick.mod(256)));
    const bounded = (point: Point) => point.clamp(texel.mul(.5), vec2(1).sub(texel.mul(.5)));
    const read = (point: Point): Quad => { const v = previous.sample(point); return mix(v, v.zwzw, boundary); };
    const at = (offset: Point) => read(bounded(st.add(offset.mul(texel))));
    const wrapped = (offset: Point) => read(fract(st.add(offset.mul(texel))));
    const finish = (history: Scalar, value: Scalar, echoHistory: Scalar, target: Scalar, injection: Scalar | number, gain = 1.035) => {
      const signal = mix(history, target, injection).sub(.5).mul(gain).add(.5).clamp(0, 1);
      const echo = mix(echoHistory, abs(signal.sub(value)), .035).clamp(0, 1);
      return vec2(signal, echo);
    };
    const coin = (salt: number) => pixelHash(uint(pixel.x).add(uint(pixel.y).mul(65537)).add(uint(carrier)).add(uint(salt)));
    const { evolve, seed } = graph.step({ u, s, st, pixel, texel, dimensions, tick, carrier, drift, warp, slow, fast, control, control2,
      toDomain, q, bend, fold, domain, field, other, arrivals, local, read, at, wrapped, bounded, coin, finish });
    const main = evolve(v => v.xy), shadow = evolve(v => v.zw);
    const prime = max(initialize, float(1).sub(step(.5, abs(tick.mod(256).sub(128)))));
    return vec4(mix(main, seed, initialize), mix(shadow, seed, prime));
  })();
  const quad = new QuadMesh(stepMaterial);
  const material = new MeshBasicNodeMaterial();
  material.depthTest = false; material.depthWrite = false; material.toneMapped = false;
  const count = u.colors.length;
  const fold = [[0, 1, 1, 1, 1], [0, 1, 2, 2, 1], [0, 1, 2, 3, 1], [0, 1, 2, 3, 4]][Math.max(0, Math.min(3, count - 2))];
  material.colorNode = Fn(() => {
    const pixel = floor(uv().mul(screen)), st = pixel.add(.5).div(screen);
    const cell = floor(st.mul(dimensions));
    const place = graph.dither === 'cell' ? cell : pixel;
    const threshold = cellHash(place, u.seed.mul(65535));
    const state = result.sample(st);
    const sample = (offset: Point) => result.sample(st.add(offset.div(dimensions)).clamp(vec2(0), vec2(1)));
    return graph.display({ u, pixel, st, cell, dimensions, screen, state, threshold, tick, carrier, control, control2, slow, fast, sample,
      role: index => u.colors[fold[index]], count }).max(vec3(0));
  })();

  const epochFrames = 256, primingFrames = 128;
  let frame = -1, epoch = -1, read = 0;
  const reset = () => { frame = -1; epoch = -1; };
  return {
    material,
    reset,
    resize(width: number, height: number) {
      screen.value.set(width, height);
      const ratio = Math.min(1, maxEdge / Math.max(width, height));
      const w = Math.max(2, Math.round(width * ratio)), h = Math.max(2, Math.round(height * ratio));
      dimensions.value.set(w, h);
      for (const target of targets) target.setSize(w, h);
      reset();
    },
    async compile(renderer: WebGPURenderer) {
      const saved = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(targets[1]);
        await renderer.compileAsync(quad, quad.camera);
      } finally { renderer.setRenderTarget(saved); }
    },
    advance(renderer: WebGPURenderer, time: number) {
      const seed = Math.round(u.seed.value / 60 * 65535);
      if (seed !== evolutionSeed) { evolutionSeed = seed; evolution = createKitEvolution(seed, salt, controls); }
      const wanted = Math.floor(time * u.speed.value * 60 + 1e-6);
      const nextEpoch = Math.floor(wanted / epochFrames);
      const restart = epoch < 0 || wanted < frame || wanted - frame > epochFrames;
      if (!restart && wanted === frame) return;
      const saved = renderer.getRenderTarget();
      try {
        if (restart) { epoch = nextEpoch; frame = epoch * epochFrames - primingFrames - 1; read = 0; }
        while (frame < wanted) {
          frame++;
          tick.value = ((frame % epochFrames) + epochFrames) % epochFrames;
          const score = evolution.sample(frame);
          carrier.value = score.carrier;
          drift.value.set(...score.drift); warp.value.set(...score.warp);
          slow.value.set(...score.slow); fast.value.set(...score.fast);
          control.value.set(...score.control); control2.value.set(...score.control2);
          score.events.forEach((event, i) => { events[i].a.value.set(...event.a); events[i].b.value.set(...event.b); });
          graph.update?.(frame, score, { width: dimensions.value.x, height: dimensions.value.y });
          initialize.value = restart && frame === epoch * epochFrames - primingFrames ? 1 : 0;
          previous.value = targets[read].texture;
          renderer.setRenderTarget(targets[1 - read]);
          quad.render(renderer);
          read = 1 - read;
        }
        result.value = targets[read].texture;
      } finally { renderer.setRenderTarget(saved); }
    },
    dispose() { stepMaterial.dispose(); for (const target of targets) target.dispose(); },
    environment() {
      return { simulation: 'fixed 60 Hz feedback', display: graph.environment ?? 'flat palette roles, stationary coverage', composition: family,
        evolution: 'absolute-frame controls and counter-addressed births; no animation loop', feedbackWidth: dimensions.value.x,
        feedbackHeight: dimensions.value.y, maxReplaySteps: epochFrames + primingFrames };
    },
  };
}
