import { HalfFloatType, NearestFilter, NoColorSpace, RenderTarget, Vector2, Vector4 } from 'three';
import { MeshBasicNodeMaterial, QuadMesh, type Node, type WebGPURenderer } from 'three/webgpu';
import { createLcdEvolution } from './lcd-evolution';
import { Fn, abs, cos, float, floor, fract, max, min, mix, sin, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';

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
export function createBrokenLcd(u: Inputs) {
  const dimensions = uniform(new Vector2(384, 384));
  const screen = uniform(new Vector2(960, 640));
  const tick = uniform(0), initialize = uniform(1);
  const drift = uniform(new Vector4()), warp = uniform(new Vector4());
  const birthA = uniform(new Vector4()), birthB = uniform(new Vector4());
  const birthShapeA = uniform(new Vector4()), birthShapeB = uniform(new Vector4());
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
    // Unequal row spans avoid the old fixed center seam. Fast signal changes
    // remain horizontal, but neighboring rows have different break points.
    const rows = mix(65, 125, u.detail);
    const row = floor(st.y.mul(rows));
    const span = hash(vec2(row, s)).mul(2.7).add(1.2);
    const offset = hash(vec2(row.add(71), s));
    const lineP = vec2(floor(st.x.mul(span).add(offset)).div(span), row.div(rows));
    const lineNoise = noise(lineP.mul(vec2(4.5, 15)).add(vec2(s, t.mul(1.9))));
    const lines = sin(lineNoise.mul(23).add(row.mul(.72)).add(t.mul(4.1))).mul(.5).add(.5);

    const p = st.sub(.5).mul(vec2(u.aspect, 1));
    const q = rotate(p.mul(u.scale.mul(.63)), drift.z).mul(vec2(drift.w, 1));
    const bend = noise(q.mul(vec2(1.1, 2.1)).add(drift.xy).add(s));
    const fieldP = q.add(vec2(bend.sub(.5).mul(warp.x), bend.sub(.5).mul(warp.x.mul(.7))));
    // Nonperiodic, elongated noise replaces the repeating sine-wave bands.
    // Independent seeded tracks alter stretch, direction and domain warping.
    const longField = noise(fieldP.mul(vec2(.85, 4.3)).add(drift.xy).add(vec2(s, 0)));
    const islands = noise(fieldP.mul(vec2(2.8, 2.2)).sub(drift.yx.mul(.73)).add(s));
    const shape = mix(longField, islands, warp.y).sub(.5).mul(3.1).add(.5);
    const eddies = noise(p.mul(vec2(4.8, 5.3)).add(drift.xy.mul(.37)).add(s));
    const contours = fract(eddies.mul(mix(5, 9, u.detail)).add(warp.z));
    const source = mix(mix(lines, shape, 7.2), contours, .55).toVar();

    // Organic local replenishment at seeded, irregular times. These masks have
    // independent locations, sizes and orientations, and never reset the canvas.
    const renewalMask = (birth: Node<'vec4'>, form: Node<'vec4'>) => {
      const delta = rotate(st.sub(birth.xy).mul(vec2(u.aspect, 1)), form.y);
      const distance = delta.div(vec2(form.x, 1)).length().div(birth.z);
      return float(1).sub(smoothstep(.35, 1, distance.add(bend.sub(.5).mul(.45)))).mul(birth.w);
    };
    const resetA = renewalMask(birthA, birthShapeA), resetB = renewalMask(birthB, birthShapeB);
    const resetAmount = max(resetA, resetB).mul(.65);
    const renewalLevel = mix(birthShapeB.z, birthShapeA.z, resetA.div(resetA.add(resetB).max(.001)));
    const fresh = contours.mul(2.7).sub(.85).add(renewalLevel.sub(.5).mul(1.3));

    const boundary = float(1).sub(step(.5, tick.mod(256)));
    const prior = previous.sample(st);
    const old = mix(prior, prior.zwzw, boundary);
    // Odd/even compare-exchange: each pair chooses complementary min/max.
    const parity = floor(st.y.mul(dimensions.y)).add(tick).mod(2);
    const direction = float(1).sub(parity.mul(2));
    const order = abs(parity.sub(step(.5, warp.w)));
    const otherUV = st.add(vec2(0, direction.div(dimensions.y)))
      .clamp(vec2(.5).div(dimensions), vec2(1).sub(vec2(.5).div(dimensions)));
    const adjacent = previous.sample(otherUV);
    const neighbor = mix(adjacent, adjacent.zwzw, boundary);
    const accumulate = (value: Scalar, adjacentValue: Scalar, echoValue: Scalar) => {
      const eligible = step(.09, min(value, adjacentValue));
      const sorted = mix(value, mix(min(value, adjacentValue), max(value, adjacentValue), order), eligible);
      const signal = mix(mix(sorted, source, .24), fresh, resetAmount).sub(.5).mul(1.045).add(.5).clamp(0, 1);
      const echo = mix(echoValue, abs(signal.sub(value)), .035).clamp(0, 1);
      return vec2(signal, echo);
    };
    const main = accumulate(old.r, neighbor.r, old.g);
    const shadow = accumulate(old.b, neighbor.b, old.a);
    const prime = max(initialize, float(1).sub(step(.5, abs(tick.mod(256).sub(128)))));
    return vec4(mix(main, vec2(source.clamp(0, 1), 0), initialize),
      mix(shadow, vec2(source.clamp(0, 1), 0), prime));
  })();
  const quad = new QuadMesh(stepMaterial);
  const material = new MeshBasicNodeMaterial();
  material.depthTest = false; material.depthWrite = false; material.toneMapped = false;
  material.colorNode = Fn(() => {
    const st = uv(), pixel = floor(st.mul(screen));
    const state = result.sample(st);
    const [paper, blue, lime] = u.colors;
    const high = smoothstep(.74, .86, state.r);
    const mid = smoothstep(.08, .16, state.r).mul(float(1).sub(high));
    let base = mix(paper, paper.mul(.38), mid);
    base = mix(base, lime, high);
    // The rapidly flickering carrier belongs to the base, below the dithered shapes.
    const row = floor(st.y.mul(screen.y.div(2)));
    const rowPhase = hash(vec2(row.add(u.seed), tick));
    const scan = mix(.61, 1, smoothstep(.12, .85, rowPhase));
    const horizontal = mix(.84, 1, step(.5, fract(st.y.mul(screen.y.div(3)))));
    // No uniform vertical grille: short, seeded interruptions leave scanlines
    // legible without drawing a rectangular lattice across the entire image.
    const nick = step(.975, hash(vec2(pixel.x.add(u.seed), floor(pixel.y.div(11)))));
    const carrier = mix(scan.mul(horizontal).mul(float(1).sub(nick.mul(.15))), mix(.88, 1, scan), high);
    base = base.mul(carrier);
    // Long-lived difference regions: the envelope moves coherently; only its
    // coverage is dithered. The dot lattice itself is stationary.
    const mask = smoothstep(.025, .18, state.g).mul(u.intensity).clamp(0, 1);
    // A fixed stochastic threshold has no tiled Bayer cell and does not
    // animate independently of the shape covering it.
    const rank = pixel.x.add(pixel.y).mod(2).mul(2).add(pixel.y.mod(2)).div(4);
    const threshold = fract(rank.add(hash(floor(pixel.div(2)).add(vec2(u.seed.mul(37), u.seed.mul(13))))));
    const dots = step(threshold, mask);
    return mix(base, blue, dots).max(vec3(0));
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
      const ratio = Math.min(1, 384 / Math.max(width, height));
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
      if (seed !== evolutionSeed) { evolutionSeed = seed; evolution = createLcdEvolution(seed); }
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
          birthA.value.set(...score.renewalA[0]); birthShapeA.value.set(...score.renewalA[1]);
          birthB.value.set(...score.renewalB[0]); birthShapeB.value.set(...score.renewalB[1]);
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
    environment() { return { simulation: 'fixed 60 Hz feedback', feedbackWidth: dimensions.value.x,
      feedbackHeight: dimensions.value.y, maxReplaySteps: epochFrames + primingFrames }; },
  };
}
