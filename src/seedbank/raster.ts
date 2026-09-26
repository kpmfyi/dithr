import { Vector4 } from 'three';
import { Loop, abs, atan, cos, float, floor, fract, max, min, mix, pow, sign, sin, smoothstep, step, uniformArray, vec2 } from 'three/tsl';
import { bayer, cellHash, choose, createKitStudy, fbm, noise, ramp, rotate, steps, tri, type Color, type KitGraph, type KitInputs, type Point, type Quad, type Scalar } from './kit';
import type { Node } from 'three/webgpu';
import { createKitEvolution, type ControlTools } from './kit-evolution';
import type { RasterFamily } from './raster-meta';
import { BEAM_POINTS, COPPER_BARS, ORBIT_STAMPS, TWISTER_COLUMNS, beamPath, copperBars, orbitCloud, rasterControls, rasterSalt, twisterColumns } from './raster-evolution';


const TAU = Math.PI * 2;
/** Floor-based modulo: positive for negative inputs on every backend. */
const fmod = (a: Scalar, b: Scalar | number) => a.sub(floor(a.div(b)).mul(b));
const same = (a: Scalar, b: Scalar | number) => float(1).sub(step(.5, abs(a.sub(b))));
/** Direct role lookup for a stored index 0–4 (ground, accent, ink, body, trace). */
const byIndex = (index: Scalar, role: (i: 0 | 1 | 2 | 3 | 4) => Color) => choose(index, [role(0), role(1), role(2), role(3), role(4)]);
/** A five-level ramp position (0–4) mapped onto however many ramp colors are active. */
/** Bayer thresholds in (0, 1): a zero threshold would always pass `step`. */
const dither = (p: Point, size: 2 | 4 | 8 = 4) => bayer(p, size).add(size === 8 ? 1 / 128 : size === 4 ? 1 / 32 : 1 / 8);
const onRamp = (level: Scalar, colors: Color[]) => choose(floor(level.mul((colors.length - 1) / 4).add(.5)), colors);

/** CPU-side score tools for stamp lists, rebuilt when the recipe seed changes. */
function seededTools(u: KitInputs) {
  let seed = -1, tools: ControlTools = createKitEvolution(0, rasterSalt).tools;
  return () => {
    const next = Math.round(u.seed.value / 60 * 65535);
    if (next !== seed) { seed = next; tools = createKitEvolution(seed, rasterSalt).tools; }
    return tools;
  };
}
/** A uniform vec4 array the CPU rewrites before each simulation step. */
function vectors(n: number) {
  const values = Array.from({ length: n }, () => new Vector4());
  const node = uniformArray(values, 'vec4');
  return { values, at: (index: Node<'int'> | number) => node.element(index as never) as unknown as Quad };
}
/** Thin, dotted graticule lines on a centered grid (display pixels). */
function graticule(cell: Point, dimensions: Point, divisions: Scalar): Scalar {
  const pitch = floor(dimensions.y.div(divisions)).max(4);
  const g = cell.sub(floor(dimensions.mul(.5))).abs().mod(pitch);
  const line = float(1).sub(step(.5, min(g.x, g.y)));
  const axis = float(1).sub(step(.5, min(cell.x.sub(floor(dimensions.x.mul(.5))).abs(), cell.y.sub(floor(dimensions.y.mul(.5))).abs())));
  const tick = axis.mul(step(pitch.mul(.8), g.x.add(g.y).mod(pitch.mul(.2)).add(pitch.mul(.8))));
  return max(line.mul(step(.5, cell.x.add(cell.y).mod(2))), axis.mul(.99)).max(tick);
}



/** 71 Pyre. Classic rising fire: every cell copies heat from one or two rows
 * below with a random sideways offset, then loses a random amount. The base is
 * refed each frame and events add flares mid-air. Heat entering the panel rises
 * one or two rows per frame and cools by ≥1.4 on average over 128 frames, so
 * the priming shadow and the displayed history agree before each handoff. */
