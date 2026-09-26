import { abs, atan, cos, float, floor, fract, max, min, mix, sin, smoothstep, step, vec2 } from 'three/tsl';
import { cellHash, choose, createKitStudy, fbm, noise, rotate, tri, type Color, type KitGraph, type KitInputs, type Lane, type Point, type Quad, type Scalar } from './kit';
import type { PatternFamily } from './pattern-meta';
import { bandHeights, frameWrap, patternControls, patternSalt } from './pattern-evolution';

// Shared helpers for the pattern studies. Most graphs store a palette-role
// index in R (role / 4: 0 ground, 1 accent, 2 ink, 3 body, 4 trace), so
// nearest transport never blends two roles into a third color.
const wrap = (x: Scalar, n: Scalar | number) => x.sub(floor(x.div(n)).mul(n));
const lift = (v: Scalar | number): Scalar => typeof v === 'number' ? float(v) : v;
/** Hard selection among scalar values by an integer-valued index. */
const pick = (index: Scalar, values: (Scalar | number)[]) => values.slice(1).reduce((value: Scalar, next, i) => mix(value, lift(next), step(i + .5, index)), lift(values[0]));
/** 0 at the smallest scale, 1 at the largest. */
const sizeOf = (u: KitInputs) => u.scale.sub(1).div(11).clamp(0, 1).sqrt();
const roles = (role: (index: 0 | 1 | 2 | 3 | 4) => Color) => [role(0), role(1), role(2), role(3), role(4)];
/** Eased periodic random walk: hash targets at integer T (mod period), so wrapped T stays seamless. */
const walk = (key: Scalar, T: Scalar, period: number, salt: number) => {
  const k0 = wrap(floor(T), period), k1 = wrap(k0.add(1), period), f = fract(T);
  return mix(cellHash(vec2(key, k0), salt), cellHash(vec2(key, k1), salt), f.mul(f).mul(float(3).sub(f.mul(2))));
};
/** The target is rewritten every frame; G keeps a slow |Δ| afterimage (forgotten at 6% per frame). */
const rewrite = (at: (offset: Point) => Quad, target: Scalar) => ({
  evolve: (lane: Lane) => { const here = lane(at(vec2(0))); return vec2(target, mix(here.y, abs(target.sub(here.x)).mul(3).clamp(0, 1), .06)); },
  seed: vec2(target, 0),
});
/** Role-index display with afterimage flecks in the given role over ground-heavy roles. */
const indexed = (flecks: 0 | 1 | 2 | 3 | 4, amount: number, floor_ = .2): KitGraph['display'] => ({ state, role, threshold, u }) => {
  const index = floor(state.r.mul(4).add(.5));
  const flat = choose(index, roles(role));
  const memory = step(threshold, smoothstep(floor_, floor_ + .4, state.g).mul(u.intensity).mul(amount));
  return mix(flat, role(flecks), memory.mul(step(index, .5).add(equalish(index, 3)).clamp(0, 1)));
};

const equalish = (a: Scalar, b: Scalar | number) => float(1).sub(step(.5, abs(a.sub(b))));

/** 61 Tartan. A mirrored sett of warp and weft stripes in a 2/2 twill. The state
 * stores a palette-role index (0–4, as R × 4) so pure transport never blends
 * colors. Snags pull runs of threads inside event footprints, row bands slip,
 * and a shuttle sweeps up the panel weaving in the next sett. Outside snags the
 * sett reasserts stochastically at ≥4.5% per frame, so history is forgotten
 * inside the 128-frame priming window. */
