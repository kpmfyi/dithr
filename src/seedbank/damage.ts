import { HalfFloatType, NearestFilter, NoColorSpace, RenderTarget, Vector2, Vector4 } from 'three';
import { MeshBasicNodeMaterial, QuadMesh, type Node, type WebGPURenderer } from 'three/webgpu';
import type { DamageFamily } from './recipes';
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
/** Two scalar memories in RG: sorted signal and its slower difference envelope.
 * BA primes the next deterministic epoch while RG is displayed.
 * Original TSL implementation; no source or artwork from the references is embedded.
 */
export function createDamage(u: Inputs, family: DamageFamily) {
  const gridOnly = ['row-collapse', 'column-shear', 'address-drift', 'staircase', 'dead-channel'].includes(family);
  const impact = family === 'raster-bloom';
  const maxEdge = family === 'shatter' || family === 'dead-channel' ? 320 : 384;
  const impulses = [0, 1, 2, 3].map(() => uniform(new Vector4()));
  let impulseEvolution = impact ? createImpulseEvolution(0) : undefined;
  const dimensions = uniform(new Vector2(384, 384));
  const screen = uniform(new Vector2(960, 640));
  const tick = uniform(0), initialize = uniform(1);
  const drift = uniform(new Vector4()), warp = uniform(new Vector4());
  const renewal = uniform(new Vector4()), renewalShape = uniform(new Vector4());
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
    let source: Scalar;
    let velocity: Point;
    if (family === 'row-collapse') {
      // Irregular row groups latch their own address. No polar coordinates.
      const row = floor(q.y.mul(float(4.1).add(u.detail.sub(.63).mul(4))).add(noise(vec2(q.y.mul(1.3), s)).mul(2)));
      const address = hash(vec2(row, s));
      const head = q.x.mul(mix(1.4, 3.7, address)).add(t.mul(address.sub(.47)).mul(3)).add(drift.x);
      const width = noise(vec2(row.mul(.43).add(s), drift.y)).mul(.48).add(.15);
      const shutters = step(fract(head), width);
      const teeth = step(.27, fract(q.y.mul(28).add(address.mul(5))));
      const tears = step(.24, noise(vec2(head.mul(2), row.add(drift.y))));
      source = shutters.mul(teeth).mul(tears).mul(step(.26, noise(vec2(head.mul(.55).add(s), row.mul(.77).sub(drift.y)))));
      velocity = vec2(address.sub(.48).mul(9), step(.78, bend).sub(step(bend, .2)));
    } else if (family === 'column-shear') {
      const gate = floor(q.x.mul(5).add(noise(vec2(q.x, s)).mul(3)));
      const identity = hash(vec2(gate.add(s), 17));
      const track = q.y.add(t.mul(mix(-.95, 1.3, identity))).add(drift.y.mul(identity));
      const shutter = step(.44, noise(vec2(gate.mul(.65), track.mul(2.7).add(s))));
      const comb = step(mix(.2, .65, u.detail), fract(q.x.mul(38).add(identity)));
      source = max(shutter.mul(mix(.3, 1, comb)), step(.86, identity).mul(step(.3, fract(track.mul(7)))));
      velocity = vec2(step(.87, warpField).mul(2), identity.sub(.44).mul(11));
    } else if (family === 'address-drift') {
      const row = floor(q.y.mul(5).add(drift.y));
      const col = floor(q.x.mul(4).sub(drift.x));
      const x = q.x.add(floor(noise(vec2(row, drift.x.add(s))).mul(float(7).add(u.detail.sub(.58).mul(6)))).mul(.17));
      const y = q.y.add(floor(noise(vec2(col, drift.y.sub(s))).mul(6)).mul(.19));
      const rowPitch = mix(1.7, 5.1, hash(vec2(row.add(s), 7)));
      const colPitch = mix(1.6, 4.8, hash(vec2(col.sub(s), 13)));
      const a = step(.46, fract(x.mul(rowPitch).add(t.mul(.67))));
      const b = step(.57, fract(y.mul(colPitch).sub(t.mul(.43))));
      const junction = step(.55, noise(vec2(row.mul(.23), col.mul(.31)).add(drift.xy)));
      const circuit = abs(a.sub(b));
      source = mix(circuit.mul(.9), a.mul(b), junction);
      velocity = vec2(b.sub(.5).mul(6), a.sub(.5).mul(-6));
    } else if (family === 'staircase') {
      const column = floor(q.x.mul(mix(3, 7, u.detail)).add(drift.x));
      const jog = floor(noise(vec2(column.mul(.31).add(s), drift.y)).mul(5)).mul(.27);
      const phase = fract(q.y.mul(2.9).add(column.mul(.23)).add(jog).sub(t.mul(.93)));
      const body = step(.22, phase).mul(step(phase, .62));
      const notches = step(.2, fract(q.x.mul(24).add(column)));
      source = body.mul(mix(.2, 1, notches));
      const turn = step(.5, hash(vec2(column, floor(q.y.mul(5)).add(s))));
      velocity = mix(vec2(4.5, 0), vec2(0, -4.5), turn);
    } else if (family === 'dead-channel' || family === 'shatter') {
      // Competing sites: Manhattan distance makes only rectilinear channels;
      // squared Euclidean distance makes the separate shard family polygonal.
      const domain = q.mul(family === 'dead-channel' ? 1.55 : 1.25).add(drift.xy.mul(.17));
      const cell = floor(domain);
      const near = float(100).toVar(), second = float(100).toVar();
      const identity = float(0).toVar(), toSite = vec2(0).toVar(), slide = vec2(0).toVar();
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
        const id = cell.add(vec2(x, y));
        const h = hash(id.add(s)), h2 = hash(id.add(s).add(29.7));
        const jitter = vec2(sin(t.mul(.93).add(h.mul(19)).add(warp.z)), cos(t.mul(.71).add(h2.mul(23)).add(drift.y))).mul(.23);
        const delta = id.add(vec2(h, h2).mul(.5)).add(.25).add(jitter).sub(domain);
        const d = family === 'dead-channel' ? abs(delta.x).add(abs(delta.y)) : delta.dot(delta);
        const closer = step(d, near);
        second.assign(mix(min(second, d), near, closer));
        near.assign(min(near, d));
        identity.assign(mix(identity, h, closer));
        toSite.assign(mix(toSite, delta, closer));
        slide.assign(mix(slide, vec2(h, h2).sub(.5).mul(8), closer));
      }
      const edge = second.sub(near);
      if (family === 'dead-channel') {
        const seam = float(1).sub(smoothstep(.045, mix(.18, .07, u.detail), edge));
        source = max(seam.mul(.95), step(.68, identity).mul(.65));
        const axis = step(abs(toSite.y), abs(toSite.x));
        velocity = mix(vec2(0, toSite.y.mul(-6)), vec2(toSite.x.mul(-6), 0), axis);
      } else {
        const front = fract(domain.dot(slide).mul(.15).add(identity.mul(7)).sub(t.mul(mix(.3, 1.1, identity))));
        const shard = step(float(.12).add(u.detail.sub(.61).mul(.14)), edge).mul(step(.39, front));
        source = max(shard, float(1).sub(step(.05, edge)).mul(.38));
        velocity = slide.add(toSite.mul(.7));
      }
    } else if (family === 'puncture') {
      const center = vec2(sin(drift.x.mul(.7)), cos(drift.y.mul(.63))).mul(.23);
      const delta = p.sub(center), r = delta.length().max(.002);
      const angle = atan(delta.y, delta.x).add(t.mul(.35)).add(drift.z.mul(3));
      const sector = floor(angle.mul(mix(4, 12, u.detail)).add(warp.z));
      const splinter = hash(vec2(sector, s));
      const lip = mix(.18, .61, noise(vec2(angle.mul(2.2).add(s), drift.x)));
      const wound = step(r.mul(u.scale.mul(.48)).add(bend.mul(.08)), lip);
      const fans = step(.34, fract(r.mul(u.scale).mul(mix(3, 8, splinter)).sub(t.mul(1.3)).add(splinter.mul(7))));
      source = wound.mul(mix(.08, 1, fans)).mul(step(.17, splinter));
      velocity = delta.div(r).mul(mix(1.6, 4.8, splinter)).add(vec2(delta.y.negate(), delta.x).mul(1.8));
    } else if (family === 'pressure-leak') {
      const domain = q.add(vec2(bend, warpField).sub(.5).mul(2.4));
      const field = noise(domain.mul(1.8).add(drift.yx.mul(.9)).add(s));
      const branches = noise(domain.mul(4.3).sub(drift.xy).add(s));
      const reservoir = smoothstep(.53, .6, field);
      const vein = float(1).sub(smoothstep(.025, mix(.13, .055, u.detail), abs(field.sub(.47))));
      source = max(reservoir, vein.mul(step(.28, branches)).mul(.8));
      // A divergence field pulls pools through thin channels; Cartesian combs
      // in the display interrupt their curved boundaries.
      velocity = vec2(warpField.sub(.45), bend.sub(.55)).mul(7.5);
    } else if (family === 'delamination') {
      const delta = p.sub(vec2(sin(drift.x.mul(.73)), cos(drift.y.mul(.61))).mul(.29));
      const r = delta.mul(vec2(1.3, .8)).length().max(.002);
      const phase = fract(r.mul(u.scale).mul(mix(3.2, 7.5, u.detail)).add(bend.mul(.9)).sub(t.mul(.9)).add(warp.z));
      const sheets = step(.17, phase).mul(step(phase, .52));
      const tear = step(.32, noise(q.mul(vec2(1.3, 3.1)).add(drift.xy).add(s)));
      source = sheets.mul(tear);
      velocity = vec2(delta.y.negate(), delta.x).div(r).mul(3.2).add(vec2(warpField.sub(.5).mul(3), 1.2));
    } else {
      // Four nonperiodic arrivals meet a broken row/column addressing lattice.
      const wave = float(0).toVar(), transport = vec2(0).toVar(), weight = float(.001).toVar();
      for (const impulse of impulses) {
        const delta = st.sub(impulse.xy).mul(vec2(u.aspect, 1));
        const radial = delta.length().max(.002);
        const square = max(abs(delta.x), abs(delta.y));
        const metric = mix(radial, square.mul(1.2), warp.w.mul(.8));
        const front = abs(metric.sub(impulse.z.mul(1.3).div(u.scale.mul(.3).add(.45))));
        const cells = floor(st.mul(vec2(13, 11)).add(impulse.xy.mul(11)));
        const broken = step(.22, hash(cells.add(s)));
        const rim = float(1).sub(smoothstep(.018, mix(.065, .035, u.detail), front));
        const energy = rim.mul(impulse.w).mul(broken);
        wave.assign(max(wave, energy));
        const push = float(1).sub(smoothstep(.02, .2, front)).mul(impulse.w);
        transport.addAssign(delta.div(radial).mul(push)); weight.addAssign(push);
      }
      source = wave;
      velocity = transport.div(weight).mul(4.6);
    }
    // Local replenishment is event-driven. Grid-only studies use an axis-aligned
    // rectangle; mixed studies use a pressure footprint. Never clear the screen.
    const renewalDelta = st.sub(renewal.xy).mul(vec2(u.aspect, renewalShape.x));
    const distance = gridOnly ? max(abs(renewalDelta.x), abs(renewalDelta.y)) : renewalDelta.length();
    const patch = float(1).sub(smoothstep(renewal.z.mul(.5), renewal.z, distance)).mul(renewal.w).mul(.32);
    source = mix(source, renewalShape.z, patch);
    source = source.clamp(0, 1);
    const boundary = float(1).sub(step(.5, tick.mod(256)));
    const prior = previous.sample(st);
    const old = mix(prior, prior.zwzw, boundary);
    // Adjacent compare/exchange remains a subtle abrasion pass. Transport
    // and the family-specific source now determine the larger composition.
    const horizontal = family === 'row-collapse' || family === 'address-drift' || family === 'pressure-leak' || family === 'staircase';
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
    const injection = impact ? .31 : family === 'shatter' ? .32 : family === 'pressure-leak' ? .18 : .27;
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
    const pixel = floor(uv().mul(screen)), st = pixel.add(.5).div(screen);
    const state = result.sample(st);
    const [ground, accent, ink] = u.colors;
    const rank = pixel.x.add(pixel.y).mod(2).mul(2).add(pixel.y.mod(2)).div(4);
    const threshold = fract(rank.add(hash(floor(pixel.div(2)).add(vec2(u.seed.mul(37), u.seed.mul(13))))));
    const fine = impact || family === 'dead-channel';
    const cut = fine ? .24 : family === 'pressure-leak' ? .38 : .44;
    const body = step(threshold, smoothstep(cut - .045, cut + .045, state.r));
    const edge = step(fract(threshold.add(.37)), smoothstep(.025, .15, state.r).mul(.52));
    let pigment = mix(mix(ground, accent, edge), ink, body);
    // Quantized carrier exposure, keyed to rows/columns rather than animated
    // per-pixel dust. Static coverage dither keeps individual pixels readable.
    const vertical = family === 'column-shear' || family === 'dead-channel';
    const p = st.sub(.5).mul(vec2(u.aspect, 1));
    const radialCarrier = family === 'delamination';
    const carrier = radialCarrier ? p.length().mul(screen.y) : vertical ? pixel.x : pixel.y;
    const tooth = step(.4, fract(carrier.mul(.5)));
    const pulse = step(.48, hash(vec2(floor(carrier.div(3)).add(u.seed), floor(tick.div(3)))));
    pigment = pigment.mul(mix(mix(.7, .87, tooth), 1, pulse));
    const memory = smoothstep(.02, fine ? .19 : .27, state.g).mul(u.intensity).mul(.6).clamp(0, 1);
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
          renewal.value.set(...score.renewalA[0]); renewalShape.value.set(...score.renewalA[1]);
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
    environment() { return { simulation: 'fixed 60 Hz feedback', display: 'pixel-snapped flat tones with stationary coverage dither', composition: family, geometry: gridOnly ? 'grid only / no radial operations' : 'mixed grid and pressure geometry', feedbackWidth: dimensions.value.x,
      feedbackHeight: dimensions.value.y, maxReplaySteps: epochFrames + primingFrames }; },
  };
}