const pyre = (): KitGraph => ({
  maxEdge: 208, dither: 'cell', environment: 'rising heat with random cooling; Bayer-stepped palette ramp',
  step: ({ u, s, st, pixel, control, control2, local, coin, at, toDomain, other }) => {
    const wind = control.x.sub(.5).mul(2.4).add(other.sub(.5).mul(control.y.mul(2.5)));
    // The wind biases which neighbour feeds a cell; it never shears whole rows.
    const lean = step(coin(5), abs(wind).mul(.5)).mul(sign(wind));
    const x = toDomain(st).x;
    const burners = noise(vec2(x.mul(1.7).add(control.z.mul(.004)), s)).mul(.7).add(noise(vec2(x.mul(5.3).sub(control.z.mul(.002)), s.add(3))).mul(.3));
    const base = float(1).sub(step(1.5, pixel.y));
    const fuel = smoothstep(.3, .6, burners).mul(coin(7).mul(.3).add(.82)).mul(u.intensity.mul(.45).add(.5)).clamp(0, 1);
    // A cooling map that scrolls upward with the heat carves coherent tongues.
    const rise = pixel.y.sub(control2.x);
    const map = noise(vec2(pixel.x.mul(.11).add(s.mul(7)), rise.mul(.075))).mul(.6).add(noise(vec2(pixel.x.mul(.29), rise.mul(.19).add(s))).mul(.4));
    const unit = mix(.034, .0075, u.detail);
    const cooling = map.mul(map).mul(unit.mul(4.2)).add(unit.mul(.25));
    // Flares: small ragged fireballs near event centers; they rise with the rest.
    const flare = step(coin(13), local.peak.pow(6).mul(control.w.mul(.05).add(.012))).mul(step(.45, local.level)).mul(.8);
    return {
      evolve: lane => {
        const b0 = lane(at(vec2(lean, -1))), bl = lane(at(vec2(lean.sub(1), -1))), br = lane(at(vec2(lean.add(1), -1))), b2 = lane(at(vec2(lean, -2)));
        const here = lane(at(vec2(0)));
        const risen = b0.x.mul(.34).add(bl.x.mul(.2)).add(br.x.mul(.2)).add(b2.x.mul(.26)).sub(cooling).max(0);
        const heat = max(mix(risen, fuel, base), flare).clamp(0, 1);
        return vec2(heat, mix(here.y, abs(heat.sub(here.x)), .05).clamp(0, 1));
      },
      seed: vec2(0, 0),
    };
  },
  display: ({ state, cell, role, count, u }) => {
    const heat = state.r.mul(u.intensity.mul(.25).add(.82)).pow(.85);
    return steps(heat, ramp(role, count), bayer(cell, 4), .9);
  },
});

/** 75 Vectorscope. One phosphor beam: the CPU samples a harmonograph path 33
 * times per frame (continuing the previous frame's last sample) and the shader
 * lights every cell within .7 px of the polyline, brighter where the beam is
 * slow. Phosphor decays by ≤ .965 per frame (≤ .01 after 128 frames), the glow
 * channel follows it, so the priming shadow converges before each handoff. */
const vectorscope = (u: KitInputs): KitGraph => {
  const beam = vectors(BEAM_POINTS), tools = seededTools(u);
  return {
    maxEdge: 320, environment: 'CPU harmonograph beam, polyline stamping, phosphor decay',
    update(frame, _score, size) {
      const path = beamPath(tools(), frame, u.detail.value, u.scale.value);
      for (let j = 0; j < BEAM_POINTS; j++) beam.values[j].set(size.width / 2 + path[2 * j] * size.height, size.height / 2 + path[2 * j + 1] * size.height, 0, 0);
    },
    step: ({ pixel, at, coin }) => {
      const p = pixel.add(.5), lit = float(0).toVar();
      Loop(BEAM_POINTS - 1, ({ i }) => {
        const a = beam.at(i).xy, b = beam.at(i.add(1)).xy, ab = b.sub(a);
        const t = p.sub(a).dot(ab).div(ab.dot(ab).max(.0001)).clamp(0, 1);
        const d = p.sub(a.add(ab.mul(t))).length();
        // A slow beam deposits more energy: brighter where the figure turns.
        const energy = float(1.9).div(ab.length().add(.9)).clamp(.45, 1);
        const core = step(d, .75), halo = float(1).sub(smoothstep(.75, 3.4, d)).mul(.34);
        lit.assign(max(lit, max(core, halo).mul(energy)));
      });
      const decay = mix(.925, .975, u.intensity.div(2));
      return {
        evolve: lane => {
          const here = lane(at(vec2(0)));
          // Faint phosphor noise keeps old traces granular rather than smooth.
          const signal = max(here.x.mul(decay).mul(coin(3).mul(.08).add(.92)), lit);
          return vec2(signal, mix(here.y, signal, .07));
        },
        seed: vec2(0, 0),
      };
    },
    display: ({ state, cell, dimensions, role, count, u }) => {
      const tone = max(state.r, state.g.mul(1.6).clamp(0, .5)).pow(.8);
      const colors = ramp(role, count);
      const phosphor = steps(tone, colors, bayer(cell, 4), .7);
      const grid = graticule(cell, dimensions, floor(mix(6, 12, u.scale.sub(1).div(11))));
      return mix(phosphor, count > 3 ? role(3) : role(1), grid.mul(step(tone, .12)));
    },
  };
};