const tartan = (): KitGraph => ({
  maxEdge: 320, environment: 'role-index twill with snags, slipping rows and a re-weaving shuttle',
  step: ({ u, pixel, dimensions, control, control2, local, coin, at, fast }) => {
    // A fractional stripe unit keeps every Scale change visible; stripe edges still
    // fall on whole pixels, so widths simply alternate (for example 7 and 8 px).
    const unit = mix(11, 2, u.scale.sub(1).div(11).clamp(0, 1).sqrt());
    const period = floor(mix(4, 11, u.detail).add(.5));
    // Mirrored sett: stripe k of the half-period P, reflected at each pivot.
    const stripe = (position: Scalar, sett: Scalar) => {
      const n = floor(position.div(unit)), m = n.sub(floor(n.div(period.mul(2))).mul(period.mul(2)));
      const k = mix(m, period.mul(2).sub(1).sub(m), step(period.sub(.5), m));
      const h = cellHash(vec2(k, sett), 7919);
      // Weighted roles: ground-heavy, then ink, body, accent and a rare trace line.
      const role = step(.36, h).add(step(.6, h)).add(step(.8, h)).add(step(.93, h));
      const within = position.sub(n.mul(unit));
      const line = step(.82, cellHash(vec2(k, sett), 104729)).mul(equalish(within, floor(unit.mul(.5))));
      return mix(mix(role, float(4), line), float(0), equalish(k, 0).mul(step(.5, h)));
    };
    const x = pixel.x.add(control.w), y = pixel.y.add(control2.x);
    const settBelow = control.y, settAbove = control.x;
    const shuttle = floor(control.z.mul(dimensions.y.add(2))).sub(1);
    const sett = mix(settAbove, settBelow, step(pixel.y, shuttle));
    const over = step(2, x.add(y).mod(4));
    const index = mix(stripe(x, sett), stripe(y, sett), over);
    // Slipping weft bands: whole bands of rows shift sideways on a staggered clock.
    const band = floor(pixel.y.div(floor(mix(3, 9, cellHash(vec2(floor(pixel.y.div(9)), 3), control2.y)))));
    const phase = cellHash(vec2(band, 11), control2.y);
    const epoch = mix(fast.x, fast.y, step(float(1).sub(phase), fast.z));
    const slip = floor(cellHash(vec2(band, epoch), 17).mul(5)).sub(2).mul(step(.72, cellHash(vec2(band, epoch), 23)));
    // Snags pull individual threads: only some columns (or rows) inside an
    // event core move, along one axis, so runs read as pulled yarn.
    const core = step(.5, local.peak);
    const vertical = step(abs(local.gust.x), abs(local.gust.y));
    const thread = mix(pixel.y, pixel.x, vertical);
    const picked = step(.45, cellHash(vec2(floor(thread.div(2)), sett), 31));
    const reach = floor(mix(abs(local.gust.x), abs(local.gust.y), vertical).mul(2).add(1));
    const direction = mix(float(1).sub(step(local.gust.x, 0).mul(2)), float(1).sub(step(local.gust.y, 0).mul(2)), vertical);
    const pull = mix(vec2(reach.mul(direction), 0), vec2(0, reach.mul(direction)), vertical).mul(picked).mul(core);
    const pan = vec2(control2.z, control2.w);
    // History moves opposite to the sett offset so target and transported rows agree.
    const velocity = mix(vec2(slip, 0), pull, core).sub(pan);
    const woven = equalish(pixel.y, shuttle).add(equalish(pixel.y, shuttle.sub(1))).clamp(0, 1);
    const rate = max(mix(.5, .045, core.mul(picked)), woven);
    return {
      evolve: lane => {
        const moved = lane(at(velocity.negate())), here = lane(at(vec2(0)));
        const target = index.div(4);
        const signal = mix(moved.x, target, step(coin(29), rate));
        return vec2(signal, mix(moved.y, abs(signal.sub(here.x)).mul(3).clamp(0, 1), .06));
      },
      seed: vec2(index.div(4), 0),
    };
  },
  display: ({ state, role, threshold, u }) => {
    const index = floor(state.r.mul(4).add(.5));
    const woven = choose(index, [role(0), role(2), role(3), role(1), role(4)]);
    const worn = step(threshold, smoothstep(.22, .6, state.g).mul(u.intensity).mul(.55));
    return mix(woven, role(1), worn.mul(step(index, 2.5)));
  },
});


/** 62 Ikat. Half-drop lattice of stepped lozenges with nested bands. Every
 * two-row thread bundle carries its own dye offset, so motif edges feather
 * sideways; bundles drift on independent eased walks and history moves with
 * them. Motif columns are re-dyed on a staggered clock and the new color
 * arrives in horizontal thread segments (≥5% per segment per frame), while
 * event cores smear rows into longer bleeds. */
