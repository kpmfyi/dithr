import { Loop, abs, float, floor, fract, int, length, max, min, mix, smoothstep, step, vec2, vec3 } from 'three/tsl';
import { bayer, cellHash, choose, createKitStudy, noise, ramp, steps, type KitGraph, type KitInputs, type Point, type Quad, type Scalar } from './kit';
import type { MatterFamily } from './matter-meta';
import { matterControls, matterSalt } from './matter-evolution';



const equalish = (a: Scalar, b: Scalar | number) => float(1).sub(step(.5, abs(a.sub(b))));
/** F2 − F1 of jittered cells whose points wander with a bounded offset: thin edges. */
function cellEdges(p: Point, wander: Point): Scalar {
  const base = floor(p);
  let f1: Scalar = float(8), f2: Scalar = float(8);
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
    const cell = base.add(vec2(dx, dy));
    const jitter = vec2(noise(cell.mul(.37).add(wander)), noise(cell.mul(.37).add(wander.yx).add(7.1))).sub(.5).mul(1.3);
    const d = length(p.sub(cell.add(.5).add(jitter)));
    f2 = min(f2, max(f1, d)); f1 = min(f1, d);
  }
  return f2.sub(f1);
}

/** 81 Ripple. A damped leapfrog wave equation: R = height, G = previous height.
 * Drops land in hashed 16-pixel cells (never across a cell edge) and showers
 * follow event footprints. The update has unit-modulus eigenvalues scaled by
 * the damping, so lane differences shrink by 0.962¹²⁸ ≈ 0.007 before a handoff.
 * The display refracts a tiled floor through the height gradient and marks
 * focusing (negative curvature) as hard caustic pixels. */
const ripple = (): KitGraph => {
  return {
    maxEdge: 320, environment: 'damped wave equation; refracted tile floor and curvature caustics',
    step: ({ u, pixel, carrier, control, local, at }) => {
      const size = 16;
      const id = floor(pixel.div(size));
      const shower = smoothstep(.2, .7, local.peak).mul(.012);
      const rate = mix(.0008, .007, u.detail).mul(control.x.mul(1.4).add(.3)).add(shower);
      const fire = step(cellHash(id, carrier.add(11)), rate);
      const centre = id.mul(size).add(5.5).add(vec2(cellHash(id, carrier.add(23)), cellHash(id, carrier.add(37))).mul(size - 11));
      const radius = cellHash(id, carrier.add(51)).mul(2).add(2.8);
      const fall = float(1).sub(length(pixel.add(.5).sub(centre)).div(radius)).max(0);
      const drop = fire.mul(fall.mul(fall));
      return {
        evolve: lane => {
          const here = lane(at(vec2(0))), n = lane(at(vec2(0, 1))), s = lane(at(vec2(0, -1))), e = lane(at(vec2(1, 0))), w = lane(at(vec2(-1, 0)));
          const next = n.x.add(s.x).add(e.x).add(w.x).mul(.5).sub(here.y).mul(.962).sub(drop.mul(u.intensity.mul(.4).add(.5)));
          return vec2(next.clamp(-2, 2), here.x);
        },
        seed: vec2(0, 0),
      };
    },
    display: ({ cell, state, sample, threshold, role, u, control }) => {
      const h = (x: number, y: number) => x === 0 && y === 0 ? state.r : sample(vec2(x, y)).x;
      const c = h(0, 0), e = h(1, 0), w = h(-1, 0), n = h(0, 1), s = h(0, -1);
      // The pool floor: large tiles with soft grout and one lane stripe per
      // ten tiles, refracted through the wave gradient plus a slow swell.
      const swell = cell.mul(.026).add(control.zw);
      const gradient = vec2(e.sub(w), n.sub(s));
      const bend = gradient.mul(u.intensity.mul(6).add(8)).add(vec2(noise(swell), noise(swell.add(9))).sub(.5).mul(5));
      const floorPoint = floor(cell.add(bend));
      const tile = floor(mix(30, 7, u.scale.sub(1).div(11).clamp(0, 1).sqrt()).add(.5));
      const index = floor(floorPoint.div(tile)), within = floorPoint.sub(index.mul(tile));
      const grout = max(equalish(within.x, 0), equalish(within.y, 0));
      const lane = equalish(index.y.mod(10), 5).mul(step(1.5, within.y)).mul(step(within.y, tile.sub(2.5)));
      const floorColor = mix(mix(role(0), role(3), grout), role(2), lane);
      // Caustic net: warped, uneven Voronoi edges of wandering focal cells.
      const netPoint = cell.add(bend.mul(.6)).mul(mix(.028, .07, u.detail));
      const warped = netPoint.add(vec2(noise(netPoint.mul(1.9).add(control.wz)), noise(netPoint.mul(1.9).sub(control.zw))).sub(.5).mul(.9));
      const net = cellEdges(warped, control.zw);
      const width = noise(netPoint.mul(2.7).add(control.zw.mul(.5))).mul(.06).add(.006);
      const curvature = e.add(w).add(n).add(s).sub(c.mul(4)).negate();
      const focus = max(smoothstep(.03, .1, curvature), float(1).sub(smoothstep(width, width.add(.03), net)).mul(.92));
      const caustic = step(threshold, focus.mul(u.intensity.mul(.25).add(.8)));
      // Crests catch light; troughs read as dark crescents: the rings stay legible.
      const crest = step(threshold, smoothstep(.06, .2, c));
      const trough = step(threshold, smoothstep(.06, .2, c.negate())).mul(float(1).sub(caustic));
      return mix(mix(mix(floorColor, role(1), caustic), role(2), trough.mul(.999)), role(4), crest);
    },
  };
};

/** 90 Smoke. Thin plumes rise two rows per frame from wandering sources; a
 * divergence-free curl field (finite differences of a drifting potential)
 * grows with height, stochastic rounding keeps sub-pixel drift crisp, and
 * random-neighbour spreading thins the tops into dithered haze. The bottom rows
 * are always rewritten from the sources and nothing moves down, so every cell
 * depends only on the last ≤128 frames at the 256-cell height limit; decay adds
 * contraction for taller portrait panels. */