/** 79 Orbit. A rotating 3D point cloud (sphere, torus knot, gyroscope rings,
 * double helix, cube edges, Lissajous knot) morphs between shapes. Each frame
 * stamps 64 of its 128–256 points, so trails come out dotted. Tone encodes depth
 * and decays by .9 per frame (≤ 2e-6 after 128 frames). */
const orbit = (u: KitInputs): KitGraph => {
  const stamps = vectors(ORBIT_STAMPS), tools = seededTools(u);
  return {
    maxEdge: 320, environment: 'CPU point cloud, depth-toned stamps, decaying trails',
    update(frame, _score, size) {
      const cloud = orbitCloud(tools(), frame, u.detail.value, u.scale.value);
      for (let j = 0; j < ORBIT_STAMPS; j++) stamps.values[j].set(size.width / 2 + cloud[4 * j] * size.height, size.height / 2 + cloud[4 * j + 1] * size.height, cloud[4 * j + 2], cloud[4 * j + 3]);
    },
    step: ({ pixel, at }) => {
      const p = pixel.add(.5), lit = float(0).toVar();
      Loop(ORBIT_STAMPS, ({ i }) => {
        const point = stamps.at(i);
        const d = p.sub(point.xy).abs();
        const reach = point.w.mul(.5).add(.5);
        lit.assign(max(lit, step(max(d.x, d.y), reach).mul(point.z)));
      });
      const decay = mix(.84, .92, u.intensity.div(2));
      return {
        evolve: lane => {
          const here = lane(at(vec2(0)));
          const signal = max(here.x.mul(decay), lit);
          return vec2(signal, mix(here.y, step(.001, lit), .05));
        },
        seed: vec2(0, 0),
      };
    },
    display: ({ state, threshold, role, count }) => {
      const colors = ramp(role, count);
      return steps(state.r.pow(.9), colors, threshold, .5);
    },
  };
};

/** 72 Tunnel. A polar texture tunnel: depth = k / r under a super-ellipse norm
 * that morphs between round and square, a wandering, bending vanishing point,
 * brick tiles whose lamps pulse toward the viewer, and dithered fog. Every
 * frame is rendered from the score (injection 1); only the afterimage channel
 * carries memory and it contracts by .965 per frame. */
const tunnel = (): KitGraph => ({
  maxEdge: 256, dither: 'cell', environment: 'polar tile tunnel, super-ellipse profile, Bayer depth fog',
  step: ({ u, s, st, pixel, control, control2, at, local }) => {
    const exponent = mix(2, 10, control2.z.mul(control2.z));
    const norm = (p: Point) => pow(pow(abs(p.x), exponent).add(pow(abs(p.y), exponent)), float(1).div(exponent));
    const p0 = st.sub(.5).mul(vec2(u.aspect, 1)).sub(control.xy);
    // Deeper rings slide toward the bend vector: the tunnel curves away.
    const bend = float(.3).div(norm(p0).max(.004)).mul(.03).clamp(0, .45);
    const p = p0.sub(control.zw.mul(bend).mul(bend));
    const r = norm(p).max(.0005);
    const depth = float(.3).div(r);
    const cols = floor(mix(10, 30, u.scale.sub(1).div(11).clamp(0, 1)).add(.5));
    const rowsPerUnit = mix(1.8, 4.6, u.scale.sub(1).div(11).clamp(0, 1));
    const rowPosition = depth.min(60).mul(rowsPerUnit).add(control2.x.mul(rowsPerUnit.div(1.6)));
    const row = floor(rowPosition), rowId = fmod(row, 64);
    const around = fract(atan(p.y, p.x).div(TAU).add(control2.y)).mul(cols).add(fmod(row, 2).mul(.5));
    const col = fmod(floor(around), cols);
    const fu = fract(rowPosition), fv = fract(around);
    const grout = float(1).sub(step(mix(.07, .16, u.detail), min(fu, fv)));
    const h = cellHash(vec2(rowId, col), s.mul(911));
    // Weighted wall roles: body and ink bricks, some accent tiles.
    const brick = mix(mix(float(3), float(2), step(.55, h)), float(1), step(.86, h));
    const motif = step(abs(fu.sub(.5)).add(abs(fv.sub(.5))), mix(0, .32, u.detail)).mul(step(.3, cellHash(vec2(col, rowId), 7)));
    // Lamp pulses run toward the viewer faster than the walls scroll.
    const lamp = step(fract(rowId.mul(.0625).add(cellHash(vec2(col, 5), s.mul(97)).mul(.5)).sub(control2.w.mul(.0045))), mix(.02, .09, u.intensity.div(2)));
    const tile = mix(mix(brick, mix(float(4), float(1), step(2.5, brick)), motif), float(4), lamp);
    const fog = step(dither(pixel), smoothstep(3.2, 11, depth));
    const core = step(r, .016).mul(step(dither(pixel), .7));
    const flash = step(.55, local.peak).mul(step(dither(pixel), .3)).mul(grout);
    const index = mix(mix(mix(tile, float(0), grout), float(0), fog), float(4), max(core, flash));
    return {
      evolve: lane => { const here = lane(at(vec2(0))); return vec2(index.div(4), mix(here.y, abs(index.div(4).sub(here.x)).mul(2).clamp(0, 1), .035)); },
      seed: vec2(index.div(4), 0),
    };
  },
  display: ({ state, role }) => byIndex(floor(state.r.mul(4).add(.5)), role),
});

