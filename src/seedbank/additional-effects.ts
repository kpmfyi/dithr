import type { Node } from 'three/webgpu';
import { abs, cos, exp, float, floor, fract, fwidth, length, max, min, mix, sin, smoothstep, vec2, vec3 } from 'three/tsl';
import type { Family } from './recipes';

type Scalar = Node<'float'>;
type Point = Node<'vec2'>;
type Color = Node<'vec3'>;

// Smooth, seeded value noise shared by the organic studies. Four bounded
// octaves: no feedback buffers, hidden state, source images, or wall clock.
function hash(p: Point): Scalar {
  return fract(sin(p.dot(vec2(127.1, 311.7))).mul(43758.5453));
}
function noise(p: Point): Scalar {
  const cell = floor(p), f = fract(p);
  const u = f.mul(f).mul(vec2(3).sub(f.mul(2)));
  return mix(mix(hash(cell), hash(cell.add(vec2(1, 0))), u.x), mix(hash(cell.add(vec2(0, 1))), hash(cell.add(vec2(1, 1))), u.x), u.y);
}
function fbm(p: Point): Scalar {
  return noise(p).mul(.55).add(noise(p.mul(2.03).add(7.1)).mul(.27))
    .add(noise(p.mul(4.09).add(19.3)).mul(.13)).add(noise(p.mul(8.17).add(31.7)).mul(.05));
}
function rotate(p: Point, a: Scalar): Point {
  return vec2(p.x.mul(cos(a)).sub(p.y.mul(sin(a))), p.x.mul(sin(a)).add(p.y.mul(cos(a))));
}
const aaLine = (distance: Scalar, width: Scalar): Scalar => {
  const aa = fwidth(distance).max(.001);
  return float(1).sub(smoothstep(width.sub(aa), width.add(aa), distance));
};