const ikat = (): KitGraph => ({
  maxEdge: 300, environment: 'role-index lozenges; feathered bundle offsets and segment-wise re-dyeing',
  step: ({ u, pixel, control, control2, local, carrier, at }) => {
    const width = floor(mix(58, 16, sizeOf(u)).add(.5)), height = floor(width.mul(1.34).add(.5));
    const bundle = floor(pixel.y.div(2));
    const offset = (T: Scalar) => floor(walk(bundle, T, 256, 41).sub(.5).mul(control.z).add(walk(floor(bundle.div(7)), T.mul(.37), 256, 43).sub(.5).mul(control.w)).add(.5));
    const now = offset(control2.x), before = offset(control2.y);
    // Bleeds: inside event cores each bundle repeats one dyed pixel across a
    // run whose length grows with the event, giving hard horizontal streaks.
    const bleed = smoothstep(.45, .8, local.peak);
    const run = floor(bleed.mul(18)).add(1);
    const x = pixel.x.add(now).add(8192), y = pixel.y.add(8192);
    const streaked = x.sub(wrap(x.add(floor(cellHash(vec2(bundle, 5), 47).mul(run))), run));
    const column = floor(streaked.div(width));
    const drop = wrap(column, 2).mul(.5);
    const row = floor(y.div(height).sub(drop));
    const steps_ = floor(mix(6, 2, u.detail).add(.5));
    const lx = fract(streaked.div(width)).sub(.5);
    const ly = floor(fract(y.div(height).sub(drop)).sub(.5).mul(height).div(steps_)).add(.5).mul(steps_).div(height);
    // Feathered dye: each bundle of each motif is shifted by up to a few pixels.
    const jag = floor(cellHash(vec2(bundle.add(64), column.mul(31).add(row.mul(7)).add(64)), 53).sub(.5).mul(u.intensity.mul(3.2).add(2.2))).div(width);
    const d = abs(lx.add(jag)).mul(2).add(abs(ly).mul(2));
    // Motif columns change species on a staggered 40 s clock.
    const phase = cellHash(vec2(column, 3), 59);
    const epoch = wrap(floor(control2.w.div(2400).add(phase)), frameWrap / 2400);
    const species = cellHash(vec2(column, epoch), 61);
    const bands = floor(mix(2, 5, u.detail).add(species.mul(1.4)));
    const band = floor(d.mul(bands));
    const order = floor(species.mul(4));
    const sequence = pick(wrap(band.add(order), 4), [2, 3, 1, 4]);
    const eye = step(.62, cellHash(vec2(column, row.add(epoch)), 67)).mul(step(d, .18));
    const plain = step(.84, cellHash(vec2(column, epoch), 71));
    const stripe = step(abs(lx.add(jag)), .09).mul(3);
    const role = mix(mix(float(0), sequence, step(d, 1)), float(1), eye);
    const target = mix(role, stripe, plain).div(4);
    // History moves with its bundle, so only re-dyes and bleeds need replenishing.
    const velocity = vec2(now.sub(before).negate(), 0);
    const segment = cellHash(vec2(bundle, floor(pixel.x.div(7))), carrier);
    const rate = float(.14);
    return {
      evolve: lane => {
        const moved = lane(at(velocity.negate())), here = lane(at(vec2(0)));
        const signal = mix(moved.x, target, step(segment, rate));
        return vec2(signal, mix(moved.y, abs(signal.sub(here.x)).mul(3).clamp(0, 1), .05));
      },
      seed: vec2(target, 0),
    };
  },
  display: indexed(1, .3, .4),
});

/** 63 Truchet. Quarter-arc tiles form one continuous maze; the arcs also split
 * the plane into two interlocking regions. Two travelling fronts flip tiles by
 * XOR as they pass and event cores flip whole patches, rerouting the maze
 * while dashes run along its paths. The target is rewritten each frame; the
 * afterimage marks recently rerouted tiles. */