/** 73 Warp. An analytic starfield: five layers of angular cells each hold one star
 * whose depth phase advances with the score; a star draws the streak between its
 * current and earlier projected radius, so trails lengthen with warp speed. A
 * short feedback afterglow (≤ .82 per frame) smears bursts. */
const warp = (): KitGraph => ({
  maxEdge: 384, environment: 'analytic perspective star streaks, depth-toned, short afterglow',
  step: ({ u, s, st, dimensions, control, control2, at, coin }) => {
    const p = rotate(st.sub(.5).mul(vec2(u.aspect, 1)).sub(control.xy), control2.x);
    const r = p.length().max(.0001);
    const turns = fract(atan(p.y, p.x).div(TAU));
    const cells = floor(mix(40, 150, u.detail).mul(float(1).add(u.scale.sub(2.6).mul(.08)).clamp(.6, 2)));
    const lit = float(0).toVar();
    for (let layer = 0; layer < 5; layer++) {
      const offset = layer * .1373;
      const position = turns.add(offset).mul(cells);
      for (const k of [-1, 0, 1]) {
        const id = floor(position).add(k);
        const wrapped = fmod(id, cells);
        const h1 = cellHash(vec2(wrapped, layer), s.mul(613)), h2 = cellHash(vec2(wrapped, layer + 7), s.mul(613)), h3 = cellHash(vec2(wrapped, layer + 13), s.mul(613));
        const z = float(1).sub(fract(h2.add(control.z)));
        const head = float(.016).div(z.max(.004)), tail = float(.016).div(z.add(control.w.mul(mix(.6, 1.4, h3))));
        const lateral = position.sub(id.add(h1)).abs().div(cells).mul(TAU).mul(r).mul(dimensions.y);
        const width = mix(.55, 1.6, float(1).sub(z).pow(3));
        const inside = step(tail, r).mul(step(r, head)).mul(step(lateral, width));
        const along = r.sub(tail).div(head.sub(tail).max(.0001)).clamp(0, 1);
        const tone = mix(.3, 1, float(1).sub(z).pow(.6)).mul(mix(.5, 1, along)).mul(mix(.8, 1, h3));
        lit.assign(max(lit, inside.mul(tone)));
      }
    }
    // A faint nebula of body-colored dust drifts behind the stars.
    const nebula = step(.7, fbm(p.mul(2.1).add(control2.yz))).mul(.2).mul(step(coin(3), .3));
    const decay = mix(.6, .82, u.intensity.div(2));
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        const signal = max(max(lit, here.x.mul(decay)), nebula);
        return vec2(signal, mix(here.y, lit, .05));
      },
      seed: vec2(0, 0),
    };
  },
  display: ({ state, threshold, role, count }) => steps(state.r.pow(.8), ramp(role, count), threshold, .6),
});

/** 74 Copper. Raster bars with five-step dithered profiles swing between
 * independently hashed heights (eased, with pauses), pass in front of a waving
 * chunky scroller, and leave hard trails that dissolve at ≥ 12% per frame. */
