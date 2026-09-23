import { HalfFloatType, NearestFilter, NoColorSpace, RenderTarget, Vector2, Vector4 } from 'three';
import { MeshBasicNodeMaterial, QuadMesh, type Node, type WebGPURenderer } from 'three/webgpu';
import type { IntricacyFamily } from './recipes';
import { createIntricacyEvolution, intricacyRandom } from './intricacy-evolution';
import { Fn, hash as pixelHash, uint, abs, cos, float, floor, fract, max, min, mix, sin, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';

type Scalar = Node<'float'>;
type Point = Node<'vec2'>;
type ScalarUniform = ReturnType<typeof uniform<'float'>>;
type Inputs = {
  seed: ScalarUniform; scale: ScalarUniform; speed: ScalarUniform;
  intensity: ScalarUniform; detail: ScalarUniform; aspect: ScalarUniform;
  colors: ReturnType<typeof uniform<'vec3'>>[];
};

function hash(p: Point): Scalar {
  return fract(sin(p.dot(vec2(127.1, 311.7))).mul(43758.5453));
}
function noise(p: Point): Scalar {
  const cell = floor(p), f = fract(p);
  const eased = f.mul(f).mul(vec2(3).sub(f.mul(2)));
  return mix(mix(hash(cell), hash(cell.add(vec2(1, 0))), eased.x),
    mix(hash(cell.add(vec2(0, 1))), hash(cell.add(vec2(1, 1))), eased.x), eased.y);
}
/** Two scalar memories in RG: sorted signal and its slower difference envelope.
 * BA primes the next deterministic epoch while RG is displayed.
 * Original TSL implementation; no source or artwork from the references is embedded.
 */
export function createIntricacy(u: Inputs, family: IntricacyFamily) {
  const maxEdge = 384;
  const carrier = uniform(new Vector4());
  const events = Array.from({ length: 6 }, () => ({ a: uniform(new Vector4()), b: uniform(new Vector4()) }));
  const dimensions = uniform(new Vector2(384, 384));
  const screen = uniform(new Vector2(960, 640));
  const tick = uniform(0), initialize = uniform(1);
  const drift = uniform(new Vector4()), warp = uniform(new Vector4());
  let evolutionSeed = -1;
  let evolution = createIntricacyEvolution(0);
  const targets = [0, 1].map(() => new RenderTarget(384, 384, {
    minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false,
    stencilBuffer: false, type: HalfFloatType, generateMipmaps: false, colorSpace: NoColorSpace,
  }));
  const previous = texture(targets[0].texture);
  const result = texture(targets[0].texture);
  const stepMaterial = new MeshBasicNodeMaterial();
  stepMaterial.depthTest = false; stepMaterial.depthWrite = false; stepMaterial.toneMapped = false;
  stepMaterial.fragmentNode = Fn(() => {
    const st = uv(), s = u.seed;
    const p = st.sub(.5).mul(vec2(u.aspect, 1)), q = p.mul(u.scale);
    const bend = noise(q.mul(.91).add(drift.xy).add(s));
    const fold = noise(q.mul(1.47).sub(drift.zw).sub(s));
    const domain = q.add(vec2(bend, fold).sub(.5).mul(warp.x.mul(2.4)));
    const field = noise(domain.mul(1.5).add(drift.zw).add(s));
    const other = noise(domain.mul(2.1).sub(drift.yx).add(s.mul(.7)));
    // Local arrivals bend and replenish the fine structure; footprints do not clear the frame.
    const gust = vec2(0).toVar(), mass = float(.01).toVar();
    const deposit = float(0).toVar();
    for (const event of events) {
      const delta = st.sub(event.a.xy).mul(vec2(u.aspect, 1));
      const radius = delta.div(vec2(event.b.y, 1)).length().div(event.a.z);
      const footprint = float(1).sub(smoothstep(.25, 1.5, radius.add(bend.sub(.5).mul(.5)))).mul(event.a.w);
      gust.addAssign(vec2(cos(event.b.x), sin(event.b.x)).mul(footprint));
      mass.addAssign(footprint); deposit.addAssign(footprint.mul(event.b.z));
    }
    gust.divAssign(mass);
    const density = mix(7, 21, u.detail);
    const etched = (phase: Scalar) => fract(phase).sub(.5).mul(2).abs();
    let engraving: Scalar, body: Scalar, velocity: Point;
    if (family === 'intaglio') {
      engraving = etched(field.mul(density).add(other.mul(2.7)));
      body = noise(domain.mul(vec2(.8, 2.7)).sub(drift.xy));
      velocity = vec2(other.sub(.5).mul(7), bend.sub(.5).mul(3)).add(gust);
    } else if (family === 'braid') {
      const a = etched(domain.x.mul(3.2).add(sin(domain.y.mul(3).add(drift.x))).add(field.mul(4)));
      const b = etched(domain.y.mul(4.7).add(sin(domain.x.mul(4).sub(drift.y))).add(other.mul(3)));
      engraving = etched(mix(a, b, step(.5, field)).mul(density.mul(.32)));
      body = mix(a, b, step(.5, other));
      velocity = vec2(b.sub(.5), a.sub(.5).negate()).mul(7).add(gust.mul(2));
    } else if (family === 'scrim') {
      const a = etched(domain.x.mul(density.mul(.8)).add(other.mul(4)));
      const b = etched(domain.y.mul(density).add(field.mul(5)));
      engraving = min(a, b);
      body = field.mul(.65).add(a.mul(b).mul(.55));
      velocity = vec2(fold.sub(.5).mul(5), bend.sub(.5).mul(5)).add(gust.mul(2));
    } else if (family === 'guilloche') {
      const center = domain.add(drift.zw.mul(.25));
      const ring = center.length().add(sin(center.x.mul(3).add(drift.y)).mul(.28)).add(field.mul(.7));
      engraving = etched(ring.mul(density.mul(.7)));
      body = noise(vec2(ring.mul(1.7), other.mul(3)).add(drift.xy));
      velocity = vec2(center.y.negate(), center.x).div(center.length().add(.3)).mul(3.8).add(gust);
    } else if (family === 'imbricate') {
      const row = floor(domain.y.mul(3.2));
      const local = fract(domain.mul(vec2(3.2, 3.2)).add(vec2(row.mul(.5), 0))).sub(.5);
      const scale = local.mul(vec2(1, 1.4)).length().add(field.mul(.4));
      engraving = etched(scale.mul(density)); body = scale.mul(.7).add(other.mul(.5));
      velocity = vec2(mix(-3.2, 3.2, step(.5, fract(row.mul(.5)))), 2.4).add(gust.mul(2));
    } else if (family === 'capillary') {
      const ridge = min(abs(field.sub(.5)), abs(other.sub(.48)));
      engraving = etched(ridge.mul(density.mul(3.2)).add(bend.mul(2)));
      body = float(.7).sub(ridge.mul(2.4));
      velocity = vec2(fold.sub(.5).mul(8), bend.sub(.5).mul(-6)).add(gust.mul(2));
    } else if (family === 'palimpsest') {
      const a = etched(field.mul(density));
      const b = etched(noise(domain.yx.mul(vec2(1.8, 2.9)).add(drift.zw)).mul(density.mul(1.4)));
      engraving = mix(a, b, smoothstep(.3, .7, other));
      body = mix(field, float(1).sub(other), step(.5, bend));
      velocity = vec2(step(.5, other).mul(6).sub(3), step(.5, field).mul(4).sub(2)).add(gust);
    } else if (family === 'diffract') {
      const a = domain.add(drift.xy.mul(.3)).length();
      const b = domain.mul(vec2(1.4, .8)).sub(drift.zw.mul(.5)).length();
      const fringe = a.sub(b.mul(1.13)).add(field.mul(.65));
      engraving = etched(fringe.mul(density));
      body = sin(a.mul(3).add(b.mul(2))).mul(.2).add(other.mul(.55)).add(.12);
      velocity = domain.div(domain.length().add(.3)).mul(3).add(vec2(fold.sub(.5), bend.sub(.5)).mul(4));
    } else if (family === 'microcode') {
      const row = floor(q.y.mul(9).add(drift.y));
      const address = noise(vec2(row.mul(.37), drift.x.add(s)));
      const column = floor(q.x.mul(8).add(address.mul(7)).add(drift.z));
      const cell = hash(vec2(column, row).add(s));
      const comb = etched(q.x.mul(density.mul(3)).add(address.mul(11)));
      engraving = mix(comb, etched(q.y.mul(density.mul(2))), step(.55, cell));
      body = cell.mul(.5).add(noise(vec2(column.mul(.17), row.mul(.21)).add(drift.zw)).mul(.5));
      velocity = vec2(address.sub(.5).mul(8), step(.7, cell).mul(3).sub(1)).add(gust);
    } else {
      const spine = domain.x.add(sin(domain.y.mul(2.3).add(drift.y)).mul(.7)).add(field);
      const barbs = domain.y.mul(density).add(abs(spine).mul(9)).add(other.mul(6));
      engraving = etched(barbs); body = noise(vec2(spine.mul(2), domain.y.mul(.9)).add(drift.zw));
      velocity = vec2(spine.mul(-1.5), 3.6).add(vec2(fold.sub(.5), bend.sub(.5)).mul(3)).add(gust);
    }
    // Fine incisions and broad torn tonal islands coexist. Extrapolation gives
    // the same hard signal zones as the benchmark, without copying its geometry.
    const row = floor(st.y.mul(dimensions.y));
    const line = pixelHash(uint(row).add(uint(carrier.x)).add(uint(u.seed.mul(8131))));
    let source = body.sub(.5).mul(2.7).add(.5).add(engraving.sub(.5).mul(1.35)).add(line.sub(.5).mul(.28));
    const localLevel = deposit.div(mass);
    source = mix(source, engraving.mul(2).sub(.5).add(localLevel.sub(.5)), mass.clamp(0, 1).mul(.22));
    const boundary = float(1).sub(step(.5, tick.mod(256)));
    const prior = previous.sample(st);
    const old = mix(prior, prior.zwzw, boundary);
    // Adjacent compare/exchange remains a subtle abrasion pass. Transport
    // and the family-specific source now determine the larger composition.
    const horizontal = ['intaglio', 'braid', 'scrim', 'palimpsest', 'microcode'].includes(family);
    const coordinate = floor((horizontal ? st.x : st.y).mul(horizontal ? dimensions.x : dimensions.y));
    const parity = coordinate.add(tick).mod(2);
    const direction = float(1).sub(parity.mul(2));
    const order = abs(parity.sub(step(.5, warp.w)));
    const bounded = (point: Point) => point.clamp(vec2(.5).div(dimensions), vec2(1).sub(vec2(.5).div(dimensions)));
    const pair = horizontal ? vec2(direction, 0) : vec2(0, direction);
    const adjacent = previous.sample(bounded(st.add(pair.div(dimensions))));
    const neighbor = mix(adjacent, adjacent.zwzw, boundary);
    const carriedSample = previous.sample(bounded(st.sub(floor(velocity.add(.5)).div(dimensions))));
    const carried = mix(carriedSample, carriedSample.zwzw, boundary);
    const injection = .23;
    const accumulate = (value: Scalar, adjacentValue: Scalar, echoValue: Scalar, moved: Scalar, movedEcho: Scalar) => {
      const eligible = step(.06, min(value, adjacentValue));
      const sorted = mix(value, mix(min(value, adjacentValue), max(value, adjacentValue), order), eligible.mul(.8));
      const history = mix(sorted, moved, .55);
      const signal = mix(history, source, injection).sub(.5).mul(1.035).add(.5).clamp(0, 1);
      const echo = mix(mix(echoValue, movedEcho, .28), abs(signal.sub(value)), .035).clamp(0, 1);
      return vec2(signal, echo);
    };
    const main = accumulate(old.r, neighbor.r, old.g, carried.r, carried.g);
    const shadow = accumulate(old.b, neighbor.b, old.a, carried.b, carried.a);
    const prime = max(initialize, float(1).sub(step(.5, abs(tick.mod(256).sub(128)))));
    return vec4(mix(main, vec2(source.clamp(0, 1), 0), initialize),
      mix(shadow, vec2(source.clamp(0, 1), 0), prime));
  })();
  const quad = new QuadMesh(stepMaterial);
  const material = new MeshBasicNodeMaterial();
  material.depthTest = false; material.depthWrite = false; material.toneMapped = false;
  material.colorNode = Fn(() => {
    const pixel = floor(uv().mul(screen)), st = pixel.add(.5).div(screen);
    const state = result.sample(st);
    const [ground, accent, ink] = u.colors;
    // Integer PCG noise avoids the diagonal correlations of a sine hash and
    // removes the repeating 2×2 rank motif. Thresholds remain fixed in space.
    const threshold = pixelHash(uint(pixel.x).add(uint(pixel.y).mul(65537)).add(uint(u.seed.mul(65535))));
    const high = step(threshold, smoothstep(.70, .85, state.r));
    const middle = step(fract(threshold.add(.37)), smoothstep(.09, .2, state.r)).mul(float(1).sub(high));
    const pigment = mix(mix(ground, ground.mul(.32), middle), ink, high);
    // Carrier identity varies by family: segmented rows, stitched mesh,
    // offset registers and contour-gated combs. Three discrete exposure levels.
    const row = floor(pixel.y.div(2));
    const segmentWidth = family === 'braid' ? 47 : family === 'scrim' ? 19 : family === 'microcode' ? 29 : family === 'palimpsest' ? 113 : family === 'plume' ? 71 : 211;
    const cell = floor(pixel.x.div(segmentWidth));
    const address = uint(row).mul(1987).add(uint(cell).mul(7919)).add(uint(carrier.x));
    const flicker = pixelHash(address);
    const register = pixel.y.add(floor(state.r.mul(11))).mod(3);
    const nick = pixelHash(uint(floor(pixel.x.div(3))).add(uint(row).mul(65537)).add(uint(u.seed.mul(997))));
    let marks: Scalar;
    if (family === 'scrim') marks = max(step(.65, flicker), step(.75, nick).mul(step(1, pixel.x.mod(3))));
    else if (family === 'guilloche' || family === 'diffract') marks = step(.46, flicker).mul(step(1, register));
    else if (family === 'microcode') marks = step(.38, flicker).mul(step(.28, nick));
    else if (family === 'plume' || family === 'imbricate') marks = step(.54, flicker).mul(step(.18, state.r));
    else marks = step(.45, flicker);
    const exposure = mix(1, mix(.58, .8, step(1, register)), marks.mul(float(1).sub(high.mul(.75))));
    // Quantize again after the mask so there are only three exposures per pigment.
    const flatExposure = mix(.58, mix(.8, 1, step(.9, exposure)), step(.7, exposure));
    const memory = smoothstep(.02, .23, state.g).mul(u.intensity).mul(.88).clamp(0, 1);
    return mix(pigment.mul(flatExposure), accent, step(threshold, memory)).max(vec3(0));
  })();

  // Fixed 60 Hz simulation. BA starts 128 frames before each 256-frame epoch
  // and becomes RG at the boundary. Priming happens alongside live rendering,
  // avoiding a burst of replay work or a visible empty-buffer reset.
  // An arbitrary seek reconstructs only the current epoch and its priming.
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
      if (seed !== evolutionSeed) { evolutionSeed = seed; evolution = createIntricacyEvolution(seed); }
      const wanted = Math.floor(time * u.speed.value * 60 + 1e-6);
      const nextEpoch = Math.floor(wanted / epochFrames);
      const restart = epoch < 0 || wanted < frame || wanted - frame > epochFrames;
      if (!restart && wanted === frame) return;
      const saved = renderer.getRenderTarget();
      try {
        if (restart) {
          epoch = nextEpoch; frame = epoch * epochFrames - primingFrames - 1;
          read = 0;
        }
        while (frame < wanted) {
          frame++;
          tick.value = ((frame % epochFrames) + epochFrames) % epochFrames;
          const score = evolution.sample(frame / 60);
          carrier.value.set(Math.floor(intricacyRandom(seed, frame, 91) * 16777215), 0, 0, 0);
          drift.value.set(...score.drift); warp.value.set(...score.warp);
          score.events.forEach((event, i) => { events[i].a.value.set(...event.a); events[i].b.value.set(...event.b); });
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
    environment() { return { simulation: 'fixed 60 Hz feedback', display: 'flat pigments, discrete row exposures, stationary pixel coverage', composition: family, evolution: 'absolute-time counter-addressed births and independent stochastic tracks; no animation loop', feedbackWidth: dimensions.value.x,
      feedbackHeight: dimensions.value.y, maxReplaySteps: epochFrames + primingFrames }; },
  };
}