const smoke = (): KitGraph => ({
  maxEdge: 256, dither: 'cell', environment: 'rising curl-advected plumes with stochastic rounding',
  step: ({ u, st, pixel, dimensions, control, control2, local, coin, at, domain, s }) => {
    const height = st.y;
    // Up to four sources wander along the base; detail adds sources and turbulence.
    const sources = [control.x, control.y, control.z, control.w];
    let emit: Scalar = float(0);
    sources.forEach((x, i) => {
      const live = i < 2 ? float(1) : step(float(i - 1.5).mul(.5), u.detail);
      const width = mix(1.6, 3.4, noise(vec2(float(i * 7), control2.x.mul(.3))));
      const puff = smoothstep(.25, .6, noise(vec2(control2.y.add(i * 3.1), float(i))));
      const near = step(abs(pixel.x.add(.5).sub(x.mul(dimensions.x))), width);
      emit = max(emit, near.mul(live).mul(puff.mul(.45).add(.55)));
    });
    const base = float(1).sub(step(2.5, pixel.y));
    // Curl of a drifting potential: laminar at the base, turbulent above.
    const potential = (p: Point) => noise(p.mul(mix(1.1, 2.2, u.detail))).add(noise(p.mul(3.3).add(s)).mul(.35));
    const e = .04;
    const curl = vec2(potential(domain.add(vec2(0, e))).sub(potential(domain.sub(vec2(0, e)))),
      potential(domain.sub(vec2(e, 0))).sub(potential(domain.add(vec2(e, 0))))).div(e * 2);
    const strength = height.pow(1.1).mul(mix(1.2, 3.4, u.detail)).mul(u.intensity.mul(.3).add(.7)).add(local.peak.mul(1.2));
    const drift = curl.mul(strength).add(vec2(control2.z.sub(.5).mul(2.2).mul(height), 0));
    const lateral = floor(drift.x.clamp(-2.2, 2.2).add(coin(3)));
    const lift = float(2).add(floor(drift.y.mul(.4).add(coin(5))).clamp(0, 1));
    // Probabilistic dilation widens plumes with height, so they billow into haze.
    const billow = step(coin(7), height.mul(.5).add(.04));
    const decay = mix(.994, .962, height);
    return {
      evolve: lane => {
        const from = vec2(lateral.negate(), lift.negate());
        const centre = lane(at(from)), left = lane(at(from.sub(vec2(1, 0)))), right = lane(at(from.add(vec2(1, 0))));
        const spread = max(centre.x, max(left.x, right.x).mul(.93));
        const density = mix(mix(centre.x, spread, billow).mul(decay), emit, base).clamp(0, 1);
        const here = lane(at(vec2(0)));
        return vec2(density, mix(here.y, abs(density.sub(here.x)), .08).clamp(0, 1));
      },
      seed: vec2(0, 0),
    };
  },
  display: ({ state, cell, role, count, u }) => {
    const density = state.r.mul(u.intensity.mul(.35).add(.75)).pow(.8);
    return steps(density, ramp(role, count), bayer(cell, 4), .95);
  },
});

/** Piecewise-linear value noise in one dimension: hard jagged segments. */
const jag = (x: Scalar, salt: Scalar) => {
  const i = floor(x);
  return mix(cellHash(vec2(i.add(4096), salt), 71), cellHash(vec2(i.add(4097), salt), 71), fract(x));
};
/** 85 Lightning. Each bolt is evaluated per cell as a jagged path x(y) (three
 * octaves of piecewise-linear noise) plus four branches with their own slopes.
 * A cell lights if it lies between the path at its row and the next row, so
 * steep segments never gap. Two unrelated slot clocks schedule strikes with
 * return-stroke flicker; R keeps the brightest light and decays by ×0.95 per
 * frame (0.95¹²⁸ ≈ 1e-3) and G keeps a ×0.982 ghost of recent strokes
 * (0.982¹²⁸ ≈ 0.1 of a ghost that starts at 0.8, below the 0.08 display floor
 * after dithering), so both lanes agree before the handoff. */
const lightning = (): KitGraph => ({
  maxEdge: 320, environment: 'procedural branching bolts, stepped afterglow and ghost memory',
  step: ({ u, pixel, dimensions, control, control2, at, domain, field }) => {
    const bolt = (c: Quad) => {
      const top = dimensions.y.add(2), seed = c.z;
      const end = mix(dimensions.y.mul(.42), float(-2), step(.35, cellHash(vec2(seed, 5), 13)));
      // Scale shortens the jag segments: higher values give a more nervous, finer bolt.
      const pitch = u.scale.div(2.6).clamp(.4, 3.5);
      const path = (y: Scalar, salt: Scalar, scale: Scalar) => jag(y.mul(pitch).div(38), salt).sub(.5).mul(scale.mul(34))
        .add(jag(y.mul(pitch).div(11), salt.add(1)).sub(.5).mul(scale.mul(12))).add(jag(y.mul(pitch).div(3.5), salt.add(2)).sub(.5).mul(scale.mul(4)));
      const main = (y: Scalar) => mix(c.x, c.y, top.sub(y).div(top.sub(end)).clamp(0, 1)).mul(dimensions.x).add(path(y, seed, float(1)));
      const on = (x0: Scalar, x1: Scalar, width: number) => step(min(x0, x1).sub(width), pixel.x).mul(step(pixel.x, max(x0, x1).add(width)));
      const within = step(end, pixel.y).mul(step(pixel.y, top));
      let light: Scalar = on(main(pixel.y), main(pixel.y.add(1)), .9).mul(within);
      let halo: Scalar = on(main(pixel.y), main(pixel.y.add(1)), 3.5).mul(within);
      for (let j = 0; j < 4; j++) {
        const h = (k: number) => cellHash(vec2(seed, j * 7 + k), 29);
        const startY = mix(end.add(10), top.sub(10), h(1).mul(.8).add(.1));
        const length = dimensions.y.mul(mix(.06, .28, h(2))).mul(u.detail.mul(.8).add(.4));
        const slope = h(3).sub(.5).mul(2.4);
        const salt = seed.add(j * 13 + 17);
        const branch = (y: Scalar) => main(startY).add(startY.sub(y).mul(slope)).add(path(y, salt, float(.45)));
        const span = step(startY.sub(length), pixel.y).mul(step(pixel.y, startY)).mul(step(j - .5, u.detail.mul(4.5)));
        light = max(light, on(branch(pixel.y), branch(pixel.y.add(1)), .45).mul(span).mul(.85));
        halo = max(halo, on(branch(pixel.y), branch(pixel.y.add(1)), 2).mul(span).mul(.7));
      }
      return { light: light.mul(c.w), halo: halo.mul(c.w) };
    };
    const a = bolt(control), b = bolt(control2);
    const strike = max(a.light, b.light), glow = max(a.halo, b.halo).mul(.55);
    // The cloud deck: a ragged band along the top, lit by any active stroke.
    const flash = max(control.w, control2.w);
    const cloud = smoothstep(.5, .62, field.mul(.7).add(noise(domain.mul(2.6)).mul(.3)).add(pixel.y.div(dimensions.y).sub(.74).mul(1.8)));
    const deck = cloud.mul(mix(.2, .44, flash));
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        // R: light with a stepped ×0.95 afterglow. G: a slower ×0.982 ghost of recent strokes.
        const light = max(max(strike, glow), max(deck, here.x.mul(.95)));
        return vec2(light.clamp(0, 1), max(strike.mul(.8), here.y.mul(.982)));
      },
      seed: vec2(0, 0),
    };
  },
  display: ({ state, threshold, cell, role, u }) => {
    // Order chosen for light: core → ink, inner halo → trace, afterglow → accent, lit cloud → body.
    const levels = [role(0), role(3), role(1), role(4), role(2)];
    const index = floor(state.r.mul(4.6).add(bayer(cell, 4).sub(.5).mul(.8))).clamp(0, 4);
    const ghost = step(threshold, smoothstep(.08, .4, state.g).mul(u.intensity.mul(.5).add(.45))).mul(step(index, 1.5));
    return mix(choose(index, levels), role(1), ghost);
  },
});