const truchet = (): KitGraph => ({
  maxEdge: 360, environment: 'quarter-arc tiles, rotating flips along travelling fronts',
  step: ({ u, pixel, dimensions, control, control2, arrivals, at }) => {
    const size = floor(mix(46, 11, sizeOf(u)).add(.5));
    const pan = vec2(control.x, control.y);
    const p = pixel.add(pan).add(8192);
    const tile = floor(p.div(size)), f = fract(p.div(size));
    const center = tile.add(.5).mul(size).sub(pan).sub(8192).div(dimensions);
    const base = step(.5, cellHash(tile, control2.z));
    const front = (angle: Scalar, wavelength: Scalar, phase: Scalar) => phase.sub(tile.dot(vec2(cos(angle), sin(angle))).div(wavelength));
    const main = front(control.z, control.w, control2.x);
    const other = front(control.z.add(2.2), control.w.mul(.63), control2.w);
    const hit = step(.55, arrivals(center).peak);
    const parity = wrap(floor(main), 2), parity2 = wrap(floor(other), 2);
    const bit = abs(abs(abs(base.sub(parity)).sub(parity2)).sub(hit));
    const q = f;
    const c1 = mix(vec2(0, 0), vec2(1, 0), bit), c2 = mix(vec2(1, 1), vec2(0, 1), bit);
    const d1 = q.sub(c1).length(), d2 = q.sub(c2).length();
    const near = min(d1, d2);
    const width = mix(.045, .18, u.detail).max(float(1.2).div(size));
    const onPath = step(abs(near.sub(.5)), width);
    const checker = wrap(tile.x.add(tile.y).add(bit), 2);
    const region = abs(step(near, .5).sub(checker));
    // Dashes: arc parameter around the owning corner; the checkerboard alternates direction so loops circulate.
    const which = step(d2, d1), corner = mix(c1, c2, which);
    const along = atan(q.y.sub(corner.y), q.x.sub(corner.x)).div(1.5708);
    const sense = abs(checker.sub(which)).mul(2).sub(1);
    const dash = step(mix(.9, .25, u.intensity.sub(.1).div(1.9)), fract(along.mul(2).add(control2.y.mul(sense)))).mul(step(abs(near.sub(.5)), width.mul(.5)));
    const role = mix(mix(float(0), float(3), region), mix(float(2), float(1), dash), onPath);
    return rewrite(at, role.div(4));
  },
  display: indexed(4, .6, .25),
});

/** 64 Bauhaus. A modular grid of quarter discs, half moons, discs, triangles,
 * bars, rings, squares and arches in flat roles. Some rows are conveyor belts
 * that step one cell at a time; a direction-changing wave turns tiles through
 * quarter turns; detail subdivides cells; event cores swap figure and ground.
 * Rewritten every frame; the afterimage records the turning edges. */
const bauhaus = (): KitGraph => ({
  maxEdge: 320, environment: 'turning modular tiles on stepping belts',
  step: ({ u, pixel, dimensions, control, control2, arrivals, at }) => {
    const size = floor(mix(76, 18, sizeOf(u)).add(.5));
    const F = control2.w;
    const row = floor(pixel.y.div(size)).add(64);
    const belt = step(.5, cellHash(vec2(row, 5), control2.z));
    const direction = step(.5, cellHash(vec2(row, 9), control2.z)).mul(2).sub(1);
    const beat = F.div(150).add(cellHash(vec2(row, 13), control2.z));
    const shift = wrap(floor(beat), 64).add(smoothstep(.55, 1, fract(beat))).mul(size).mul(direction).mul(belt);
    const x = pixel.x.sub(shift).add(size.mul(64));
    const cell = vec2(wrap(floor(x.div(size)), 64), row);
    const local = vec2(fract(x.div(size)), fract(pixel.y.div(size)));
    const split = step(cellHash(cell, 71), u.detail.mul(.7));
    const sub = floor(local.mul(2)).mul(split);
    const key = cell.mul(2).add(sub);
    const lp = mix(local, fract(local.mul(2)), split).sub(.5);
    const center = pixel.sub(lp.mul(mix(size, size.mul(.5), split))).div(dimensions);
    // A cascade of quarter turns: rest, then snap through 90° as the wave passes.
    const wave = control2.x.sub(key.dot(vec2(cos(control.z), sin(control.z))).div(control.w.mul(2)));
    const turns = floor(wave).add(smoothstep(.5, 1, fract(wave)));
    const spin = step(.3, cellHash(key, 73)).mul(step(.5, cellHash(key, 79)).mul(2).sub(1));
    const q = rotate(lp, turns.mul(1.5708).mul(spin));
    const retype = wrap(floor(F.div(1800).add(cellHash(key, 83))), frameWrap / 1800);
    const h = cellHash(key.add(vec2(0, retype.mul(263))), 89);
    const r0 = q.add(.5).length();
    const shape = pick(floor(h.mul(8)), [
      step(r0, 1), step(q.sub(vec2(0, -.5)).length(), .5), step(q.length(), .36), step(q.x.add(q.y), 0),
      step(fract(q.x.add(.5).mul(3)), .5), step(abs(q.length().sub(.3)), .085), step(max(abs(q.x), abs(q.y)), .24), step(abs(r0.sub(.72)), .16),
    ]);
    const loud = u.intensity.sub(.1).div(1.9);
    const bgHash = cellHash(key, 97);
    const bg = mix(float(0), pick(floor(bgHash.mul(3)), [3, 2, 1]), step(mix(.85, .2, loud), bgHash));
    const fgRaw = pick(floor(cellHash(key, 101).mul(5)), [2, 1, 4, 3, 2]);
    const fg = mix(fgRaw, mix(float(2), float(0), step(.5, bg)), equalish(fgRaw, bg));
    const invert = step(.5, arrivals(center).peak);
    const figure = abs(shape.sub(invert));
    return rewrite(at, mix(bg, fg, figure).div(4));
  },
  display: indexed(4, .55, .25),
});