const copper = (u: KitInputs): KitGraph => {
  const bars = vectors(COPPER_BARS), tools = seededTools(u);
  return {
    maxEdge: 240, dither: 'cell', environment: 'CPU-scheduled raster bars, sine-waved scroller, dissolving trails',
    update(frame) {
      const values = copperBars(tools(), frame, u.detail.value);
      for (let i = 0; i < COPPER_BARS; i++) bars.values[i].set(values[4 * i], values[4 * i + 1], values[4 * i + 2], values[4 * i + 3]);
    },
    step: ({ s, st, pixel, dimensions, control, control2, at, coin }) => {
      const y = st.y;
      const wave = floor(control.x.mul(sin(y.mul(control.y).add(control.z).mul(TAU))).add(.5));
      const d = dither(pixel);
      // Scroller band: chunky mirrored glyph blocks (3×3 px per bit) sliding left,
      // each row displaced by the sine wave, with a one-pixel drop shadow.
      const bandTop = floor(control2.x.mul(dimensions.y.sub(32)));
      const scale01 = u.scale.sub(1).div(11).clamp(0, 1);
      const bitSize = floor(mix(4, 2, scale01.sqrt()).add(.5));
      const glyphAt = (dx: number, dy: number) => {
        const gy = floor(pixel.y.add(dy).sub(bandTop).div(bitSize));
        const gx = floor(pixel.x.add(dx).add(wave).add(control.w).div(bitSize));
        const character = floor(gx.div(6)), gcol = fmod(gx, 6);
        const bit = step(.46, cellHash(vec2(character, min(gcol, float(4).sub(gcol)).add(float(6).sub(gy).mul(3))), s.mul(173)));
        return bit.mul(step(gcol, 4.5)).mul(step(0, gy)).mul(step(gy, 6.5)).mul(step(.16, cellHash(vec2(character, 99), s.mul(173))));
      };
      const glyph = glyphAt(0, 0), shadow = glyphAt(-1, 1).mul(float(1).sub(glyph));
      // Background: a faint stepped gradient in wide bands, waved per row.
      const backdrop = step(d, tri(y.mul(2).add(fract(pixel.x.add(wave).mul(.004)))).mul(.16).mul(u.intensity));
      const level = mix(float(0), float(1), backdrop).toVar();
      const covered = float(0).toVar();
      const bar = (i: number) => {
        const values = bars.at(i);
        const distance = abs(y.sub(values.x)).div(values.y.mul(mix(1.3, .55, scale01)).max(.001));
        const inside = step(distance, 1).mul(values.w);
        // Five dithered steps from edge to center; at high detail alternate rows drop a step.
        const profile = float(1).sub(distance.pow(1.6)).mul(4.2).add(d.sub(.5).mul(.9)).sub(fmod(pixel.y, 2).mul(step(.75, u.detail)).mul(.6));
        const tone = fmod(floor(profile.clamp(0, 3.99)).add(values.z), 4).add(1);
        level.assign(mix(level, tone, inside));
        covered.assign(max(covered, inside));
      };
      // Back bars pass behind the scroller, front bars in front of it.
      for (let i = 0; i < COPPER_BARS; i += 2) bar(i);
      level.assign(mix(mix(level, float(1), shadow), float(4), glyph));
      covered.assign(max(covered, max(glyph, shadow)));
      for (let i = 1; i < COPPER_BARS; i += 2) bar(i);
      return {
        evolve: lane => {
          const trail = lane(at(vec2(0, 0)));
          // Where no bar is now, the old bar lingers and dissolves into the backdrop.
          const keep = step(.5, trail.x.mul(4)).mul(step(coin(7), mix(.66, .95, u.intensity.div(2)).sub(control2.y.mul(.08)))).mul(float(1).sub(covered));
          const signal = mix(level.div(4), trail.x, keep.mul(step(level, .5)));
          return vec2(signal, mix(trail.y, covered, .05));
        },
        seed: vec2(level.div(4), 0),
      };
    },
    display: ({ state, role, count }) => onRamp(floor(state.r.mul(4).add(.5)), ramp(role, count)),
  };
};

/** 80 Twister. Four-faced columns twist along their height; each row draws the
 * visible faces between projected corners with flat roles and Bayer-stepped
 * shading. Columns wander, bend and leave dissolving trails (≥ 10% per frame). */
const twister = (u: KitInputs): KitGraph => {
  const columns = vectors(TWISTER_COLUMNS), tools = seededTools(u);
  return {
    maxEdge: 200, dither: 'cell', environment: 'CPU-scheduled twisting columns, Bayer face shading',
    update(frame) {
      const values = twisterColumns(tools(), frame, u.detail.value);
      for (let i = 0; i < TWISTER_COLUMNS; i++) columns.values[i].set(values[4 * i], values[4 * i + 1], values[4 * i + 2], values[4 * i + 3]);
    },
    step: ({ st, pixel, control, at, coin }) => {
      const x = st.x.mul(u.aspect), y = st.y, d = dither(pixel);
      const index = float(0).toVar(), covered = float(0).toVar();
      const faces = [2, 1, 3, 4];
      for (let c = 0; c < TWISTER_COLUMNS; c++) {
        const column = columns.at(c);
        const bend = control.x.mul(sin(y.mul(control.y).add(control.z).mul(TAU).add(c * 1.7)));
        const center = column.x.mul(u.aspect).add(bend);
        const angle = column.z.add(column.w.mul(y.sub(.5)));
        const radius = column.y.mul(float(1).add(u.scale.sub(2.6).mul(.05)).clamp(.5, 1.6));
        const corner = (k: number) => center.add(radius.mul(sin(angle.add(k * Math.PI / 2))));
        for (let k = 0; k < 4; k++) {
          const a = corner(k), b = corner(k + 1);
          const visible = step(a, b).mul(step(.0005, radius));
          const inside = step(a, x).mul(step(x, b)).mul(visible);
          const light = b.sub(a).div(radius.mul(1.4142).max(.0001)).clamp(0, 1);
          const lit = step(d, light.pow(mix(1.8, .35, u.intensity.div(2))).mul(1.15));
          const shade = faces[k] === 3 ? float(0) : float(3);
          // A one-cell seam at each corner separates the faces.
          const edge = step(x.sub(a), float(1).div(200).mul(u.aspect)).mul(step(.3, u.intensity));
          index.assign(mix(index, mix(mix(shade, float(faces[k]), lit), float(0), edge), inside));
          covered.assign(max(covered, inside));
        }
      }
      return {
        evolve: lane => {
          const trail = lane(at(vec2(0)));
          const keep = step(.5, trail.x.mul(4)).mul(step(coin(5), .86)).mul(float(1).sub(covered));
          const signal = mix(index.div(4), trail.x, keep);
          return vec2(signal, mix(trail.y, covered, .05));
        },
        seed: vec2(index.div(4), 0),
      };
    },
    display: ({ state, role }) => byIndex(floor(state.r.mul(4).add(.5)), role),
  };
};