/** Value noise that repeats every `period` cells in x, so scroll offsets can wrap. */
function periodicNoise(p: Point, period: number | Scalar): Scalar {
  const cell = floor(p), f = fract(p);
  const eased = f.mul(f).mul(vec2(3).sub(f.mul(2)));
  const at = (dx: number, dy: number) => cellHash(vec2(cell.x.add(dx).mod(period).add(period), cell.y.add(dy).add(4096)), 83);
  return mix(mix(at(0, 0), at(1, 0), eased.x), mix(at(0, 1), at(1, 1), eased.x), eased.y);
}
const CLOUD_PERIOD = 256;
/** 88 Cumulus. Three parallax layers of flat-based cumulus in chunky pixel-art
 * cells. Each layer is x-periodic noise shaped by a bump over its base line;
 * occlusion toward the sun picks lit, mid and shadow roles and a warm rim, and
 * Bayer thresholds step the edges. Offsets wrap exactly on the noise period,
 * so drift is monotone yet bounded. R stores a role index each frame (full
 * rewrite); G is a wisp trail shed downwind with ×0.9 decay. */
const cumulus = (): KitGraph => ({
  maxEdge: 176, dither: 'cell', environment: 'parallax pixel-art cloud layers; Bayer-stepped edges and sun shading',
  step: ({ u, st, pixel, control, control2, at }) => {
    const x = st.x.mul(u.aspect), y = st.y;
    const order = bayer(pixel, 4);
    // Strict comparison so a zero Bayer cell never leaks a dot into flat areas.
    const below = (value: Scalar) => step(order.add(.001), value);
    const sun = vec2(control2.x.mul(u.aspect), control2.y);
    const light = sun.sub(vec2(x, y)).normalize();
    // Sky: ground, with a dithered body haze band toward the horizon.
    let index: Scalar = below(smoothstep(.3, .0, y).mul(.75)).mul(3);
    const toSun = length(vec2(x, y).sub(sun));
    index = mix(index, float(1), max(step(toSun, .07), below(smoothstep(.15, .075, toSun).mul(.55))));
    const size = u.scale.div(2.6).clamp(.4, 4);
    const layers = [
      { base: .64, cellWidth: .04, scroll: control.x, lit: 4, mid: 4, shade: 3 },
      { base: .38, cellWidth: .062, scroll: control.y, lit: 2, mid: 4, shade: 3 },
      { base: .04, cellWidth: .1, scroll: control.z, lit: 2, mid: 2, shade: 3 },
    ];
    let rimTrail: Scalar = float(0);
    layers.forEach((layer, i) => {
      const width = float(layer.cellWidth).div(size);
      const cover = mix(.6, .32, u.detail).add(control2.w.sub(.5).mul(.14));
      // Isotropic cell units. Round lobes sit on a lattice that repeats every 256
      // cells, the wrap of the scroll offset; a second tier piles smaller lobes on top.
      const inside = (px: Scalar, py: Scalar) => {
        const X = px.div(width).add(layer.scroll), Y = py.sub(layer.base).div(width);
        const base = floor(X);
        let best: Scalar = float(-1);
        for (const d of [-1, 0, 1]) {
          const cell = base.add(d), id = cell.mod(CLOUD_PERIOD).add(CLOUD_PERIOD);
          // Presence grows and shrinks lobes smoothly as cover drifts; radii breathe.
          const grow = smoothstep(cover, cover.add(.16), periodicNoise(vec2(id.mul(.25), float(i * 13 + 1)), CLOUD_PERIOD / 4));
          const present = step(.02, grow);
          const h = (salt: number) => cellHash(vec2(id, float(i * 31 + salt)), 211);
          const breathe = noise(vec2(id.mul(.61), control.w.mul(1.7).add(i * 5))).mul(.35).add(.8);
          // Normalise by the unscaled radius: a shrinking lobe never divides by zero.
          const full = mix(.7, 1.2, h(1)), r1 = full.mul(grow).mul(breathe), c1 = vec2(cell.add(.5).add(h(2).sub(.5).mul(.5)), r1.mul(.5));
          const r2 = r1.mul(mix(.55, .85, h(3))), c2 = c1.add(vec2(h(4).sub(.5).mul(.7), r1.mul(.85)));
          const lobe1 = r1.sub(length(vec2(X, Y).sub(c1))).div(full);
          const lobe2 = r2.sub(length(vec2(X, Y).sub(c2))).div(full.mul(.7)).sub(step(h(5), .22).mul(9));
          best = max(best, max(lobe1, lobe2).mul(present).sub(float(1).sub(present).mul(2)));
        }
        return min(best, Y.mul(2));
      };
      const here = inside(x, y);
      const cloud = step(0, here.add(order.sub(.5).mul(.12)));
      const reach = width.mul(.55);
      const occluded = step(0, inside(x.add(light.x.mul(reach)), y.add(light.y.mul(reach))))
        .add(step(0, inside(x.add(light.x.mul(reach.mul(2))), y.add(light.y.mul(reach.mul(2))))));
      const shade = occluded.mul(.5).mul(u.intensity.mul(.35).add(.75)).add(smoothstep(.5, 0, y.sub(layer.base).div(width)).mul(.5));
      const tone = mix(mix(float(layer.lit), float(layer.mid), below(smoothstep(.2, .55, shade))), float(layer.shade), below(smoothstep(.5, .9, shade)));
      const rim = step(.5, float(i)).mul(step(here, .14)).mul(step(occluded, .5)).mul(below(u.intensity.mul(.5)));
      index = mix(index, mix(tone, float(1), rim), cloud);
      rimTrail = max(rimTrail, rim.mul(cloud));
    });
    const wind = vec2(float(1).sub(step(control2.z, .5).mul(2)), 0);
    return {
      evolve: lane => {
        const trailed = lane(at(wind.negate()));
        return vec2(index.div(4), max(rimTrail.mul(.9), trailed.y.mul(.9)));
      },
      seed: vec2(index.div(4), 0),
    };
  },
  display: ({ state, role }) => {
    const index = floor(state.r.mul(4).add(.5));
    const colors = [role(0), role(1), role(2), role(3), role(4)];
    return choose(index, colors);
  },
});