/** 65 Marbling. Paint bands floating on size are drawn through three combs
 * (vertical tines, horizontal tines, a fine comb back) using the tine law
 * shift = z·λ/(d + λ), and a stone drop pushes the whole field outward with the
 * area-preserving law. Tine positions, amplitudes and the drop evolve on eased
 * tracks, so the combed pattern keeps redrawing without a loop. */
const marbling = (): KitGraph => ({
  maxEdge: 384, environment: 'combed paint bands with a stone drop',
  step: ({ u, pixel, dimensions, control, control2, warp, drift, s, at }) => {
    const band = mix(15, 4, sizeOf(u));
    const teeth = mix(80, 20, u.detail);
    const comb = (coordinate: Scalar, phase: Scalar, spacing: Scalar) => {
      const d = abs(wrap(coordinate.sub(phase).add(spacing.mul(.5)), spacing).sub(spacing.mul(.5)));
      const lambda = spacing.mul(.16);
      return lambda.div(d.add(lambda));
    };
    const strength = u.intensity.mul(.35).add(.65);
    const y1 = pixel.y.sub(comb(pixel.x, control.x, teeth).mul(teeth).mul(control.w.mul(1.1).add(.35)).mul(strength));
    const x1 = pixel.x.sub(comb(y1, control.y, teeth.mul(1.3)).mul(teeth.mul(1.2)).mul(warp.z.mul(1.5).sub(.35)).mul(strength));
    // The fine comb alternates tine direction, which draws feathers through the chevrons.
    const fine = teeth.mul(.5), tine = floor(x1.sub(control.z).div(fine).add(.5));
    const alternate = wrap(tine, 2).mul(2).sub(1);
    const y2 = y1.add(comb(x1, control.z, fine).mul(teeth.mul(.5)).mul(warp.w.mul(1.2).add(.1)).mul(alternate).mul(strength));
    // Stone drop: points outside are pushed outward, area preserved; inside are rings of the new paint.
    const stone = control2.xy.mul(dimensions), radius = control2.z.mul(dimensions.y);
    const d = vec2(x1, y2).sub(stone), r2 = d.dot(d).max(1e-3);
    const inside = step(r2, radius.mul(radius));
    const pushed = stone.add(d.mul(float(1).sub(radius.mul(radius).div(r2)).max(0).sqrt()));
    const wobble = noise(vec2(pushed.x.mul(.013), pushed.y.mul(.035)).add(s)).sub(.5).mul(band.mul(2.6));
    const v = pushed.y.add(wobble).add(drift.y.mul(band.mul(3)));
    const index = wrap(floor(v.div(band)), 8);
    const paint = pick(index, [0, 2, 3, 0, 1, 2, 0, 4]);
    const rings = pick(wrap(floor(r2.sqrt().div(band.mul(.6))), 3), [1, 4, 2]);
    return rewrite(at, mix(paint, rings, inside).div(4));
  },
  display: indexed(4, .35, .35),
});

