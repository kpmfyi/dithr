import { pigmentRoles } from './palette';
import { HalfFloatType, NearestFilter, NoColorSpace, RenderTarget, Vector2, Vector4 } from 'three';
import { MeshBasicNodeMaterial, QuadMesh, type Node, type WebGPURenderer } from 'three/webgpu';
import type { EntropyFamily } from './recipes';
import { createEntropyEvolution } from './entropy-evolution';
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
export function createEntropy(u: Inputs, family: EntropyFamily) {
  const maxEdge = family === 'alveoli' ? 256 : 320;
  const events = Array.from({ length: 6 }, () => ({ a: uniform(new Vector4()), b: uniform(new Vector4()) }));
  const dimensions = uniform(new Vector2(384, 384));
  const screen = uniform(new Vector2(960, 640));
  const tick = uniform(0), initialize = uniform(1);
  const drift = uniform(new Vector4()), warp = uniform(new Vector4());
  let evolutionSeed = -1;
  let evolution = createEntropyEvolution(0);
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
    const boxes = float(0).toVar(), chips = float(0).toVar();
    const streaks = float(0).toVar(), fronts = float(0).toVar();
    const disturbance = vec2(0).toVar(), total = float(.01).toVar();
    const deposit = float(0).toVar(), deposition = float(0).toVar();
    for (const event of events) {
      const delta = st.sub(event.a.xy).mul(vec2(u.aspect, 1));
      const r = event.a.z.div(u.scale.mul(.24).add(.3));
      const axis = vec2(cos(event.b.x), sin(event.b.x));
      const across = vec2(axis.y.negate(), axis.x);
      const local = vec2(delta.dot(axis), delta.dot(across));
      const dimension = vec2(r.mul(event.b.y), r);
      const square = max(abs(delta.x).div(dimension.x), abs(delta.y).div(dimension.y));
      const radius = local.div(dimension).length();
      const box = float(1).sub(smoothstep(.7, 1, square));
      const triangle = max(abs(local.y).div(r).add(local.x.div(r).mul(.45)), local.x.div(r).negate());
      const chip = float(1).sub(smoothstep(.45, .85, triangle));
      const thin = max(abs(local.y).div(r.mul(.2)), abs(local.x).div(r.mul(event.b.y).mul(2)));
      const strand = float(1).sub(smoothstep(.65, 1, thin));
      const metric = mix(radius, square, warp.w.mul(.55));
      const broken = smoothstep(.16, .42, noise(delta.mul(18).add(event.a.xy.mul(37)).add(s)));
      const lip = abs(metric.sub(event.b.w.mul(3.3).add(.2)).add(bend.sub(.5).mul(.38)));
      const front = float(1).sub(smoothstep(mix(.07, .03, u.detail), .2, lip));
      boxes.assign(max(boxes, box.mul(event.a.w).mul(mix(.55, 1, event.b.z))));
      chips.assign(max(chips, chip.mul(event.a.w).mul(broken)));
      streaks.assign(max(streaks, strand.mul(event.a.w).mul(broken)));
      fronts.assign(max(fronts, front.mul(event.a.w).mul(broken)));
      const footprint = float(1).sub(smoothstep(.3, 2.2, radius)).mul(event.a.w);
      disturbance.addAssign(axis.mul(footprint)); total.addAssign(footprint);
      deposit.addAssign(footprint.mul(event.b.z)); deposition.addAssign(footprint);
    }
    const gust = disturbance.div(total);
    let source: Scalar;
    let velocity: Point;
    if (family === 'rift') {
      const fault = abs(field.sub(.51)).add(other.sub(.5).mul(.09));
      const seam = float(1).sub(smoothstep(.025, mix(.17, .055, u.detail), fault));
      const plates = step(.61, field).mul(step(.45, other));
      source = max(seam.mul(.8), plates);
      velocity = vec2(other.sub(.5), field.sub(.5)).mul(8).add(gust.mul(2));
    } else if (family === 'parcel') {
      const bite = step(mix(.18, .5, u.detail), noise(floor(q.mul(8)).mul(.37).add(drift.xy)));
      source = boxes.mul(mix(.22, 1, bite));
      velocity = vec2(gust.x.mul(5), floor(gust.y.mul(2))).add(vec2(fold.sub(.5).mul(2), 0));
    } else if (family === 'tangle') {
      const a = abs(field.sub(.5)), b = abs(other.sub(.53));
      const width = mix(.045, .006, u.detail);
      const strands = float(1).sub(smoothstep(width, width.add(.014), min(a, b)));
      const interruptions = smoothstep(.23, .45, noise(domain.mul(3.1).add(drift.yw)));
      source = strands.mul(interruptions);
      velocity = vec2(fold.sub(.5), bend.sub(.5).negate()).mul(7.5).add(gust);
    } else if (family === 'spall') {
      const breaks = step(mix(.15, .53, u.detail), other);
      source = chips.mul(breaks);
      velocity = gust.mul(5.2).add(vec2(field.sub(.5), other.sub(.5)).mul(3));
    } else if (family === 'dendrite') {
      const branching = field.sub(.5).mul(2).abs().add(other.sub(.5).abs().mul(.65));
      const channels = float(1).sub(smoothstep(.1, mix(.43, .19, u.detail), branching));
      const reservoirs = step(.69, noise(domain.mul(.53).sub(drift.xy)));
      source = max(channels, reservoirs.mul(.8));
      velocity = vec2(bend.sub(.5).mul(6), fold.sub(.43).mul(5)).add(gust.mul(2));
    } else if (family === 'suture') {
      const wandering = noise(vec2(q.x.mul(.63).add(drift.x), drift.y.add(s))).sub(.5).mul(3.8);
      const jog = floor(noise(vec2(q.x.mul(2.3), drift.z.add(s))).mul(6)).mul(.13);
      const seam = abs(q.y.add(drift.w.mul(.28)).sub(wandering).sub(jog));
      const scar = float(1).sub(smoothstep(mix(.24, .06, u.detail), .4, seam));
      const stitch = step(.28, other);
      source = max(scar.mul(stitch), streaks.mul(.7));
      velocity = vec2(3.3, bend.sub(.5).mul(6)).add(gust.mul(2));
    } else if (family === 'flock') {
      const bite = step(mix(.08, .46, u.detail), noise(domain.mul(4.3).add(drift.xy)));
      source = max(streaks, chips.mul(.68)).mul(bite);
      velocity = gust.mul(6.5).add(vec2(fold.sub(.5), bend.sub(.5)).mul(4));
    } else if (family === 'palisade') {
      const column = floor(q.x.mul(mix(1.2, 3.8, u.detail)).add(noise(vec2(q.x.mul(.7), s)).mul(3)).add(drift.x));
      const stagger = noise(vec2(column.mul(.53).add(s), drift.y)).mul(3);
      const density = noise(vec2(column, q.y.add(stagger).add(drift.z).mul(.9)));
      source = smoothstep(.43, .54, density).mul(step(.22, field));
      const slip = noise(vec2(column.add(s), drift.w));
      velocity = vec2(gust.x.mul(1.4), slip.sub(.5).mul(8)).add(gust);
    } else if (family === 'alveoli') {
      const warped = domain.mul(1.05).add(drift.xy.mul(.18));
      const cell = floor(warped), near = float(100).toVar(), second = float(100).toVar();
      const toSite = vec2(0).toVar(), identity = float(0).toVar();
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
        const id = cell.add(vec2(x, y));
        const h = hash(id.add(s)), h2 = hash(id.add(s).add(17));
        const displacement = vec2(noise(vec2(h.mul(31), drift.x)), noise(vec2(h2.mul(29), drift.y))).sub(.5).mul(.7);
        const delta = id.add(vec2(h, h2).mul(.5)).add(.25).add(displacement).sub(warped);
        const d = delta.dot(delta), closer = step(d, near);
        second.assign(mix(min(second, d), near, closer)); near.assign(min(near, d));
        identity.assign(mix(identity, h, closer)); toSite.assign(mix(toSite, delta, closer));
      }
      const membrane = float(1).sub(smoothstep(.015, mix(.19, .055, u.detail), second.sub(near)));
      source = max(membrane, step(.77, identity).mul(.65));
      velocity = toSite.mul(-5).add(gust.mul(1.4));
    } else {
      source = fronts;
      velocity = gust.mul(3.5).add(vec2(fold.sub(.5), bend.sub(.5)).mul(3));
    }
    // Every family receives births/erasures and changing local transport. Areas
    // renew at different times. The existing picture is never globally cleared.
    const localLevel = deposit.div(deposition.add(.001));
    const renewal = deposition.clamp(0, 1).mul(family === 'parcel' || family === 'spall' || family === 'flock' || family === 'confluence' ? .07 : .22);
    source = mix(source, localLevel, renewal);
    source = source.clamp(0, 1);
    const boundary = float(1).sub(step(.5, tick.mod(256)));
    const prior = previous.sample(st);
    const old = mix(prior, prior.zwzw, boundary);
    // Adjacent compare/exchange remains a subtle abrasion pass. Transport
    // and the family-specific source now determine the larger composition.
    const horizontal = family === 'rift' || family === 'parcel' || family === 'suture' || family === 'tangle';
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
    const injection = family === 'flock' ? .17 : family === 'alveoli' ? .31 : .25;
    const accumulate = (value: Scalar, adjacentValue: Scalar, echoValue: Scalar, moved: Scalar, movedEcho: Scalar) => {
      const eligible = step(.06, min(value, adjacentValue));
      const sorted = mix(value, mix(min(value, adjacentValue), max(value, adjacentValue), order), eligible.mul(.32));
      const history = mix(sorted, moved, family === 'flock' ? .78 : .62);
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
    const pixel = floor(uv().mul(screen)), st = pixel.add(.5).div(screen);
    const state = result.sample(st);
    // Integer PCG noise avoids the diagonal correlations of a sine hash and
    // removes the repeating 2×2 rank motif. Thresholds remain fixed in space.
    const threshold = pixelHash(uint(pixel.x).add(uint(pixel.y).mul(65537)).add(uint(u.seed.mul(65535))));
    const [ground, accent, ink] = pigmentRoles(u.colors, state.r, threshold);
    const fine = ['rift', 'tangle', 'spall', 'dendrite', 'suture', 'flock', 'alveoli', 'confluence'].includes(family);
    const cut = family === 'dendrite' || family === 'rift' ? .4 : fine ? .24 : .43;
    const body = step(threshold, smoothstep(cut - .04, cut + .04, state.r));
    const edge = step(fract(threshold.add(.37)), smoothstep(.02, .13, state.r).mul(u.intensity.mul(.55).add(.02)));
    const pigment = mix(mix(ground, accent, edge), ink, body);
    // No scanline, grille, radial exposure carrier, animated brightness, or
    // per-frame grain. All visible motion comes from the evolving signal.
    const memory = smoothstep(.018, .22, state.g).mul(u.intensity).mul(.62).clamp(0, 1);
    return mix(pigment, accent, step(threshold, memory)).max(vec3(0));
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
      if (seed !== evolutionSeed) { evolutionSeed = seed; evolution = createEntropyEvolution(seed); }
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
    environment() { return { simulation: 'fixed 60 Hz feedback', display: 'three flat pigments, stationary pixel coverage, no scanline carrier', composition: family, evolution: 'absolute-time counter-addressed births and independent stochastic tracks; no animation loop', feedbackWidth: dimensions.value.x,
      feedbackHeight: dimensions.value.y, maxReplaySteps: epochFrames + primingFrames }; },
  };
}