/** 84 Borealis. Two folding curtains: each has a jagged lower edge that is its
 * brightest line, light decaying upward, fine vertical rays and seams where the
 * curve turns steeply (a fold seen edge-on). Pulses travel along x on a wrapped
 * periodic phase. R keeps the brighter of the new light and the old light one
 * row lower × 0.9, so rays shimmer upward and fade; 0.9¹²⁸ ≈ 1e-6. */
const borealis = (): KitGraph => ({
  maxEdge: 288, environment: 'folding ray curtains with upward shimmer; stepped palette ramp',
  step: ({ u, st, dimensions, control, control2, at, local }) => {
    const x = st.x.mul(u.aspect), y = st.y;
    const size = u.scale.div(2.6).clamp(.4, 4);
    let light: Scalar = float(0);
    [{ base: control2.y.mul(.3).add(.16), amp: .16, freq: 1.1, height: .34, salt: 1 }, { base: control2.z.mul(.3).add(.38), amp: .12, freq: 1.7, height: .26, salt: 2 }].forEach((curtain, j) => {
      const X = x.mul(size).mul(curtain.freq);
      const curve = (px: Scalar) => periodicNoise(vec2(px.add(control.x.mul(j + 1)), float(curtain.salt)), 64).mul(.75)
        .add(periodicNoise(vec2(px.mul(3.1).add(control.y.mul(2)), float(curtain.salt + 5)), 64).mul(.25));
      const edge = curtain.base.add(curve(X).sub(.5).mul(curtain.amp * 2).mul(control2.x.mul(.8).add(.6)));
      const slope = abs(curve(X.add(.02)).sub(curve(X.sub(.02)))).mul(25);
      const above = y.sub(edge);
      const falloff = float(1).sub(above.div(curtain.height * 1.0).clamp(0, 1)).pow(1.6).mul(step(0, above));
      // Rays: fine vertical striations, slightly tilted, drifting sideways.
      const rayX = x.mul(size).mul(mix(22, 60, u.detail)).add(above.mul(3)).add(control.w.mul(4 + j));
      const rays = periodicNoise(vec2(rayX, float(j * 7 + 3)), 64).mul(.6).add(periodicNoise(vec2(rayX.mul(2), float(j * 7 + 4)), 128).mul(.4));
      const pulse = smoothstep(.35, .8, periodicNoise(vec2(X.mul(.8).sub(control.z), float(j + 9)), 64));
      const brightEdge = step(0, above).mul(step(above, float(3).div(dimensions.y)));
      const curtainLight = falloff.mul(rays.mul(1.1).add(.05)).mul(pulse.mul(.7).add(.35)).add(brightEdge.mul(.55).mul(pulse.add(.4)))
        .add(falloff.mul(smoothstep(.5, 1.4, slope)).mul(.5));
      light = max(light, curtainLight.mul(u.intensity.mul(.45).add(.55)).mul(j === 0 ? 1 : .8));
    });
    light = light.add(local.peak.mul(.15).mul(step(.2, light)));
    return {
      evolve: lane => {
        const lower = lane(at(vec2(0, -1)));
        const glow = max(light, lower.x.mul(.9)).clamp(0, 1);
        return vec2(glow, 0);
      },
      seed: vec2(0, 0),
    };
  },
  display: ({ state, cell, role, count }) => {
    const glow = state.r;
    const lit = steps(glow.pow(.8), ramp(role, count), bayer(cell, 4), .9);
    // Sparse stationary stars, only when the ground itself reads as night sky.
    const dark = step(role(0).dot(vec3(.299, .587, .114)), .3);
    const star = step(.9965, cellHash(cell, 911)).mul(step(glow, .05)).mul(dark);
    return mix(lit, role(count >= 5 ? 4 : 2), star);
  },
});

const STRATA_BANDS = 4096;
/** 87 Strata. A cross-section: band coordinate = depth + folds + fault throws,
 * warped monotonically so thicknesses vary, then hashed (periodic over the
 * whole bands in the 3072 px sink wrap) into a role and a texture: solid, laminated, speckled, pebbled or
 * cross-bedded. The section sinks by whole pixels on a wrapped offset, faults
 * slip in short episodes, and an eroded surface opens to the sky. R stores a
 * role index; history rides the sinking offset and reverts to the target at
 * 30% per frame (0.7¹²⁸ ≈ 1e-20), G marks recent change as dust. */