/** 66 Rosette. Three AM halftone screens at 15°, 75° and 45° carry ink, accent
 * and body; overlapping accent and body dots print trace. Dot centers sample
 * separate tone fields, so every dot stays a clean pixel disc; registration
 * and screen angles drift. Event cores slur the sheet: each row repeats one
 * printed pixel across a run, doubling dots sideways. Rewritten each frame. */
const rosette = (): KitGraph => ({
  maxEdge: 384, environment: 'three rotated AM screens with drifting registration',
  step: ({ u, pixel, dimensions, control, control2, drift, arrivals, local, at, toDomain }) => {
    const cellSize = mix(15, 5, u.detail);
    const slur = smoothstep(.55, .85, local.peak);
    const run = floor(slur.mul(14)).add(1);
    const printed = vec2(pixel.x.sub(wrap(pixel.x.add(floor(cellHash(vec2(pixel.y, 3), 29).mul(run))), run)), pixel.y);
    const screen = (angle: Scalar, offset: Point, salt: number, bias: number, which: number) => {
      const q = rotate(printed.sub(offset), angle).div(cellSize);
      const f = fract(q).sub(.5);
      const centerPx = rotate(floor(q).add(.5).mul(cellSize), angle.negate()).add(offset);
      const uv_ = centerPx.div(dimensions);
      const domain = toDomain(uv_);
      const field = noise(domain.mul(.9).add(vec2(drift.x, drift.y).mul(.4 + which * .3)).add(salt)).mul(.62)
        .add(noise(domain.mul(2.2).sub(vec2(drift.z, drift.w).mul(.5)).add(salt * 1.7)).mul(.38));
      const event = arrivals(uv_);
      // Events thicken one screen locally: deposits favor accent, erasures favor body.
      const boost = which === 0 ? event.peak.mul(.25) : event.peak.mul(which === 1 ? step(.5, event.level) : step(event.level, .5)).mul(.6);
      const tone = smoothstep(bias, bias + .46, field).add(boost).mul(u.intensity.mul(.3).add(.62)).clamp(0, 1);
      return step(f.length(), tone.sqrt().mul(.56));
    };
    const deg = 0.0174533;
    const ink = screen(control2.x.add(15 * deg), vec2(0, 0), 3, .52, 0);
    const accent = screen(control2.y.add(75 * deg), vec2(control.x, control.y), 11, .44, 1);
    const body = screen(control2.z.add(45 * deg), vec2(control.z, control.w), 19, .42, 2);
    const role = mix(mix(mix(float(0), float(3), body), mix(float(1), float(4), body), accent), float(2), ink);
    return rewrite(at, role.div(4));
  },
  display: indexed(4, .3, .35),
});

/** 67 Bargello. Flame stitch: stitch columns step through a zigzag profile
 * built from two triangle waves and event-driven spires; color bands cycle
 * through a shaded role sequence and climb one row every eight frames. The
 * profile's peaks, spacing and phase move on eased tracks. Rewritten each frame. */
const bargello = (): KitGraph => ({
  maxEdge: 288, dither: 'cell', environment: 'climbing flame-stitch bands',
  step: ({ u, pixel, dimensions, control, control2, arrivals, at }) => {
    const height = pick(floor(sizeOf(u).mul(7.99)), bandHeights);
    const length = floor(mix(2, 7, u.detail).add(.5));
    const stepRows = floor(length.mul(.5).add(.5)).max(1);
    const column = floor(pixel.x.div(2));
    const amplitude = dimensions.y.mul(u.intensity.mul(.09).add(.06));
    const profile = tri(column.div(control.z).add(control.x)).mul(amplitude).mul(control2.x.mul(.8).add(.4))
      .add(tri(column.div(control.w).add(control.y)).mul(amplitude.mul(.55)).mul(control2.y))
      .add(arrivals(vec2(pixel.x.div(dimensions.x), .5)).peak.pow(2).mul(amplitude.mul(1.2)));
    const lifted = floor(profile.div(stepRows)).mul(stepRows);
    const climb = wrap(floor(control2.w.div(8)), height.mul(8));
    const v = pixel.y.sub(lifted).add(climb).add(height.mul(64));
    const index = wrap(floor(v.div(height)), 8);
    const role = pick(index, [0, 3, 2, 3, 0, 1, 4, 1]);
    // Stitch ends: a single row where two stitches meet inside a band, in a nearby role.
    const within = wrap(v, height), seam = equalish(wrap(within, length), 0).mul(step(.5, within));
    const seamRole = pick(index, [3, 2, 3, 2, 3, 4, 1, 4]);
    return rewrite(at, mix(role, seamRole, seam.mul(step(.5, wrap(column, 2)))).div(4));
  },
  display: ({ state, role }) => choose(floor(state.r.mul(4).add(.5)), roles(role)),
});

