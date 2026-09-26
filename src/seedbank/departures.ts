import { pigmentRoles } from './palette';
import { HalfFloatType, NearestFilter, NoColorSpace, RenderTarget, Vector2, Vector4 } from 'three';
import { MeshBasicNodeMaterial, QuadMesh, type Node, type WebGPURenderer } from 'three/webgpu';
import type { DepartureFamily } from './recipes';
import { createImpulseEvolution } from './impulse-evolution';
import { createLcdEvolution } from './lcd-evolution';
import { Fn, abs, atan, cos, float, floor, fract, max, min, mix, sin, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';

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
function rotate(p: Point, a: Scalar): Point {
  return vec2(p.x.mul(cos(a)).sub(p.y.mul(sin(a))), p.x.mul(sin(a)).add(p.y.mul(cos(a))));
}
/** Two scalar memories in RG: sorted signal and its slower difference envelope.
 * BA primes the next deterministic epoch while RG is displayed.
 * Original TSL implementation; no source or artwork from the references is embedded.
 */
export function createDeparture(u: Inputs, family: DepartureFamily) {
  const rotor = family === 'rotor', ribbon = family === 'slingshot';
  const cells = family === 'cell-division', impact = family === 'shockfront';
  const maxEdge = cells ? 320 : 384;
  const impulses = [0, 1, 2, 3].map(() => uniform(new Vector4()));
  let impulseEvolution = impact ? createImpulseEvolution(0) : undefined;
  const dimensions = uniform(new Vector2(384, 384));
  const screen = uniform(new Vector2(960, 640));
  const tick = uniform(0), initialize = uniform(1);
  const drift = uniform(new Vector4()), warp = uniform(new Vector4());
  let evolutionSeed = -1;
  let evolution = createLcdEvolution(0);
  const targets = [0, 1].map(() => new RenderTarget(384, 384, {
    minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false,
    stencilBuffer: false, type: HalfFloatType, generateMipmaps: false, colorSpace: NoColorSpace,
  }));
  const previous = texture(targets[0].texture);
  const result = texture(targets[0].texture);
  const stepMaterial = new MeshBasicNodeMaterial();
  stepMaterial.depthTest = false; stepMaterial.depthWrite = false; stepMaterial.toneMapped = false;
  stepMaterial.fragmentNode = Fn(() => {
    const st = uv(), t = tick.div(60), s = u.seed;
    const p = st.sub(.5).mul(vec2(u.aspect, 1));
    const q = p.mul(u.scale.mul(.9));
    const bend = noise(q.mul(1.25).add(drift.xy).add(s));
    const warpField = noise(q.mul(2.1).sub(drift.yx).add(s));
    const center = vec2(sin(drift.x.mul(.8)), cos(drift.y.mul(.73))).mul(.23);
    const radial = p.sub(center);
    const radius = radial.length().max(.001);
    const tangent = vec2(radial.y.negate(), radial.x).div(radius.add(.08));
    let source: Scalar;
    let velocity: Point;
    if (rotor) {
      // Three spiral arms with an eccentric moving center and irregular bite
      // marks. Torque transports yesterday's cut edges through today's arms.
      const angle = atan(radial.y, radial.x);
      const phase = radius.mul(u.scale).mul(mix(9, 17, u.detail))
        .add(angle.mul(3)).add(bend.mul(warp.x).mul(5)).sub(t.mul(3.8)).add(warp.z.mul(4));
      const cut = smoothstep(-.12, .18, sin(phase));
      const bites = smoothstep(.3, .6, noise(q.mul(3).add(drift.yx).add(s)));
      source = cut.mul(bites);
      velocity = tangent.mul(3.8).add(radial.mul(.9));
    } else if (ribbon) {
      // Long sheets bend in a moving, uneven domain. Gaps tear open locally;
      // the ribbons are not horizontal signal bands or a regular cell grid.
      const sheet = rotate(q, drift.z.mul(2).sub(.55));
      const fold = noise(vec2(sheet.x.mul(.72), drift.x.add(s)));
      const fold2 = noise(vec2(sheet.x.mul(1.9).add(s), drift.y));
      const lane = sheet.y.add(fold.sub(.5).mul(2.8)).add(fold2.sub(.5).mul(.7)).add(bend.sub(.5).mul(.85));
      // Calibrate around the chosen .58 default while allowing density edits.
      const density = float(1.8).add(u.detail.sub(.58).mul(1.5));
      const phase = fract(lane.mul(density).sub(t.mul(.82)).add(warp.z));
      const width = mix(.26, .62, bend);
      const band = smoothstep(.025, .085, phase).mul(float(1).sub(smoothstep(width, width.add(.065), phase)));
      const tear = smoothstep(.17, .29, noise(sheet.mul(vec2(.8, 4)).add(drift.yx)));
      source = band.mul(tear);
      velocity = rotate(vec2(4.2, bend.sub(.5).mul(5.5)), drift.z.mul(2).sub(.55));
    } else if (cells) {
      // Unequal moving sites, with domain warp before nearest-site selection.
      // Local frequencies differ, while the seeded drift changes their context.
      const domain = q.mul(2.1).add(vec2(bend, warpField).sub(.5).mul(1.4)).add(drift.xy.mul(.38));
      const tile = floor(domain), local = fract(domain);
      const nearest = float(20).toVar(), second = float(20).toVar();
      const toSite = vec2(0).toVar(), identity = float(0).toVar();
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
        const cell = tile.add(vec2(x, y));
        const h = hash(cell.add(s)), h2 = hash(cell.add(vec2(s, 91.7)));
        const jitter = vec2(sin(t.mul(h.mul(.8).add(.6)).add(h2.mul(19))),
          cos(t.mul(h2.mul(.7).add(.85)).add(h.mul(23)))).mul(.36);
        const delta = vec2(x, y).add(.5).add(jitter).sub(local);
        const distance = delta.dot(delta);
        const wins = step(distance, nearest);
        toSite.assign(mix(toSite, delta, wins)); identity.assign(mix(identity, h, wins));
        second.assign(min(second, max(nearest, distance))); nearest.assign(min(nearest, distance));
      }
      const membrane = second.sqrt().sub(nearest.sqrt());
      const core = smoothstep(.035, mix(.18, .09, u.detail), membrane);
      source = max(core.mul(step(.61, identity)), float(1).sub(core).mul(.33));
      velocity = toSite.mul(-4.2).add(vec2(warpField.sub(.5), bend.sub(.5)).mul(1.4));
    } else if (impact) {
      // Irregular arrivals replace a repeating radial oscillator. Each front
      // has its own center, lifetime and broken circumference.
      const wave = float(0).toVar();
      const transport = vec2(0).toVar();
      const weight = float(.001).toVar();
      for (const impulse of impulses) {
        const delta = st.sub(impulse.xy).mul(vec2(u.aspect, 1));
        const distance = delta.length().max(.001);
        const spread = impulse.z.mul(1.45).div(u.scale.mul(.32).add(.35));
        const scallop = noise(delta.mul(5.5).add(impulse.xy.mul(17)).add(s)).sub(.5).mul(.065);
        const front = abs(distance.add(scallop).sub(spread));
        const width = mix(.033, .013, u.detail);
        const ring = float(1).sub(smoothstep(width, width.add(.028), front));
        const fragments = smoothstep(.22, .42, noise(delta.mul(9).add(impulse.xy.mul(31)).add(s)));
        const energy = ring.mul(impulse.w).mul(fragments);
        wave.assign(max(wave, energy));
        const wake = float(1).sub(smoothstep(.02, .28, front)).mul(impulse.w);
        transport.addAssign(delta.div(distance).mul(wake)); weight.addAssign(wake);
      }
      source = wave;
      velocity = transport.div(weight).mul(3.7);
    } else {
      // Thin, interlaced ridges race through a continuously re-shaped domain.
      // The second field interrupts strokes into short, etched filaments.
      const domain = q.add(vec2(bend, warpField).sub(.5).mul(1.8));
      const field = noise(domain.mul(vec2(1.2, .9)).add(drift.xy.mul(.8)));
      const phase = fract(field.mul(mix(10, 22, u.detail)).sub(t.mul(1.15)).add(warp.z));
      const ridge = float(1).sub(smoothstep(.075, .17, abs(phase.sub(.5))));
      const breaks = smoothstep(.22, .42, noise(domain.mul(3.8).sub(drift.yx)));
      source = ridge.mul(breaks);
      velocity = vec2(warpField.sub(.5), bend.sub(.5).negate()).mul(6.5);
    }
    source = source.clamp(0, 1);
    const boundary = float(1).sub(step(.5, tick.mod(256)));
    const prior = previous.sample(st);
    const old = mix(prior, prior.zwzw, boundary);
    // Adjacent compare/exchange remains a subtle abrasion pass. Transport
    // and the family-specific source now determine the larger composition.
    const horizontal = ribbon || cells;
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
    const injection = impact ? .29 : cells ? .25 : .24;
    const accumulate = (value: Scalar, adjacentValue: Scalar, echoValue: Scalar, moved: Scalar, movedEcho: Scalar) => {
      const eligible = step(.06, min(value, adjacentValue));
      const sorted = mix(value, mix(min(value, adjacentValue), max(value, adjacentValue), order), eligible.mul(.32));
      const history = mix(sorted, moved, impact ? .7 : .62);
      const signal = mix(history, source, injection).sub(.5).mul(1.035).add(.5).clamp(0, 1);
      const echo = mix(mix(echoValue, movedEcho, .28), abs(signal.sub(value)), .045).clamp(0, 1);
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
    // Every display decision belongs to one output pixel. Feedback is already
    // nearest-filtered; broad color interpolation was what made these studies soft.
    const pixel = floor(uv().mul(screen));
    const st = pixel.add(.5).div(screen);
    const state = result.sample(st);
    const fine = impact || family === 'filament';
    const rank = pixel.x.add(pixel.y).mod(2).mul(2).add(pixel.y.mod(2)).div(4);
    const threshold = fract(rank.add(hash(floor(pixel.div(2)).add(vec2(u.seed.mul(37), u.seed.mul(13))))));
    const [ground, accent, ink] = pigmentRoles(u.colors, state.r, threshold);

    // Flat pigment zones, with coverage expressed as individual hard pixels.
    // Keep each family's signal threshold, but replace the old wide shaded ramps
    // with narrow, stationary dither transitions. No interpolated bevel or glow.
    const cut = fine ? .25 : cells ? .695 : .46;
    const feather = cells ? .035 : fine ? .045 : .06;
    const body = step(threshold, smoothstep(cut - feather, cut + feather, state.r));
    const rimCoverage = smoothstep(.035, .12, state.r).mul(cells ? .95 : .65);
    const rim = step(fract(threshold.add(.37)), rimCoverage);
    let base = mix(mix(ground, accent, rim), ink, body);

    // Curved/oblique carrier cuts are also pixel-snapped and use three discrete
    // exposure levels. The underlying event score and feedback motion are intact.
    const p = st.sub(.5).mul(vec2(u.aspect, 1));
    const carrierCoordinate = rotor || impact ? p.length().mul(screen.y)
      : ribbon ? pixel.x.mul(.55).add(pixel.y.mul(.83)) : pixel.x.sub(pixel.y.mul(.7));
    const tooth = step(.64, fract(carrierCoordinate.mul(.6)));
    const pressure = step(.5, hash(vec2(floor(carrierCoordinate.div(3)).add(u.seed), floor(tick.div(3)))));
    const exposure = mix(mix(.74, .88, tooth), 1, pressure);
    base = base.mul(exposure);
    const memory = smoothstep(.025, fine ? .16 : .22, state.g).mul(u.intensity).mul(fine ? .75 : .6).clamp(0, 1);
    return mix(base, accent, step(threshold, memory)).max(vec3(0));
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
      if (seed !== evolutionSeed) { evolutionSeed = seed; evolution = createLcdEvolution(seed); if (impact) impulseEvolution = createImpulseEvolution(seed); }
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
          tick.value = frame;
          const score = evolution.sample(frame / 60);
          drift.value.set(...score.drift); warp.value.set(...score.warp);
          impulseEvolution?.sample(frame / 60).forEach((value, index) => impulses[index].value.set(...value));
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
    environment() { return { simulation: 'fixed 60 Hz feedback', display: 'pixel-snapped flat tones with stationary coverage dither', composition: family, feedbackWidth: dimensions.value.x,
      feedbackHeight: dimensions.value.y, maxReplaySteps: epochFrames + primingFrames }; },
  };
}