const strata = (): KitGraph => ({
  maxEdge: 320, environment: 'folded, faulted, sinking sediment bands with per-band textures',
  step: ({ u, s, st, pixel, dimensions, control, control2, coin, at, local }) => {
    const x = st.x.mul(u.aspect);
    // The sink offset wraps every 3072 px. Quantise the band unit so 3072 px holds
    // a whole number of bands (a multiple of four): band ids, warp and textures
    // then repeat exactly at the wrap, and nothing resets.
    const bands = floor(float(3072).div(mix(10, 2.5, u.scale.sub(1).div(11).clamp(0, 1).sqrt())).div(4)).mul(4);
    const unit = float(3072).div(bands);
    // Folds: two octaves of noise along x; amplitude and phase are slow tracks.
    const fold = noise(vec2(x.mul(1.3).add(control.z), s)).sub(.5).mul(control.w.mul(70).add(12))
      .add(noise(vec2(x.mul(3.7).sub(control.z.mul(.6)), s.add(4))).sub(.5).mul(14));
    // Three steep faults fixed per seed; their throws slip in short episodes.
    let throwOffset: Scalar = float(0);
    let faultLine: Scalar = float(0);
    [control2.x, control2.y, control2.z].forEach((slip, k) => {
      const h = (salt: number) => cellHash(vec2(float(k * 17 + salt), s.mul(97)), 419);
      const angle = h(1).sub(.5).mul(.9);
      const side = x.sub(h(2).mul(u.aspect)).sub(st.y.sub(.5).mul(angle));
      throwOffset = throwOffset.add(step(0, side).mul(slip));
      faultLine = max(faultLine, step(abs(side).mul(dimensions.y), .7));
    });
    const depth = pixel.y.add(fold).add(throwOffset).add(control.x);
    const z = depth.div(unit);
    const warped = z.add(periodicNoise(vec2(z.mul(.25), float(3)), bands.mul(.25)).mul(2.2));
    const band = floor(warped), within = fract(warped);
    const id = band.mod(bands).add(STRATA_BANDS);
    const row = floor(within.mul(unit));
    const pick = (salt: number) => cellHash(vec2(id, float(salt)), 613);
    // Two colors alternate ground and accent bands; otherwise all five roles appear.
    const roleOf = (h: Scalar) => u.colors.length === 2 ? step(.45, h) : floor(h.mul(4.999)).clamp(0, 4);
    const main = roleOf(pick(1)), second = roleOf(pick(2));
    const texture = pick(3);
    // Whole laminae per band keep their phase when the band index wraps.
    const laminated = step(.5, fract(warped.mul(floor(mix(3, 7, u.detail).add(.5))))).mul(step(texture, .25));
    // Speckles are hashed in band coordinates, so they ride with the sinking section.
    const speckled = step(cellHash(vec2(pixel.x, row), id).mul(.6).add(.2), pick(4)).mul(step(.25, texture)).mul(step(texture, .45));
    const pebbleCell = floor(vec2(pixel.x, row).div(3));
    const pebbled = step(.62, cellHash(pebbleCell, id)).mul(step(.45, texture)).mul(step(texture, .62));
    const cross = step(.55, fract(pixel.x.add(within.mul(unit).mul(1.6)).div(mix(9, 4, u.detail)))).mul(step(.62, texture)).mul(step(texture, .78));
    const pattern = max(max(laminated, speckled), max(pebbled, cross));
    let index: Scalar = mix(main, second, pattern);
    // Eroded surface: above it, open ground (sky).
    const surface = dimensions.y.mul(float(.8).add(noise(vec2(x.mul(2.2).add(control.z.mul(.3)), s.add(9))).sub(.5).mul(.18)));
    index = mix(index, float(0), step(surface, pixel.y));
    const edge = equalish(pixel.y, floor(surface)).mul(1);
    index = mix(index, float(2), max(edge, faultLine.mul(step(pixel.y, surface)).mul(step(.5, u.intensity))));
    // Bands sink: a cell takes the history one row above when the offset steps.
    const velocity = vec2(0, control.y);
    return {
      evolve: lane => {
        const moved = lane(at(velocity)), here = lane(at(vec2(0)));
        const signal = mix(moved.x, index.div(4), step(coin(29), float(.3).add(local.peak.mul(.4))));
        return vec2(signal, mix(moved.y, abs(signal.sub(here.x)).mul(2).clamp(0, 1), .05));
      },
      seed: vec2(index.div(4), 0),
    };
  },
  display: ({ state, threshold, role, u }) => {
    const index = floor(state.r.mul(4).add(.5));
    const dust = step(threshold, smoothstep(.15, .5, state.g).mul(u.intensity).mul(.6));
    return mix(choose(index, [role(0), role(1), role(2), role(3), role(4)]), role(1), dust.mul(step(.5, index)));
  },
});

const AGATE_BANDS = 64;
/** Nearest jittered cell of a lattice: returns the distance gap (F2 − F1) and a cell id. */
function crystals(p: Point, salt: Scalar): { gap: Scalar; id: Scalar } {
  const base = floor(p);
  let f1: Scalar = float(8), f2: Scalar = float(8), id: Scalar = float(0);
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
    const cell = base.add(vec2(dx, dy));
    const point = cell.add(vec2(cellHash(cell.add(512), salt), cellHash(cell.add(1024), salt)).mul(.8).add(.1));
    const d = length(p.sub(point));
    const closer = step(d, f1);
    f2 = min(f2, max(f1, d)); id = mix(id, cellHash(cell.add(2048), salt), closer); f1 = min(f1, d);
  }
  return { gap: f2.sub(f1), id };
}
/** 82 Agate. Up to three wandering nodules with noisy radial boundaries. Inside,
 * zig-zag fortification bands flow inward on a wrapped phase (64-band period),
 * some micro-banded; the core is a druse of faceted crystals; a dark rind
 * separates the host rock, which carries stationary flecks. R stores a role
 * index that reverts to the target at 40% per frame (0.6¹²⁸ ≈ 4e-29); G marks
 * pixels that just changed, shown as sparse glints. */