/** 68 Vega. An op-art grid of discs whose size, shape and color follow two
 * moving lenses: the area-mapping bulge magnifies cells, discs morph toward
 * squares and step through the palette as magnification grows. Event cores
 * invert the checkerboard. Rewritten each frame. */
const vega = (): KitGraph => ({
  maxEdge: 384, environment: 'bulging op-art grid under two lenses',
  step: ({ u, st, control, control2, drift, local, at }) => {
    const p = st.sub(.5).mul(vec2(u.aspect, 1));
    const lens = (point: Point, center: Point, radius: Scalar, power: Scalar) => {
      const d = point.sub(center), r = d.length().max(1e-4);
      const inside = step(r, radius);
      const factor = r.div(radius).pow(power.sub(1));
      return { point: center.add(d.mul(mix(float(1), factor, inside))), bulge: inside.mul(float(1).sub(r.div(radius))) };
    };
    const strength = u.detail.mul(1.7).add(.25), reach = u.intensity.mul(.35).add(.6);
    const a = lens(p, control.xy, control2.x.mul(reach), control2.z.mul(strength).add(1));
    const b = lens(a.point, control.zw, control2.y.mul(reach), control2.w.mul(strength).add(1));
    const bulge = max(a.bulge, b.bulge).mul(u.detail.mul(.5).add(.75)).clamp(0, 1);
    const cells = mix(6, 26, sizeOf(u));
    const g = b.point.add(drift.xy.mul(.05)).mul(cells).add(512);
    const cell = floor(g), f = fract(g).sub(.5);
    const pinch = smoothstep(.35, .7, local.peak);
    const checker = wrap(cell.x.add(cell.y), 2);
    const n = mix(2, 9, smoothstep(.1, .7, bulge));
    const shape = abs(f.x).pow(n).add(abs(f.y).pow(n)).pow(float(1).div(n));
    const inside = step(shape, mix(.27, .47, bulge).mul(float(1).sub(pinch.mul(.55))));
    const bg = mix(float(0), float(2), checker);
    const lensRole = pick(floor(bulge.mul(4.4)), [2, 3, 1, 4, 4]);
    const fg = mix(mix(float(2), float(0), checker), mix(lensRole, float(3), checker.mul(step(.25, bulge))), step(.08, bulge));
    const figure = mix(fg, float(3), step(.5, pinch).mul(step(bulge, .05)));
    return rewrite(at, mix(bg, figure, inside).div(4));
  },
  display: indexed(1, .35, .35),
});

/** 69 Kaleidoscope. Glass pieces (a Voronoi field with orbiting seeds) are
 * folded into 6–16 mirrored wedges around a wandering center, with leading
 * between pieces, concentric bead rings and a jewel at the axis. The tube
 * turns on an eased random walk and the pieces slide across the wedge; no zoom
 * feedback. Rewritten each frame; the afterimage trails the turning pieces. */