/** 76 Flipdot. Round discs on a grid show two faces. Every pixel of a cell reads
 * the cell's anchor, so a disc flips as a unit: when the target face differs,
 * it starts a flip on a per-cell coin and turns edge-first over eight frames.
 * Targets combine drifting blobs, a sweeping front (XOR), event rings and a
 * scrolling glyph marquee. A settled disc carries no memory beyond its target. */
const flipdotSize = (u: KitInputs) => floor(mix(15, 6, u.detail).add(.5));
const flipdot = (): KitGraph => ({
  maxEdge: 384, environment: 'flip-disc cells with staggered edge-first flips',
  step: ({ u, s, pixel, texel, dimensions, control, control2, read, carrier, toDomain, arrivals }) => {
    const size = flipdotSize(u);
    const id = floor(pixel.div(size));
    const anchor = id.mul(size).add(floor(size.mul(.5))).add(.5).mul(texel);
    const place = toDomain(anchor);
    const blobs = step(mix(.5, .6, control2.w).add(float(.55).sub(u.intensity.div(2)).mul(.22)), noise(place.mul(.55).add(control2.xy)).mul(.7).add(noise(place.mul(1.3).sub(control2.yx)).mul(.3)));
    const direction = vec2(cos(control.x), sin(control.x));
    const front = step(.78, tri(place.dot(direction).mul(.18).sub(control.y)));
    const event = arrivals(anchor);
    const ring = step(.32, event.peak).mul(step(event.peak, .55));
    const rows = floor(dimensions.y.div(size));
    const bandTop = floor(control.w.mul(rows.sub(8).max(0)));
    const gy = id.y.sub(bandTop), inBand = step(0, gy).mul(step(gy, 6.5));
    const column = id.x.add(control.z);
    const character = floor(column.div(6)), gx = fmod(column, 6);
    const bit = step(.5, cellHash(vec2(character, min(gx, float(4).sub(gx)).add(float(6).sub(gy).mul(3))), s.mul(331))).mul(step(gx, 4.5)).mul(step(.2, cellHash(vec2(character, 3), s.mul(331))));
    const field = abs(abs(blobs.sub(front)).sub(ring));
    const target = mix(mix(field, float(1).sub(field), step(.82, control2.z)), bit, inBand);
    const cellCoin = cellHash(id.add(vec2(7, 3)), carrier);
    return {
      evolve: lane => {
        const state = lane(read(anchor));
        const face = fmod(state.x, 2), phase = state.y;
        const settled = step(phase, .001);
        const start = settled.mul(step(.5, abs(target.sub(face)))).mul(step(cellCoin, mix(.12, .45, u.intensity.div(2))));
        const nextFace = mix(face, target, start);
        const nextPhase = mix(max(phase.sub(.125), 0), 1, start);
        return vec2(nextFace.add(inBand.mul(2)), nextPhase);
      },
      seed: vec2(target.add(inBand.mul(2)), 0),
    };
  },
  display: ({ u, state, cell, role, count }) => {
    const size = flipdotSize(u);
    const local = fmod(cell.x, size).sub(size.sub(1).mul(.5));
    const localY = fmod(cell.y, size).sub(size.sub(1).mul(.5));
    const face = fmod(state.r, 2), band = step(1.5, state.r), phase = state.g;
    const radius = size.mul(.44);
    const squash = abs(cos(phase.mul(Math.PI)));
    const showing = mix(face, float(1).sub(face), step(.5, phase));
    const inside = step(local.div(radius).pow(2).add(localY.div(radius.mul(squash).max(.35)).pow(2)), 1);
    const on = count === 2 ? role(1) : mix(role(2), role(1), band);
    const off = count === 2 ? role(0) : count === 3 ? role(2) : role(3);
    const onColor = count === 3 ? role(1) : on;
    const rim = step(squash, .3);
    const disc = mix(mix(off, onColor, showing), count >= 5 ? role(4) : role(1), rim);
    return mix(role(0), disc, inside);
  },
});