const agate = (): KitGraph => ({
  maxEdge: 320, environment: 'banded nodules with inward-flowing fortification bands and druse cores',
  step: ({ u, s, st, pixel, control, control2, coin, at }) => {
    const p = st.sub(.5).mul(vec2(u.aspect, 1));
    const size = float(2.6).div(u.scale).clamp(.25, 2.6);
    const nodules = [vec2(control.x, control.y), vec2(control.z, control.w), vec2(control2.x, control2.y)];
    let best: Scalar = float(9), which: Scalar = float(0), angle: Scalar = float(0);
    nodules.forEach((centre, i) => {
      const offset = p.sub(centre.sub(.5).mul(vec2(u.aspect, 1)));
      const radius = mix(.2, .36, cellHash(vec2(float(i), s.mul(31)), 7)).mul(size).mul(i === 2 ? .8 : 1);
      const direction = offset.div(length(offset).max(.0001));
      const wobble = noise(direction.mul(1.4).add(vec2(float(i * 7), control2.w))).mul(.55).add(noise(direction.mul(3.3).add(float(i * 3))).mul(.25)).add(.55);
      const d = length(offset).div(radius.mul(wobble));
      const closer = step(d, best);
      which = mix(which, float(i), closer); angle = mix(angle, direction.y.atan(direction.x), closer); best = min(best, d);
    });
    const inside = step(best, 1);
    const depth = float(1).sub(best).clamp(0, 1);
    // Fortification: bands zig-zag with angle, then flow inward as the phase grows.
    const teeth = mix(8, 22, u.detail);
    const zig = abs(fract(angle.mul(teeth).div(6.2832)).sub(.5)).mul(.05);
    const count = mix(9, 24, u.detail);
    const b = depth.add(zig).mul(count).sub(control2.z);
    const warped = b.add(periodicNoise(vec2(b.mul(.5), which.add(3)), AGATE_BANDS / 2).mul(1.4));
    const band = floor(warped).mod(AGATE_BANDS).add(AGATE_BANDS);
    const h = (salt: number) => cellHash(vec2(band, which.mul(13).add(salt)), 733);
    const roleOf = (v: Scalar) => u.colors.length === 2 ? step(.5, v) : step(.15, v).add(step(.45, v).mul(2)).add(step(.65, v)).sub(step(.85, v).mul(2)).add(step(.85, v).mul(3)).clamp(0, 4);
    const micro = step(.62, h(2)).mul(step(.5, fract(warped.mul(5))));
    let index: Scalar = mix(roleOf(h(1)), roleOf(h(3)), micro);
    // Druse core: faceted crystals with ink seams.
    const coreStart = mix(.72, .86, cellHash(vec2(which, s.mul(17)), 3));
    const druse = crystals(p.mul(mix(22, 40, u.detail)).div(size), which.add(s.mul(5)));
    const crystal = mix(float(4), float(2), step(.55, druse.id)).sub(step(druse.id, .2).mul(2));
    index = mix(index, mix(crystal, float(3), step(druse.gap, .08)), step(coreStart, depth));
    // Rind and host rock.
    const rind = step(.9, best).mul(inside);
    index = mix(index, float(2), rind);
    // Host rock: sparse stationary 2×2 grains rather than single-pixel dust.
    const fleck = step(.955, cellHash(floor(pixel.div(2)), 57));
    const host = mix(float(0), float(3), fleck);
    index = mix(host, index, inside);
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        const signal = mix(here.x, index.div(4), step(coin(31), .4));
        return vec2(signal, mix(here.y, step(.01, abs(signal.sub(here.x))), .12));
      },
      seed: vec2(index.div(4), 0),
    };
  },
  display: ({ state, threshold, role, u }) => {
    const index = floor(state.r.mul(4).add(.5));
    const glint = step(threshold, smoothstep(.2, .6, state.g).mul(u.intensity).mul(.35));
    return mix(choose(index, [role(0), role(1), role(2), role(3), role(4)]), role(4), glint.mul(step(.5, index)));
  },
});

/** 83 Grain. Planks of varying height slide at their own rates (two shared
 * bounded tracks with per-plank weights; the integer transport is the exact
 * difference of floored offsets this frame and last). Rings follow each board's
 * pith with cathedral arches and swirl around knots; medullary flecks are short
 * dashes. A saw sweeps across on irregular slots and leaves circular saw marks
 * and sawdust in G, which ride away with the planks and decay ×0.965 per frame
 * (0.965¹²⁸ ≈ 0.01). R is a role index rewritten every frame. */