/** Twelve original, bounded TSL studies added in generator 1.1.0. */
export function additionalColor(
  family: Family, p: Point, t: Scalar, seed: Scalar,
  scale: Scalar, intensity: Scalar, detail: Scalar, colors: Color[],
): Color {
  const [dark, mid, bright] = colors;
  const offset = vec2(seed.mul(.73), seed.mul(.41));
  const q = p.mul(scale).add(offset);

  if (family === 'ink') {
    const drift = vec2(t.mul(.14), t.mul(-.11));
    const turbulence = fbm(q.mul(2).add(drift));
    const center = vec2(sin(t.mul(.5).add(seed)).mul(.1), cos(t.mul(.4).add(seed)).mul(.06));
    const radius = length(p.sub(center).mul(vec2(1, 1.13)));
    const edge = radius.sub(.26).add(turbulence.sub(.5).mul(mix(.12, .42, detail)));
    const wash = float(1).sub(smoothstep(-.035, .13, edge));
    const pigment = float(1).sub(smoothstep(-.1, .03, edge));
    const pools = fbm(q.mul(2.8).add(vec2(t.mul(.18), 4))).mul(.35).add(.55);
    const tendrils = exp(abs(edge).mul(-65)).mul(.14);
    return mix(mix(dark, mid, wash.mul(.65)), bright, pigment.mul(pools).mul(intensity).clamp(0, 1)).sub(mid.mul(tendrils)).max(0);
  }
  if (family === 'iridescence') {
    const folded = sin(q.x.mul(1.5).add(t)).add(cos(q.y.mul(1.4).sub(t.mul(.6)))).mul(.5);
    const thickness = folded.add(sin(length(q.sub(offset)).mul(1.7).sub(t)).mul(.3));
    const phase = thickness.mul(mix(3, 12, detail)).add(seed.mul(.3));
    const a = cos(phase).mul(.5).add(.5);
    const b = cos(phase.add(2.1)).mul(.5).add(.5);
    const pearl = mix(mix(dark, mid, a), bright, b.mul(.75));
    const glint = exp(abs(sin(phase.mul(.5).add(.8))).mul(-18)).mul(.24);
    return pearl.mul(intensity).add(vec3(glint)).mul(float(1).sub(length(p).mul(.24)));
  }
  if (family === 'shafts') {
    const slant = p.x.add(p.y.mul(.58));
    const wave = slant.mul(scale.mul(2.7)).add(seed).add(sin(p.y.mul(2).sub(t.mul(.3))).mul(.2));
    const beams = sin(wave).mul(.5).add(.5).pow(9).add(sin(wave.mul(1.91).add(1.7)).mul(.5).add(.5).pow(16).mul(.45));
    const haze = fbm(q.mul(.9).add(vec2(t.mul(.13), t.mul(-.08))));
    const depth = float(1).sub(p.y.add(.5).mul(.58));
    const ray = beams.mul(depth).mul(mix(.9, .45, haze)).mul(intensity);
    const glow = haze.mul(detail).mul(.18);
    return mix(dark, mid, glow.add(.035)).add(bright.mul(ray.mul(.7)));
  }
  if (family === 'aurora') {
    const x = p.x.mul(scale);
    const curl = sin(x.mul(1.4).add(seed).add(t.mul(.7))).mul(.095)
      .add(sin(x.mul(3.1).sub(t.mul(.4))).mul(.038));
    const height = p.y.sub(curl).add(.13);
    const rim = exp(abs(height).mul(-38));
    const rising = smoothstep(-.02, .025, height).mul(exp(max(height, 0).mul(-5.2)));
    const folds = sin(x.mul(mix(14, 42, detail)).add(sin(x.mul(5).add(t)).mul(4))).mul(.3).add(.7);
    const color = mix(mid, bright, sin(x.add(t)).mul(.24).add(.6));
    const light = color.mul(rising.mul(folds).mul(.5)).add(bright.mul(rim.mul(.45)));
    return dark.add(light.mul(intensity)).mul(float(1).sub(abs(p.x).mul(.16)));
  }
  if (family === 'moire') {
    const a = rotate(p, t.mul(.09).add(seed.mul(.012)));
    const b = rotate(p, t.mul(-.075).add(detail.mul(.6)).add(.18));
    const frequency = scale.mul(32);
    const screen1 = sin(a.x.mul(frequency).add(seed));
    const screen2 = sin(b.x.mul(frequency).add(t.mul(.4)).add(seed));
    const w = mix(.02, .32, detail);
    const ink1 = smoothstep(w.negate(), w, screen1);
    const ink2 = smoothstep(w.negate(), w, screen2);
    return mix(mix(dark, mid, ink1.mul(.8)), bright, ink2.mul(.83)).mul(intensity);
  }
  if (family === 'contours') {
    const land = fbm(q.mul(.85).add(vec2(t.mul(.09), sin(t.mul(.17)).mul(.3))));
    const layers = mix(6, 22, detail);
    const steps = land.mul(layers);
    const line = aaLine(abs(fract(steps).sub(.5)), float(.055));
    const elevation = floor(steps).div(layers).clamp(0, 1);
    const terrain = mix(dark, mid, elevation.mul(1.1)).mul(intensity);
    return mix(terrain, bright, line.mul(.75));
  }
  if (family === 'weave') {
    const cloth = p.mul(scale.mul(7)).add(vec2(seed, seed.mul(.3)))
      .add(vec2(sin(p.y.mul(7).add(t)).mul(.24), sin(p.x.mul(5).sub(t.mul(.6))).mul(.2)));
    const cell = floor(cloth), f = fract(cloth).sub(.5);
    const parity = fract(cell.x.add(cell.y).mul(.5)).mul(2);
    const width = mix(.22, .47, detail);
    const warp = aaLine(abs(f.x), width);
    const weft = aaLine(abs(f.y), width);
    const warpColor = mid.mul(cos(f.x.mul(3.14)).mul(.55).add(.4));
    const weftColor = bright.mul(cos(f.y.mul(3.14)).mul(.55).add(.4));
    const underWarp = mix(mix(dark, warpColor, warp), weftColor, weft);
    const overWarp = mix(mix(dark, weftColor, weft), warpColor, warp);
    const sheen = sin(p.x.mul(6).add(p.y.mul(4)).sub(t)).mul(.15).add(.85);
    return mix(underWarp, overWarp, parity).mul(sheen).mul(intensity);
  }
  if (family === 'dunes') {
    const diagonal = p.x.mul(.8).add(p.y.mul(1.2));
    const bend = sin(p.x.mul(3.2).add(seed)).mul(.7).add(sin(p.y.mul(4).sub(t.mul(.2))).mul(.2));
    const phase = diagonal.mul(scale.mul(3.5)).add(bend).sub(t.mul(.32));
    const ridge = sin(phase).mul(.5).add(.5);
    const slope = ridge.pow(.45);
    const crest = exp(abs(cos(phase)).mul(-24)).mul(.16);
    const ripples = sin(phase.mul(12).add(sin(q.x.mul(2)).mul(.5))).mul(detail).mul(.065);
    return mix(dark, mid, slope).add(bright.mul(crest.add(ripples).add(.06))).mul(intensity);
  }
  if (family === 'ripples') {
    const c1 = vec2(sin(seed).mul(.28), cos(seed.mul(.7)).mul(.23));
    const c2 = vec2(.32, -.17), c3 = vec2(-.38, .25);
    const r1 = length(p.sub(c1)), r2 = length(p.sub(c2)), r3 = length(p.sub(c3));
    const frequency = scale.mul(9);
    const waves = sin(r1.mul(frequency).sub(t.mul(3.2))).div(r1.mul(3).add(1))
      .add(sin(r2.mul(frequency.mul(1.07)).sub(t.mul(2.9)).add(seed)).div(r2.mul(3).add(1)).mul(.7))
      .add(sin(r3.mul(frequency.mul(.93)).sub(t.mul(3.4))).div(r3.mul(3).add(1)).mul(.5));
    const tone = waves.mul(.28).add(.48).clamp(0, 1);
    const specular = tone.pow(mix(3, 12, detail));
    return mix(dark, mid, tone).add(bright.mul(specular).mul(intensity));
  }
  if (family === 'starfield') {
    const nebula = fbm(q.mul(.7).add(vec2(t.mul(.07), 0))).pow(3);
    const result = dark.add(mid.mul(nebula).mul(.17)).toVar();
    // Three parallax planes. Stars remain inside their cells so tiling is continuous.
    for (let layer = 0; layer < 3; layer++) {
      const stars = p.mul(scale.mul(2.5 + layer * 2)).add(offset).add(vec2(t.mul(.1 + layer * .06), t.mul(.025)));
      const cell = floor(stars), f = fract(stars);
      const h = hash(cell.add(layer * 19));
      const center = vec2(h, hash(cell.add(47.7))).mul(.5).add(.25);
      const delta = abs(f.sub(center));
      const radius = mix(.012, .035, h).mul(1 + layer * .15);
      const core = exp(delta.dot(delta).div(radius.mul(radius)).negate());
      const halo = exp(length(delta).mul(-12)).mul(detail).mul(.14);
      const cross = exp(delta.x.mul(-130)).mul(exp(delta.y.mul(-18))).add(exp(delta.y.mul(-130)).mul(exp(delta.x.mul(-18)))).mul(.13);
      const twinkle = sin(t.mul(1.3).add(h.mul(30))).mul(.25).add(.75);
      result.addAssign(mix(mid, bright, h.mul(.4).add(.6)).mul(core.add(halo).add(cross)).mul(twinkle).mul(intensity).mul(.8));
    }
    return result;
  }
  if (family === 'marble') {
    const flow = vec2(fbm(q.add(vec2(t.mul(.14), 0))), fbm(q.add(vec2(8.3, t.mul(-.1)))));
    const bent = q.add(flow.mul(3.5));
    const layer = sin(bent.x.mul(2.4).add(bent.y.mul(1.7)).add(fbm(bent.mul(1.5)).mul(6)));
    const body = smoothstep(-.8, .65, layer);
    const vein = exp(abs(layer.sub(.25)).mul(mix(-12, -65, detail)));
    return mix(mix(dark, mid, body.mul(.82)), bright, vein.mul(.8)).mul(intensity);
  }
  if (family === 'glass') {
    const glass = q.mul(1.6), cell = floor(glass), f = fract(glass);
    const nearest = float(10).toVar(), second = float(10).toVar(), pane = float(0).toVar();
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      const neighbor = vec2(x, y), id = cell.add(neighbor);
      const h = hash(id), phase = vec2(h, hash(id.add(19.1))).mul(6.283);
      const site = neighbor.add(vec2(.5).add(sin(phase.add(t.mul(.55))).mul(.32)));
      const d = length(site.sub(f));
      const closer = d.lessThan(nearest);
      pane.assign(closer.select(h, pane));
      second.assign(closer.select(nearest, min(second, d)));
      nearest.assign(min(nearest, d));
    }
    const edge = second.sub(nearest);
    const seam = aaLine(edge, mix(.012, .11, detail));
    const tint = mix(mid, bright, pane);
    const bevel = exp(edge.mul(-13)).mul(.17);
    const lighting = float(.9).sub(nearest.mul(.35));
    return mix(tint.mul(lighting).add(bright.mul(bevel)), dark, seam).mul(intensity);
  }
  throw new Error(`Missing shader implementation: ${family}`);
}