/** 78 Mode 7. A perspective ground plane under a hard horizon: every row maps to
 * a depth, every column to a lateral offset, rotated by the heading. Tiles are
 * rewritten region by region as slow fronts cross the map; a striped sun and a
 * wrapped mountain ridge sit in the sky band. Rendered from the score each frame. */
const mode7 = (): KitGraph => ({
  maxEdge: 224, dither: 'cell', environment: 'perspective tile plane, wrapped skyline, Bayer haze',
  step: ({ u, s, st, pixel, control, control2, at }) => {
    const d = dither(pixel);
    const horizon = mix(.6, .74, control2.x);
    const sx = st.x.sub(.5).mul(u.aspect);
    const below = horizon.sub(st.y);
    const depth = mix(.8, 2.1, control.w).div(below.max(.003));
    const world = rotate(vec2(sx.mul(depth).mul(1.15), depth), control.z).add(control.xy);
    const density = mix(.55, 2.4, u.scale.sub(1).div(11).clamp(0, 1));
    const tw = world.mul(density).add(8192), tile = floor(tw), f = fract(tw);
    const region = floor(tile.div(6));
    const epoch = floor(control2.y.mul(.0032).add(region.x.mul(.19)).add(region.y.mul(.11)).add(cellHash(region, 5).mul(.8)));
    const h = cellHash(tile, epoch.add(s.mul(1103)));
    const kind = floor(h.mul(4));
    const checker = abs(step(.5, f.x).sub(step(.5, f.y)));
    const stripes = step(.5, tri(f.x.add(f.y).mul(mix(1, 3, u.detail))));
    const dot = step(f.sub(.5).length(), mix(.12, .3, u.detail));
    const pattern = mix(mix(mix(mix(float(3), float(2), checker), mix(float(3), float(1), stripes), step(.5, kind)),
      float(2), step(1.5, kind)), mix(float(3), float(4), dot), step(2.5, kind));
    const grout = float(1).sub(step(.055, min(f.x, f.y)));
    const haze = step(d, smoothstep(11, 42, depth));
    const plane = mix(mix(pattern, float(0), grout), float(0), haze);
    // Sky: horizon glow, a mountain ridge wrapped around the heading, a striped sun.
    const up = st.y.sub(horizon);
    const azimuth = control.z.add(atan(sx.mul(1.15), float(1)));
    const ridge = fbm(vec2(cos(azimuth), sin(azimuth)).mul(2.6).add(s)).sub(.35).mul(.2).max(.004);
    const mountain = step(up, ridge);
    const sunAzimuth = s.mul(.37).add(control2.z.mul(1.2));
    const delta = atan(sin(azimuth.sub(sunAzimuth)), cos(azimuth.sub(sunAzimuth)));
    const sunDistance = vec2(delta.mul(1.2), up.sub(.13)).length();
    const sunGap = step(up, .13).mul(step(fract(up.mul(52)), up.mul(-9).add(1.3).clamp(0, 1).mul(.55)));
    const sun = step(sunDistance, .085).mul(float(1).sub(sunGap));
    const glow = step(d, float(1).sub(smoothstep(0, .09, up)).mul(.55).mul(u.intensity.div(1.1)));
    const sky = mix(mix(mix(float(0), float(1), glow), float(4), sun), float(3), mountain);
    const index = mix(sky, plane, step(0, below));
    return {
      evolve: lane => { const here = lane(at(vec2(0))); return vec2(index.div(4), mix(here.y, abs(index.div(4).sub(here.x)), .035)); },
      seed: vec2(index.div(4), 0),
    };
  },
  display: ({ state, role }) => byIndex(floor(state.r.mul(4).add(.5)), role),
});

/** Value noise that repeats every `period` cells in y (terrain wraps along the flight path). */
function periodicNoise(p: Point, period: number, salt: Scalar): Scalar {
  const cell = floor(p), f = fract(p), e = f.mul(f).mul(vec2(3).sub(f.mul(2)));
  const at = (dx: number, dy: number) => cellHash(vec2(cell.x.add(dx + 4096), fmod(cell.y.add(dy), period)), salt);
  return mix(mix(at(0, 0), at(1, 0), e.x), mix(at(0, 1), at(1, 1), e.x), e.y);
}
/** 77 Voxel. A heightmap landscape raycast per pixel in 40 geometric steps: the
 * first sample whose projected top covers the pixel colors it by height band,
 * with contour seams, water, dithered haze and a banking camera. The terrain
 * repeats every 256 units along the flight path; it is recomputed every frame. */