const grain = (): KitGraph => ({
  maxEdge: 320, environment: 'sliding planks with growth rings, knots and a travelling saw',
  step: ({ u, s, pixel, dimensions, control, control2, coin, at, local }) => {
    const size = u.scale.div(2.6).clamp(.4, 4);
    const height = float(26).div(size).max(8);
    const warpedY = pixel.y.add(height.mul(.4).mul(periodicNoise(vec2(pixel.y.div(height).mul(.5), s.mul(3)), 32)));
    const plank = floor(warpedY.div(height));
    const within = warpedY.sub(plank.mul(height));
    const weight = (salt: number) => cellHash(vec2(plank.add(64), s.mul(11)), salt).sub(.5).mul(2);
    const offset = (a: Scalar, b: Scalar) => floor(a.mul(weight(3)).add(b.mul(weight(5))).mul(420));
    const shift = offset(control.x, control.y), delta = shift.sub(offset(control2.x, control2.y));
    const uCoord = pixel.x.add(shift);
    // Rings: distance to the board's pith line, undulating along the board, with
    // a taper that opens cathedral arches; knots deflect and tighten them.
    const pith = height.mul(cellHash(vec2(plank, s), 7).mul(1.6).sub(.3));
    const undulate = noise(vec2(uCoord.mul(.009), plank.mul(3.1))).sub(.5).mul(height.mul(1.4)).add(noise(vec2(uCoord.mul(.04), plank)).sub(.5).mul(4));
    const taper = abs(uCoord.sub(cellHash(vec2(plank, s), 11).mul(dimensions.x))).mul(mix(.004, .014, cellHash(vec2(plank, s), 12)));
    let rings: Scalar = abs(within.sub(pith).add(undulate)).add(taper);
    const knotCell = floor(uCoord.div(height.mul(4.5)));
    const knotAt = vec2(knotCell.add(cellHash(vec2(knotCell, plank), 13).mul(.6).add(.2)).mul(height.mul(4.5)), height.mul(cellHash(vec2(knotCell, plank), 17).mul(.6).add(.2)));
    const knotD = length(vec2(uCoord, within).sub(knotAt).mul(vec2(.55, 1)));
    const hasKnot = step(.45, cellHash(vec2(knotCell, plank), 19));
    const knotR = height.mul(mix(.12, .24, cellHash(vec2(knotCell, plank), 23)));
    rings = rings.add(hasKnot.mul(knotR.mul(3)).mul(float(1).sub(smoothstep(0, knotR.mul(3.2), knotD))));
    const density = mix(.05, .17, u.detail).mul(size.sqrt());
    const t = fract(rings.mul(density));
    const latewood = step(t, .16), transition = step(t, .34).mul(float(1).sub(latewood));
    // Alternate planks swap earlywood and transition roles, so boards read apart.
    const odd = plank.mod(2);
    const early = mix(float(0), float(3), odd), middle = mix(float(3), float(0), odd);
    let index: Scalar = mix(mix(early, middle, transition), float(2), latewood);
    const knot = hasKnot.mul(step(knotD, knotR));
    index = mix(index, mix(float(3), float(2), step(.5, fract(knotD.mul(.7)))), knot);
    const fleck = step(.975, cellHash(vec2(floor(uCoord.div(5)), pixel.y), 29)).mul(float(1).sub(latewood));
    index = mix(index, float(4), fleck.mul(step(3, u.colors.length)));
    const seam = step(within, 1.5);
    index = mix(index, float(2), seam);
    // The saw: a kerf at sawX with moving teeth; marks and dust feed G.
    const sawX = control.z.mul(dimensions.x);
    const kerf = step(abs(pixel.x.sub(sawX)), 1.2).mul(step(.02, control.z)).mul(step(control.z, .98));
    const tooth = step(fract(pixel.y.add(control.w).div(6)), .35).mul(step(abs(pixel.x.sub(sawX)), 2.4)).mul(step(.02, control.z)).mul(step(control.z, .98));
    index = mix(index, float(1), max(kerf, tooth.mul(.999)));
    const arc = step(fract(length(vec2(pixel.x.sub(sawX), within.sub(height.mul(1.8)))).div(7)), .2).mul(step(abs(pixel.x.sub(sawX)), 9));
    const cut = arc.mul(.8).mul(step(.02, control.z)).mul(step(control.z, .98)).mul(float(1).sub(step(coin(3), local.peak.mul(.3))));
    return {
      evolve: lane => {
        const moved = lane(at(vec2(delta, 0)));
        return vec2(index.div(4), max(cut, moved.y.mul(.965)).clamp(0, 1));
      },
      seed: vec2(index.div(4), 0),
    };
  },
  display: ({ state, threshold, role, u }) => {
    const index = floor(state.r.mul(4).add(.5));
    const marked = step(threshold, smoothstep(.25, .6, state.g).mul(u.intensity.mul(.35).add(.45)));
    return mix(choose(index, [role(0), role(1), role(2), role(3), role(4)]), role(1), marked.mul(step(index, 2.5)));
  },
});

/** 86 Swarm. Agents sit on a jittered lattice (one per cell, present where a slow
 * density field allows) and are carried by a smooth displacement field whose
 * domain drifts on bounded tracks, so neighbours travel together while groups
 * split and rejoin. A pixel inverts the field with one fixed-point step and
 * tests the nine nearest agents, each on its own small orbit (integer
 * multiples of a 6000-frame base, so phases stay exact). R holds trails
 * decaying ×0.9 per frame (0.9¹²⁸ ≈ 1e-6); G tags the species that last
 * painted a pixel. Events push nearby agents away. */
const swarm = (): KitGraph => ({
  maxEdge: 320, environment: 'lattice agents carried by a drifting displacement field, with feedback trails',
  step: ({ u, s, pixel, dimensions, control, control2, at, local }) => {
    const spacing = mix(9, 3.6, u.detail);
    const field = mix(.006, .02, u.scale.div(12));
    const reach = dimensions.y.mul(.32);
    const displace = (b: Point) => vec2(noise(b.mul(field).add(control.xy)), noise(b.mul(field).add(control.zw).add(17.3))).sub(.5).mul(reach.mul(2))
      .add(vec2(noise(b.mul(field.mul(2.7)).sub(control.yx)), noise(b.mul(field.mul(2.7)).add(control.wz).add(5.1))).sub(.5).mul(reach.mul(.35)));
    const push = local.gust.mul(local.peak).mul(-26);
    const guess = pixel.sub(displace(pixel.sub(displace(pixel))));
    const home = floor(guess.div(spacing));
    let head: Scalar = float(0), species: Scalar = float(0);
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
      const cell = home.add(vec2(dx, dy));
      const h = (salt: number) => cellHash(cell.add(vec2(4096, 4096)), s.mul(53).add(salt));
      const base = cell.add(vec2(h(1), h(2)).mul(.8).add(.1)).mul(spacing);
      const crowd = smoothstep(.2, .56, noise(base.mul(field.mul(1.6)).add(control2.xy)));
      const present = step(h(3), crowd.mul(.92).add(.07));
      const turns = floor(h(4).mul(60)).add(20);
      const phase = fract(turns.mul(control2.z).div(6000).add(h(5))).mul(6.2832);
      const orbit = vec2(phase.cos(), phase.sin()).mul(h(6).mul(2.5).add(.5));
      const position = base.add(displace(base)).add(orbit).add(push);
      const hit = step(length(pixel.add(.5).sub(position)), .75).mul(present);
      species = mix(species, step(.62, h(7)), hit.mul(step(head, .5)));
      head = max(head, hit);
    }
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        return vec2(max(head, here.x.mul(.9)), mix(here.y, species, head));
      },
      seed: vec2(0, 0),
    };
  },
  display: ({ state, st, cell, threshold, role, u }) => {
    // Dusk: the ground dithers toward body near the horizon.
    const horizon = step(bayer(cell, 4).add(.001), smoothstep(.34, 0, st.y).mul(.55));
    const sky = mix(role(0), role(3), horizon);
    const trail = state.r.mul(u.intensity.mul(.35).add(.75));
    const lead = step(.9, trail), tail = step(threshold.mul(.55).add(.2), trail).mul(float(1).sub(lead));
    const second = step(.5, state.g);
    return mix(mix(sky, mix(role(1), role(4), second), tail), mix(role(2), role(1), second), lead);
  },
});