const kaleidoscope = (): KitGraph => ({
  maxEdge: 320, environment: 'mirrored Voronoi glass in a turning tube',
  step: ({ u, st, control, control2, drift, local, at }) => {
    const p = st.sub(control.xy).mul(vec2(u.aspect, 1));
    const r = p.length();
    const count = floor(mix(3, 8, u.detail).add(.5)).mul(2);
    const wedge = float(6.28319).div(count);
    const theta = atan(p.y, p.x).add(control.z);
    const folded = abs(wrap(theta, wedge).sub(wedge.mul(.5)));
    const density = mix(4, 15, sizeOf(u));
    const fp = vec2(cos(folded), sin(folded)).mul(r).mul(density).add(drift.xy.mul(.35)).add(64);
    const cell = floor(fp);
    const best = float(9).toVar(), second = float(9).toVar(), owner = vec2(0).toVar();
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
      const c = cell.add(vec2(dx, dy));
      const h = cellHash(c, 7), k = floor(cellHash(c, 11).mul(3)).sub(1);
      const angle = h.add(control2.x.mul(k)).mul(6.28319);
      const seed = c.add(.5).add(vec2(cos(angle), sin(angle)).mul(.36));
      const d = fp.sub(seed).length();
      const closer = step(d, best);
      second.assign(mix(min(second, d), best, closer));
      owner.assign(mix(owner, c, closer));
      best.assign(min(best, d));
    }
    const weight = u.intensity.sub(.1).div(1.9);
    const lead = step(second.sub(best), mix(.025, .14, weight).add(local.peak.mul(.05)));
    const glass = pick(floor(cellHash(owner, 13).mul(7)), [0, 3, 1, 2, 0, 4, 3]);
    // Bead rings: fixed radii, dotted along the folded angle so they turn with the tube.
    const ring = r.mul(density.mul(1.3));
    const beads = step(tri(ring), .2).mul(step(mix(.9, .35, weight), cellHash(vec2(floor(ring).add(64), 3), 17))).mul(step(tri(folded.mul(r).mul(density.mul(4))), .55));
    const jewel = step(r, .035);
    const role = mix(mix(mix(glass, float(2), lead), float(4), beads.mul(float(1).sub(lead))), mix(float(1), float(2), step(.022, r)), jewel);
    return rewrite(at, role.div(4));
  },
  display: indexed(4, .4, .3),
});

/** 70 Hatch. Engraving: three line sets along warped, slowly turning curves.
 * The first swells and thins with tone and breaks into dashes in the lights; a
 * cross set enters in the mid-tones and a third in the shadows. Forms switch
 * line direction, as an engraver would. Event cores print a flat spot color
 * under the lines, outlined in trace. The tone field drifts beneath fixed line
 * phases. Rewritten each frame. */
const hatch = (): KitGraph => ({
  maxEdge: 384, environment: 'tonal engraving with cross-hatching and a spot color',
  step: ({ u, pixel, st, domain, drift, local, control, toDomain, at }) => {
    const pitch = floor(mix(11, 4, u.detail).add(.5));
    const forms = noise(domain.mul(.42).add(drift.zw.mul(.3))).mul(.65).add(noise(domain.mul(1.1).sub(drift.xy.mul(.2))).mul(.35));
    const tone = smoothstep(.2, .8, forms.add(local.peak.mul(local.level.sub(.5)).mul(.5))).mul(u.intensity.mul(.25).add(.8)).clamp(0, 1);
    const bend = fbm(toDomain(st).mul(.5).add(drift.xy.mul(.12))).sub(.5).mul(pitch.mul(16));
    const region = step(.52, noise(domain.mul(.3).sub(drift.zw.mul(.15)).add(7)));
    const angle = control.x.add(region.mul(.95));
    const line = (offset: number, curve: Scalar, width: Scalar) => step(tri(rotate(pixel, angle.add(offset)).y.add(curve).div(pitch)), width);
    const first = line(0, bend, tone.mul(.6).add(.05));
    const second = line(1.2, bend.mul(.5), tone.sub(.38).mul(1.3).clamp(0, .5));
    const third = line(-1, bend.mul(.25), tone.sub(.7).mul(1.6).clamp(0, .45));
    const spot = step(.42, local.peak).mul(step(.5, local.level));
    const outline = step(.36, local.peak).mul(float(1).sub(step(.42, local.peak))).mul(step(.5, local.level));
    const paper = mix(mix(float(0), float(1), spot), float(4), outline);
    const role = mix(mix(paper, float(3), max(second, third).mul(float(1).sub(first))), float(2), first);
    return rewrite(at, role.div(4));
  },
  display: ({ state, role }) => choose(floor(state.r.mul(4).add(.5)), roles(role)),
});

const graphs: Record<PatternFamily, () => KitGraph> = {
  "tartan": tartan,
  "ikat": ikat,
  "truchet": truchet,
  "bauhaus": bauhaus,
  "marbling": marbling,
  "rosette": rosette,
  "bargello": bargello,
  "vega": vega,
  "kaleidoscope": kaleidoscope,
  "hatch": hatch,
};
export function createPattern(u: KitInputs, family: PatternFamily) {
  return createKitStudy(u, family, graphs[family](), patternControls(family), patternSalt);
}