const voxel = (): KitGraph => ({
  maxEdge: 176, dither: 'cell', environment: 'heightmap raycast, height-band roles, Bayer haze',
  step: ({ u, s, st, pixel, control, control2, at }) => {
    const d = dither(pixel);
    const salt = s.mul(733);
    const relief = mix(5, 17, u.detail);
    const zoom = mix(1.05, .35, u.scale.sub(1).div(11).clamp(0, 1).sqrt());
    const terrain = (p: Point) => {
      const q = p.mul(.0625).mul(zoom);
      const n = periodicNoise(q, 16, salt).mul(.6).add(periodicNoise(q.mul(2), 32, salt).mul(.27)).add(periodicNoise(q.mul(4), 64, salt).mul(.13));
      return n.sub(.18).max(0).pow(1.35).mul(1.5).clamp(0, 1);
    };
    const water = float(.1);
    const q = rotate(st.sub(.5).mul(vec2(u.aspect, 1)), control.w.mul(-.45));
    const yaw = control.z.add(q.x.mul(.95));
    const direction = vec2(sin(yaw), cos(yaw));
    const camera = vec2(control.x, control.y);
    const ground = max(terrain(camera), terrain(camera.add(vec2(sin(control.z), cos(control.z)).mul(10)))).max(water);
    const altitude = ground.mul(relief).add(mix(5, 11, control2.x));
    const horizon = mix(.1, .24, control2.y);
    const hit = float(0).toVar(), height = float(0).toVar(), distance = float(200).toVar(), spot = vec2(0).toVar();
    Loop(40, ({ i }) => {
      const t = float(1.2).mul(pow(float(1.13), float(i)));
      const p = camera.add(direction.mul(t));
      const h = terrain(p).max(water);
      const top = horizon.add(h.mul(relief).sub(altitude).mul(.95).div(t));
      const covers = step(q.y, top).mul(float(1).sub(hit));
      height.assign(mix(height, h, covers)); distance.assign(mix(distance, t, covers)); spot.assign(mix(spot, p, covers));
      hit.assign(max(hit, covers));
    });
    // Slope light: compare with a sample toward the light; lit faces keep their band color.
    const light = vec2(cos(s.mul(3)), sin(s.mul(3))).mul(2.2);
    const slope = height.sub(terrain(spot.add(light)).max(water)).mul(relief);
    const lit = step(d, smoothstep(-.28, .22, slope));
    const band = floor(height.sub(water).div(float(1).sub(water)).mul(3.6)).clamp(0, 3);
    const contour = step(fract(height.mul(relief).mul(mix(.25, .6, u.detail))), .1).mul(step(water.add(.01), height)).mul(step(distance, 60));
    const land = mix(mix(mix(float(3), float(2), step(.5, band)), float(2), step(1.5, band)), float(4), step(2.5, band));
    // Shaded faces fall to body; body-colored lowlands fall to ground.
    const shadow = mix(float(3), float(0), same(land, 3));
    const surface = mix(mix(mix(shadow, land, lit), float(0), contour.mul(float(1).sub(lit))), float(1), step(height, water.add(.001)));
    const haze = step(d, smoothstep(70, 170, distance));
    const up = q.y.sub(horizon);
    const glow = step(d, float(1).sub(smoothstep(0, .1, up)).mul(.42).mul(u.intensity.div(1.1)));
    const sunAzimuth = s.mul(.41).add(control2.z.mul(1.4));
    const delta = atan(sin(yaw.sub(sunAzimuth)), cos(yaw.sub(sunAzimuth)));
    const sun = step(vec2(delta, up.sub(.2)).length(), .06);
    const sky = mix(mix(float(0), float(1), glow), float(4), sun);
    const index = mix(sky, mix(surface, sky, haze), hit);
    return {
      evolve: lane => { const here = lane(at(vec2(0))); return vec2(index.div(4), mix(here.y, abs(index.div(4).sub(here.x)), .035)); },
      seed: vec2(index.div(4), 0),
    };
  },
  display: ({ state, role }) => byIndex(floor(state.r.mul(4).add(.5)), role),
});

const graphs: Record<RasterFamily, (u: KitInputs) => KitGraph> = {
  "pyre": pyre,
  "tunnel": tunnel,
  "warp": warp,
  "copper": copper,
  "vectorscope": vectorscope,
  "flipdot": flipdot,
  "voxel": voxel,
  "mode7": mode7,
  "orbit": orbit,
  "twister": twister,
};
export function createRaster(u: KitInputs, family: RasterFamily) {
  return createKitStudy(u, family, graphs[family](u), rasterControls(family), rasterSalt);
}