const GOLDEN = 2.399963229728653;
const SEED_WINDOW = 40;
/** 89 Phyllotaxis. Vogel's model: seed n sits at radius a·√(n + ½) and angle
 * n·137.5°. A pixel searches only the indices whose radius lies within one dot
 * of its own (a bounded window of ≤40), so the nearest seed is exact. Seeds are
 * coloured by their parastichy families (n mod 21, n mod 34), the disc holds
 * florets, and two rows of petals ring each head. Heads turn continuously
 * (angle wraps at 2π on the CPU), swell and wander. Rim seeds are released on
 * irregular slots: G tags loose seeds, which ride the wind one pixel per frame
 * and die at 2.5% per frame (0.975¹²⁸ ≈ 0.04, and loose seeds are sparse). */
const phyllotaxis = (): KitGraph => ({
  maxEdge: 320, environment: 'golden-angle seed heads with parastichy colouring and wind-blown seeds',
  step: ({ u, pixel, dimensions, control, control2, coin, at }) => {
    const count = floor(mix(160, 480, u.detail));
    const heads = [
      { centre: vec2(control.x, control.y), size: float(.34), turn: control.z },
      { centre: vec2(control2.x, control2.y), size: float(.2), turn: control.z.negate().add(1.1) },
    ];
    const scale = float(2.6).div(u.scale).clamp(.3, 2.6);
    // The pixel belongs to its nearest head (by normalised radius).
    const place = heads.map(h => {
      const outer = h.size.mul(dimensions.y).mul(scale).mul(control.w.mul(.14).add(.93));
      const offset = pixel.add(.5).sub(h.centre.mul(dimensions));
      return { ...h, outer, offset, rho: length(offset).div(outer) };
    });
    const first = step(place[0].rho, place[1].rho);
    const outer = mix(place[1].outer, place[0].outer, first);
    const offset = mix(place[1].offset, place[0].offset, first);
    const turn = mix(place[1].turn, place[0].turn, first);
    const which = float(1).sub(first);
    const r = length(offset);
    const disc = outer.mul(.7);
    const spacing = disc.div(count.sqrt());
    const dotR = spacing.mul(.46);
    const start = floor(max(float(0), r.sub(dotR)).div(spacing).pow(2).sub(.5));
    const last = r.add(dotR).div(spacing).pow(2);
    const nearest = float(-1).toVar(), best = float(1e6).toVar();
    Loop({ start: int(0), end: int(SEED_WINDOW), type: 'int' }, ({ i }) => {
      const n = start.add(float(i));
      const angle = n.mul(GOLDEN).add(turn);
      const seed = vec2(angle.cos(), angle.sin()).mul(spacing.mul(n.add(.5).sqrt()));
      const d = length(offset.sub(seed));
      const valid = step(n, last).mul(step(n, count.sub(1)));
      const closer = step(d, best).mul(valid);
      nearest.assign(mix(nearest, n, closer)); best.assign(mix(best, d, closer));
    });
    const hit = step(best, dotR).mul(step(0, nearest));
    // Parastichy colouring. Spatially adjacent arms of the 21 family differ by 8
    // (mod 21), and of the 34 family by 13 (mod 34), so n·8 mod 21 and n·21 mod 34
    // give arm order; alternating parities cross into the classic spiral lattice.
    const armA = nearest.mul(8).mod(21).mod(2), armB = nearest.mul(21).mod(34).mod(2);
    let index: Scalar = mix(mix(float(3), float(2), armA), mix(float(1), float(2), armA), armB);
    index = mix(index, float(4), step(nearest, count.mul(.12)));
    index = index.mul(hit);
    // Petals: two rows of pointed rays around the disc.
    const theta = offset.y.atan(offset.x).sub(turn);
    const petalCount = mix(21, 34, step(.5, u.detail));
    [0, .5].forEach((shift, row) => {
      const local = fract(theta.div(6.2832).mul(petalCount).add(shift)).sub(.5).abs();
      const along = r.sub(disc.mul(.96)).div(outer.sub(disc).mul(row === 0 ? 1.5 : 1.15));
      const width = along.mul(3.1416).sin().max(0).pow(.7).mul(row === 0 ? .42 : .34);
      const petal = step(local, width).mul(step(0, along)).mul(step(along, 1)).mul(step(index, .5));
      index = mix(index, float(row === 0 ? 1 : 4), petal);
    });
    // Release: a rim seed is stamped as loose once per slot, then hidden until the slot ends.
    const slot = control2.z;
    const rim = step(count.mul(.78), nearest).mul(hit);
    const releaseAt = floor(cellHash(vec2(nearest.add(which.mul(4096)), slot), 331).mul(90));
    const chosen = step(cellHash(vec2(nearest.add(which.mul(4096)), slot), 337), u.intensity.mul(.12).add(.02)).mul(rim);
    const releasedNow = chosen.mul(equalish(releaseAt, control2.w));
    const hidden = chosen.mul(step(releaseAt, control2.w));
    index = mix(index, float(0), hidden.mul(float(1).sub(releasedNow)));
    const wind = vec2(mix(float(1), float(-1), step(.5, fract(slot.mul(.37)))), mix(float(0), float(1), step(.6, fract(slot.mul(.61)))));
    return {
      evolve: lane => {
        const moved = lane(at(wind.negate()));
        const alive = step(.5, moved.y).mul(step(.025, coin(41)));
        const loose = mix(float(0), moved.x, alive);
        const occupied = step(.5, index);
        const value = mix(mix(loose, float(.75), releasedNow), index.div(4), occupied.mul(float(1).sub(releasedNow)));
        const tag = mix(alive, float(1), releasedNow).mul(float(1).sub(occupied.mul(float(1).sub(releasedNow))));
        return vec2(value, tag);
      },
      seed: vec2(index.div(4), 0),
    };
  },
  display: ({ state, role }) => {
    const index = floor(state.r.mul(4).add(.5));
    return choose(index, [role(0), role(1), role(2), role(3), role(4)]);
  },
});

const graphs: Record<MatterFamily, () => KitGraph> = {
  "ripple": ripple,
  "agate": agate,
  "grain": grain,
  "borealis": borealis,
  "lightning": lightning,
  "swarm": swarm,
  "strata": strata,
  "cumulus": cumulus,
  "phyllotaxis": phyllotaxis,
  "smoke": smoke,
};
export function createMatter(u: KitInputs, family: MatterFamily) {
  return createKitStudy(u, family, graphs[family](), matterControls(family), matterSalt);
}
