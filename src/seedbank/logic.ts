import type { Node } from 'three/webgpu';
import { abs, cos, exp2, float, floor, fract, int, max, min, mix, sin, smoothstep, step, vec2, vec4 } from 'three/tsl';
import { cellHash, choose, createKitStudy, equal, noise, pick4, ramp, rotate, steps, tri, type Color, type DisplayContext, type KitGraph, type KitInputs, type Point, type Scalar, type StepContext } from './kit';
import type { LogicFamily } from './logic-meta';
import { logicControls, logicSalt } from './logic-evolution';

const TAU = Math.PI * 2;
/** Bit i of a non-negative integer held in a float (exact below 2²⁴); i may be a node. */
const bitAt = (n: Scalar, i: Scalar | number) => n.div(typeof i === 'number' ? 1 << i : exp2(i)).floor().mod(2);
/** n with bit i replaced by b (0 or 1). */
const withBit = (n: Scalar, i: Scalar | number, b: Scalar) => { const weight = typeof i === 'number' ? float(1 << i) : exp2(i); return n.sub(bitAt(n, i).mul(weight)).add(b.mul(weight)); };
/** Rounds a direction to the nearest of eight integer neighbour offsets. */
const ring = (angle: Scalar) => floor(vec2(cos(angle), sin(angle)).mul(1.2).add(.5));
/** Torn tonal islands from the kit's warped fields, extrapolated past 0–1 for hard
 * zones, with the local arrivals' tone deposited inside their footprints. */
const islands = ({ field, other, local }: Pick<StepContext, 'field' | 'other' | 'local'>, k = 2.6) =>
  field.sub(.5).mul(k).add(.5).add(other.sub(.5).mul(.9)).add(local.level.sub(.5).mul(local.mass.clamp(0, 1)));
/** Fine incisions: triangle-wave contours of the field, the intricacy vocabulary. */
const incisions = ({ field, other }: Pick<StepContext, 'field' | 'other'>, density: Scalar) => tri(field.mul(density).add(other.mul(2.7))).sub(.5).mul(1.1);
/** Standard odd/even compare-exchange on one axis: partners agree on the axis and pick complementary min/max. */
function exchange({ pixel, tick, warp, at }: StepContext, lane: (v: ReturnType<StepContext['at']>) => Point, horizontal: Scalar, threshold = .06, strength = .8) {
  const coordinate = mix(pixel.y, pixel.x, horizontal);
  const parity = coordinate.add(tick).mod(2), direction = float(1).sub(parity.mul(2));
  const order = abs(parity.sub(step(.5, warp.w)));
  const here = lane(at(vec2(0))).x, partner = lane(at(mix(vec2(0, direction), vec2(direction, 0), horizontal))).x;
  const eligible = step(threshold, min(here, partner));
  return mix(here, mix(min(here, partner), max(here, partner), order), eligible.mul(strength));
}
/** The kit's accumulate step with a faster change envelope (12% per frame instead
 * of 3.5%). These sources carry no per-frame carrier noise, so an edge must
 * register in the frame it passes for the afterimage to show at all. */
const settle = (history: Scalar, here: Point, target: Scalar, injection: number, gain = 1.035) => {
  const signal = mix(history, target, injection).sub(.5).mul(gain).add(.5).clamp(0, 1);
  return vec2(signal, mix(here.y, abs(signal.sub(here.x)), .12).clamp(0, 1));
};
/** Flat roles along the tonal ramp with stationary, dithered boundaries. */
const tonal = (ctx: DisplayContext, spread = .8) => steps(ctx.state.r, ramp(ctx.role, ctx.count), ctx.threshold, spread);
/** Accent coverage from the change envelope: the afterimage convention of the first ten. */
const afterimage = (ctx: DisplayContext, base: Color, low = .03, high = .22, gain = .85) =>
  mix(base, ctx.role(1), step(fract(ctx.threshold.add(.37)), smoothstep(low, high, ctx.state.g).mul(ctx.u.intensity).mul(gain).clamp(0, 1)));
/** Row marks that change every frame: a marked row shows the next lower step. */
const rowMark = ({ cell, carrier }: DisplayContext, level: number, rows: number, salt: number) => step(level, cellHash(vec2(floor(cell.y.div(rows)), carrier), salt));

/** Periods of the four bit-plane refresh clocks (frames); the score passes frame mod each. */
export const MUNCH_PERIODS = [41, 59, 73, 97] as const;
/** 91 Munch. Bytebeat textures (x ^ y, hyperbolic products, rotated munching
 * squares) on domain-warped 8-bit coordinates at two cells per bit, so the
 * lattice bends instead of repeating. The 4-bit value is transported one bit
 * plane at a time: each plane pulls from its own integer direction, and 16-cell
 * blocks resow each plane from the fresh texture on their own asynchronous clock
 * (every 41–97 frames, hashed phase), so no bit is older than 97 frames and no
 * per-pixel coin ever sprinkles dust. Islands invert the texture; events deposit
 * a flat tone and resow all planes, which the planes then munch apart. */
const munch = (): KitGraph => ({
  maxEdge: 256, dither: 'cell', environment: 'bit textures on warped coordinates; bit planes transported separately and block-resown',
  step: ctx => {
    const { u, pixel, control, control2, bend, fold, field, other, local, coin, at } = ctx;
    // The displayed nibble is taken from the high bits: the low bits of x ^ y
    // alternate every cell and read as static, while bits 3–6 draw the nested
    // diamonds of munching squares. Scale slides the window; detail bends it.
    const shift = int(floor(mix(5.99, 2, u.scale.sub(1).div(11).clamp(0, 1))));
    const amount = mix(6, 48, u.detail);
    const X = floor(pixel.x.add(bend.sub(.5).mul(amount)).add(control.x)).mod(256).add(256);
    const Y = floor(pixel.y.add(fold.sub(.5).mul(amount)).add(control.y)).mod(256).add(256);
    const xi = int(X), yi = int(Y), mask = int(15);
    const nibble = (n: Node<'int'>) => float(n.shiftRight(shift).bitAnd(mask));
    // Munching squares, their 45° cousin, and the Sierpinski pair (x & y sparse, x | y dense).
    const textures = vec4(
      nibble(xi.bitXor(yi)),
      nibble(xi.add(yi).bitXor(xi.sub(yi).add(int(1024)))),
      nibble(xi.bitAnd(yi)),
      nibble(xi.bitOr(yi)));
    const region = floor(noise(vec2(field, other).mul(2.3).add(u.seed)).mul(3.99));
    let tex = pick4(region, textures);
    tex = mix(tex, float(15).sub(tex), step(.56, other));
    const flat = smoothstep(.3, .9, local.peak);
    tex = mix(tex, floor(local.level.mul(15).add(.5)), flat);
    const angles = [control2.z, control2.w, control2.z.add(.25), control2.w.add(.25)];
    const clocks = [control.z, control.w, control2.x, control2.y];
    // Each plane steps one cell on its own rhythm (every 2, 3, 4 or 5 frames), so
    // the planes drift apart slowly instead of scrambling every frame.
    const directions = angles.map((t, k) => floor(vec2(cos(t.mul(TAU)), sin(t.mul(TAU))).mul(1.2).add(local.gust.mul(1.4)).add(.5)).mul(equal(clocks[k].mod(k + 2), 0)));
    const block = floor(pixel.div(16));
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        let value: Scalar = float(0);
        directions.forEach((offset, k) => {
          const period = MUNCH_PERIODS[k];
          const phase = floor(cellHash(block, 300 + k).mul(period));
          const refresh = max(equal(clocks[k].add(phase).mod(period), 0), step(coin(k * 7 + 1), flat));
          const moved = lane(at(offset.negate())).x.mul(15).add(.5).floor();
          value = value.add(mix(bitAt(moved, k), bitAt(tex, k), refresh).mul(1 << k));
        });
        const v = value.div(15);
        return vec2(v, mix(here.y, abs(v.sub(here.x)), .05).clamp(0, 1));
      },
      seed: vec2(tex.div(15), 0),
    };
  },
  display: ctx => {
    const { state } = ctx;
    const colors = ramp(ctx.role, ctx.count);
    // The texture is already discrete: hard steps, no coverage dither. About one
    // row pair in eight flickers one step down each frame.
    const level = state.r.mul(15).add(.5).floor();
    const mark = rowMark(ctx, .88, 2, 5);
    const index = level.mul(colors.length).div(16).sub(mark.mul(.9)).floor().clamp(0, colors.length - 1);
    return afterimage(ctx, choose(index, colors), .04, .28, .8);
  },
});

/** 92 Butterfly. 64-cell tiles run a shuffle network: every frame the content
 * of a gated tile shifts one cell and then has two coordinate bits permuted
 * (swap two x bits, two y bits, an x bit with a y bit, shear one into the other,
 * or mirror one bit). A swap alone would toggle between two states; composed
 * with the shift it walks a long orbit, so blocks of every size trade places
 * while sliding. Outside the gated tiles, currents and compare/exchange move the
 * islands. Injection of 20% per frame forgets the start: (.8 × 1.035)¹²⁸ ≈ 1e-10. */
const butterfly = (): KitGraph => ({
  maxEdge: 256, environment: 'coordinate-bit shuffle network on gated tiles over transported islands',
  step: ctx => {
    const { u, st, pixel, texel, control, control2, other, fold, bend, local, read, at, bounded, tick, slow } = ctx;
    const TILE = 64;
    // The tile grid itself jumps to a new hashed origin on the slow clock, so no
    // static lattice of tile seams builds up.
    const origin = vec2(floor(cellHash(vec2(slow.x, 1), 91).mul(TILE)), floor(cellHash(vec2(slow.x, 2), 91).mul(TILE)));
    const shifted = pixel.add(origin);
    const tile = floor(shifted.div(TILE)), lp = shifted.sub(tile.mul(TILE));
    const block = floor(st.mul(vec2(u.aspect, 1)).mul(u.scale.mul(2.6)).add(bend.mul(1.6)).add(4096));
    const source = mix(islands(ctx), cellHash(block, 17).mul(1.3).sub(.15), step(.62, other));
    const bits = mix(2, 6, u.detail);
    const permute = (op: typeof control, p: Point) => {
      const i = floor(op.y.mul(bits)), j = floor(op.z.mul(bits));
      const bx = bitAt(p.x, i), bxj = bitAt(p.x, j), byi = bitAt(p.y, i), byj = bitAt(p.y, j);
      const swapX = vec2(withBit(withBit(p.x, i, bxj), j, bx), p.y);
      const swapY = vec2(p.x, withBit(withBit(p.y, i, byj), j, byi));
      const cross = vec2(withBit(p.x, i, byj), withBit(p.y, j, bx));
      const shear = vec2(withBit(p.x, i, abs(bx.sub(byj))), p.y);
      const mirror = vec2(withBit(p.x, i, float(1).sub(bx)), p.y);
      const shift = vec2(float(1).sub(step(.5, fract(op.w.mul(.37))).mul(2)), step(.5, fract(op.w.mul(.53))));
      const shifted = p.add(shift).add(TILE).mod(TILE);
      const kind = op.x;
      const permuted = swapX.mul(equal(kind, 0)).add(swapY.mul(equal(kind, 1))).add(cross.mul(equal(kind, 2))).add(shear.mul(equal(kind, 3))).add(mirror.mul(equal(kind, 4)));
      // Gate per tile: a hashed field on the tile grid, offset by the op's seed.
      const gate = step(.42, noise(tile.mul(.61).add(vec2(op.w.mul(.037), op.w.mul(.011)))));
      return { point: mix(p, permuted, gate), gate, shifted };
    };
    const first = permute(control, lp);
    const second = permute(control2, first.point);
    const gate = max(first.gate, second.gate);
    // Only shift where a permutation applies, so calm tiles keep the plain currents.
    const from = tile.mul(TILE).add(mix(second.point, permute(control2, permute(control, first.shifted).point).point, gate)).sub(origin);
    const velocity = floor(vec2(fold.sub(.5).mul(5), bend.sub(.5).mul(2.5)).add(local.gust.mul(2)).add(.5));
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        const sorted = exchange(ctx, lane, step(.5, fract(tick.div(7).add(.5))));
        const current = mix(sorted, lane(at(velocity.negate())).x, .55);
        const shuffled = lane(read(bounded(from.add(.5).mul(texel)))).x;
        return settle(mix(current, shuffled, gate), here, source, .2);
      },
      seed: vec2(source.clamp(0, 1), 0),
    };
  },
  display: ctx => afterimage(ctx, tonal(ctx)),
});

/** Hilbert curve on an N × N tile: index from coordinates and back, unrolled. */
function hilbertTools(N: number) {
  const rot = (x: Scalar, y: Scalar, n: number, rx: Scalar, ry: Scalar): [Scalar, Scalar] => {
    const flip = float(1).sub(ry).mul(rx);
    const nx = mix(x, float(n - 1).sub(x), flip), ny = mix(y, float(n - 1).sub(y), flip);
    const swap = float(1).sub(ry);
    return [mix(nx, ny, swap), mix(ny, nx, swap)];
  };
  const xy2d = (x0: Scalar, y0: Scalar) => {
    let x = x0, y = y0, d: Scalar = float(0);
    for (let s = N / 2; s >= 1; s /= 2) {
      const rx = step(s, x.mod(2 * s)), ry = step(s, y.mod(2 * s));
      d = d.add(float(s * s).mul(rx.mul(3).add(ry).sub(rx.mul(ry).mul(2))));
      [x, y] = rot(x, y, N, rx, ry);
    }
    return d;
  };
  const d2xy = (d0: Scalar) => {
    let t = d0, x: Scalar = float(0), y: Scalar = float(0);
    for (let s = 1; s < N; s *= 2) {
      const rx = floor(t.div(2)).mod(2), ry = t.add(rx).mod(2);
      [x, y] = rot(x, y, s, rx, ry);
      x = x.add(rx.mul(s)); y = y.add(ry.mul(s)); t = floor(t.div(4));
    }
    return vec2(x, y);
  };
  return { xy2d, d2xy };
}

/** 93 Hilbert. 64-cell tiles each hold an order-6 Hilbert curve in one of four
 * orientations (re-hashed on a slow slot). Pixels are addressed by their curve
 * index: transport pulls from 1–3 steps back along the curve, and compare/exchange
 * partners are curve neighbours, so the sort follows the hairpins. Curve segments
 * of a slider-chosen length choose their own direction on an 81-frame slot. The
 * curve wraps within its tile. Injection .2 gives the usual contraction. */
const hilbert = (): KitGraph => ({
  maxEdge: 256, environment: '1-D transport and compare/exchange along tiled Hilbert curves',
  step: ctx => {
    const { u, pixel, texel, control, control2, read, at, bounded, tick, warp } = ctx;
    const N = 64;
    const { xy2d, d2xy } = hilbertTools(N);
    const tile = floor(pixel.div(N)), lp = pixel.sub(tile.mul(N));
    const orient = floor(cellHash(tile.add(vec2(control2.x, 0)), 3).mul(3.99));
    const turn = (p: Point, k: Scalar) => {
      const a = vec2(float(N - 1).sub(p.y), p.x), b = vec2(float(N - 1).sub(p.x), float(N - 1).sub(p.y)), c = vec2(p.y, float(N - 1).sub(p.x));
      return p.mul(equal(k, 0)).add(a.mul(equal(k, 1))).add(b.mul(equal(k, 2))).add(c.mul(equal(k, 3)));
    };
    const unturn = (p: Point, k: Scalar) => turn(p, float(4).sub(k).mod(4));
    const d = xy2d(turn(lp, orient).x, turn(lp, orient).y);
    const length = floor(mix(24, 400, u.detail).mul(control.x.mul(.6).add(.7)));
    const segment = floor(d.div(length));
    const forward = step(.5, cellHash(vec2(segment, tile.x.add(tile.y.mul(7)).add(control.w)), 13)).mul(2).sub(1);
    const stride = floor(control.y.mul(2.99)).add(1).mul(forward);
    const place = (index: Scalar) => tile.mul(N).add(unturn(d2xy(index.add(N * N).mod(N * N)), orient)).add(.5).mul(texel);
    const parity = d.add(tick).mod(2), direction = float(1).sub(parity.mul(2));
    const order = abs(parity.sub(step(.5, warp.w)));
    const source = islands(ctx).add(incisions(ctx, mix(6, 18, u.detail)).mul(step(.5, control.z)));
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        const partner = lane(read(bounded(place(d.add(direction))))).x;
        const eligible = step(.06, min(here.x, partner));
        const sorted = mix(here.x, mix(min(here.x, partner), max(here.x, partner), order), eligible.mul(.8));
        const moved = lane(read(bounded(place(d.sub(stride))))).x;
        return settle(mix(sorted, moved, .6), here, source, .2);
      },
      seed: vec2(source.clamp(0, 1), 0),
    };
  },
  display: ctx => afterimage(ctx, tonal(ctx)),
});

/** 94 Residual. Error diffusion as the dynamics. R is the quantized level (one per
 * palette role), G the signed residual in level units. Each frame a pixel's value
 * is the carried quantized picture mixed with the fresh source plus the residuals
 * received from three upstream neighbours (a cone that turns with the score and
 * swirls with the field), then it is re-quantized and passes its own residual
 * downstream with a leak. The residual is bounded and leaks, and the carried
 * picture is mixed at ≤ 65%, so lanes agree before the handoff. */
const residual = (count: number): KitGraph => {
  const L = Math.max(2, Math.min(5, count));
  return {
    maxEdge: 320, environment: `error diffusion in ${L} levels: carried quantized picture, residuals diffused downstream`,
    step: ctx => {
      const { u, control, control2, field, other, fold, bend, local, at } = ctx;
      const angle = control.x.add(control.y).add(field.sub(.5).mul(control2.x.mul(5)));
      const cone = [ring(angle), ring(angle.add(.785)), ring(angle.sub(.785))];
      const leak = mix(.7, .95, u.detail);
      const persist = mix(.3, .65, u.intensity.div(2).clamp(0, 1));
      // Currents flip their vertical sense between regions, so the carried picture shears and tears at region borders.
      const flip = step(.5, other).mul(2).sub(1);
      const velocity = floor(vec2(fold.sub(.5).mul(6), bend.sub(.5).mul(6).mul(flip)).add(local.gust.mul(2)).add(.5));
      const source = islands(ctx, 2.2).add(incisions(ctx, mix(5, 13, u.detail)).mul(.55)).add(control2.y.sub(.5).mul(.3)).clamp(-.2, 1.2);
      const burst = local.peak.mul(local.level.sub(.5)).mul(.7);
      return {
        evolve: lane => {
          const carried = mix(lane(at(velocity.negate())).x, exchange(ctx, lane, step(.5, control2.z)), .35);
          const received = lane(at(cone[0].negate())).y.sub(.5).mul(.5).add(lane(at(cone[1].negate())).y.sub(.5).mul(.25)).add(lane(at(cone[2].negate())).y.sub(.5).mul(.25)).mul(leak);
          const value = mix(source, carried, persist).add(received.div(L - 1)).add(burst);
          const scaled = value.mul(L - 1);
          const q = scaled.add(.5).floor().clamp(0, L - 1);
          const error = scaled.sub(q).clamp(-.5, .5);
          return vec2(q.div(L - 1), error.add(.5));
        },
        seed: vec2(source.clamp(0, 1).mul(L - 1).add(.5).floor().div(L - 1), .5),
      };
    },
    display: ({ state, role, count }) => choose(state.r.mul(L - 1).add(.5).floor(), ramp(role, count)),
  };
};

/** 95 Cat map. Two wandering square lenses, measured in whole blocks, permute
 * their blocks through Arnold's cat map (x, y) → (2x + y, x + y) mod M or its
 * inverse, an exact permutation with no resampling. Inside each lens's core the
 * same map runs at pixel level, shredding history into diagonal streaks. Outside,
 * shear currents and compare/exchange carry the islands. Injection .16 forgets
 * the start: (.84 × 1.035)¹²⁸ ≈ 2e-8. Grid only. */
const catmap = (): KitGraph => ({
  maxEdge: 320, environment: 'Arnold cat map on block coordinates inside square lenses; shear currents outside',
  step: ctx => {
    const { u, st, pixel, texel, dimensions, control, control2, other, fold, bend, local, read, at, bounded } = ctx;
    const B = floor(mix(12, 4, u.detail).add(.5));
    const lens = (c: typeof control) => {
      const M = floor(c.z);
      const origin = floor(vec2(c.x, c.y).mul(dimensions).div(B)).sub(floor(M.div(2)));
      const b = floor(pixel.div(B)).sub(origin);
      const inside = step(0, b.x).mul(step(0, b.y)).mul(step(b.x, M.sub(.5))).mul(step(b.y, M.sub(.5)));
      const within = pixel.sub(floor(pixel.div(B)).mul(B));
      const cat = (p: Point, size: Scalar) => mix(vec2(p.x.sub(p.y), p.y.mul(2).sub(p.x)), vec2(p.x.mul(2).add(p.y), p.x.add(p.y)), c.w).mod(size);
      const blockFrom = origin.add(cat(b, M)).mul(B).add(within);
      // The core: the central half of the lens, in pixels, mapped pixel by pixel.
      const size = M.mul(B), coreOrigin = origin.mul(B).add(floor(size.div(4)));
      const q = pixel.sub(coreOrigin), half = floor(size.div(2));
      const core = step(0, q.x).mul(step(0, q.y)).mul(step(q.x, half.sub(.5))).mul(step(q.y, half.sub(.5)));
      const pixelFrom = coreOrigin.add(cat(q, half));
      return { inside, from: mix(blockFrom, pixelFrom, core) };
    };
    const a = lens(control), b = lens(control2);
    const block = floor(st.mul(vec2(u.aspect, 1)).mul(u.scale.mul(2.2)).add(bend.mul(1.2)).add(4096));
    const source = mix(islands(ctx), cellHash(block, 23).mul(1.4).sub(.2), step(.6, other));
    const velocity = floor(vec2(fold.sub(.5).mul(6), 0).add(local.gust.mul(2)).add(.5));
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        const sorted = exchange(ctx, lane, float(1));
        const current = mix(sorted, lane(at(velocity.negate())).x, .5);
        const mapped = mix(lane(read(bounded(b.from.add(.5).mul(texel)))).x, lane(read(bounded(a.from.add(.5).mul(texel)))).x, a.inside);
        return settle(mix(current, mapped, max(a.inside, b.inside)), here, source, .16);
      },
      seed: vec2(source.clamp(0, 1), 0),
    };
  },
  display: ctx => {
    const base = tonal(ctx);
    const level = ctx.state.r;
    // Block-edge exposure: a marked block column drops one step at its left edge.
    const marked = rowMark(ctx, .8, 3, 41).mul(step(.2, level));
    return afterimage(ctx, mix(base, tonal({ ...ctx, state: vec4(level.sub(.18), ctx.state.g, 0, 0) }), marked));
  },
});

/** 96 Compass. Every pixel pulls from the neighbour that its own tone points to:
 * angle = tone × turns × 2π plus a global spin and a field swirl, rounded to one of
 * eight offsets. Tonal bands therefore flow in their own directions, and the sort
 * axis flips on a slot. Injection .2 forgets the start as usual. */
const compass = (): KitGraph => ({
  maxEdge: 320, environment: 'value-steered transport: each pixel pulls from the neighbour its own tone points to',
  step: ctx => {
    const { u, control, control2, field, local, at } = ctx;
    const turns = mix(1, 3, u.detail);
    const source = islands(ctx).add(incisions(ctx, mix(5, 14, u.detail)).mul(.6));
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        const angle = here.x.mul(turns).mul(TAU).add(control.x).add(field.sub(.5).mul(control2.x.mul(4))).add(local.peak.mul(2.5));
        const pulled = lane(at(ring(angle).add(floor(local.gust.mul(1.5).add(.5))))).x;
        const sorted = exchange(ctx, lane, control.w);
        return settle(mix(sorted, pulled, .6), here, source, .2);
      },
      seed: vec2(source.clamp(0, 1), 0),
    };
  },
  display: ctx => afterimage(ctx, tonal(ctx)),
});

/** 97 Collage. Two or three contractive affine maps (scale .42–.7, turning,
 * one flipped, one mirrored) paste shrunk copies of the whole picture back into
 * it every frame; the union of copies is taken where any lands, so torn islands
 * regress into self-similar cascades around the wandering fixed points. Copies
 * shrink, so this is not the zoom-out spiral of Larsen. Injection .18 forgets. */
const collage = (): KitGraph => ({
  maxEdge: 320, environment: 'iterated affine copies (shrunk, turned, flipped) unioned over torn islands',
  step: ctx => {
    const { u, st, control, control2, fold, bend, local, read, at, bounded } = ctx;
    const maps = [
      { c: control.xy, a: control.z, s: control.w, flip: float(0), gate: float(1) },
      { c: control2.xy, a: control2.z, s: control2.w, flip: float(1), gate: float(1) },
      { c: vec2(float(1).sub(control.x), control2.y), a: control.z.negate(), s: control.w.mul(.85), flip: float(0), gate: step(.5, u.detail) },
    ];
    const preimage = (m: typeof maps[number]) => {
      const q = st.sub(m.c).mul(vec2(u.aspect, 1));
      const r = rotate(q, m.a.negate()).div(m.s);
      return m.c.add(vec2(mix(r.x, r.x.negate(), m.flip), r.y).div(vec2(u.aspect, 1)));
    };
    const source = islands(ctx).add(incisions(ctx, mix(4, 12, u.detail)).mul(.5));
    const velocity = floor(vec2(fold.sub(.5).mul(3), bend.sub(.5).mul(3)).add(local.gust.mul(2)).add(.5));
    // A copy's edge is torn, not a rectangle: the frame border is eaten by a noisy margin.
    const margin = noise(st.mul(vec2(u.aspect, 1)).mul(9).add(fold.mul(3))).mul(.16);
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        let best: Scalar = float(-1);
        for (const m of maps) {
          const p = preimage(m);
          const border = min(min(p.x, float(1).sub(p.x)), min(p.y, float(1).sub(p.y)));
          const inside = step(margin, border).mul(m.gate);
          best = max(best, mix(float(-1), lane(read(bounded(p))).x, inside));
        }
        const base = lane(at(velocity.negate())).x;
        const history = mix(base, best, step(0, best).mul(.85));
        return settle(history, here, source, .18);
      },
      seed: vec2(source.clamp(0, 1), 0),
    };
  },
  display: ctx => afterimage(ctx, tonal(ctx)),
});

/** 98 Stutter. Every pixel has its own update period (1–12 frames, longer inside
 * slow regions) and phase from a stationary hash. Between updates it holds; when
 * it wakes it pulls the history from as far back as its whole hold displaced,
 * sorts, and takes 45% fresh source. Rows blink on their own periods. The frame
 * counter wraps on the lcm of the periods, so no clock skips. At least ten
 * updates fall in any 128 frames: (.55 × 1.035)¹⁰ ≈ .003. */
const stutter = (): KitGraph => ({
  maxEdge: 320, environment: 'asynchronous per-pixel update clocks; held pixels jump by their accumulated displacement',
  step: ctx => {
    const { u, pixel, domain, control, control2, fold, bend, local, at, s } = ctx;
    const longest = floor(mix(3, 12, u.detail).add(.5));
    const region = smoothstep(.35, .75, noise(domain.mul(.9).add(control2.xy.mul(3)).add(s)));
    const period = floor(cellHash(pixel, 31).mul(mix(2, longest, region).sub(.001))).add(1);
    const phase = floor(cellHash(pixel, 47).mul(period));
    const fires = equal(control.x.add(phase).mod(period), 0);
    const velocity = vec2(fold.sub(.5).mul(6).add(control.z), bend.sub(.5).mul(6).add(control.w)).add(local.gust.mul(2));
    const jump = floor(velocity.mul(period).mul(.5).add(.5));
    const source = islands(ctx).add(incisions(ctx, mix(6, 16, u.detail)).mul(.5));
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        const sorted = exchange(ctx, lane, step(.5, control.y));
        const moved = lane(at(jump.negate())).x;
        const updated = settle(mix(sorted, moved, .6), here, source, .45);
        return mix(here, updated, fires);
      },
      seed: vec2(source.clamp(0, 1), 0),
    };
  },
  display: ctx => {
    const { cell, control, u } = ctx;
    const base = tonal(ctx);
    // Row clocks: a row blinks on the frames its own period fires; marks drop a step.
    const row = floor(cell.y.div(2));
    const rowPeriod = floor(cellHash(vec2(row, 0), 53).mul(7)).add(2);
    const blink = equal(control.x.add(floor(cellHash(vec2(row, 1), 59).mul(rowPeriod))).mod(rowPeriod), 0).mul(step(.15, ctx.state.r)).mul(step(.25, u.intensity));
    return afterimage(ctx, mix(base, tonal({ ...ctx, state: vec4(ctx.state.r.sub(.16), ctx.state.g, 0, 0) }), blink));
  },
});

/** Block level for the quadtree from the change envelope at the block anchors: a
 * calm 16-cell block stays whole; activity subdivides it toward single cells. */
function quadLevel(pixel: Point, echoAt: (anchor: Point) => Scalar, sensitivity: Scalar) {
  let level: Scalar = float(4);
  for (const L of [4, 3, 2, 1]) {
    const size = 1 << L;
    const anchor = floor(pixel.div(size)).mul(size).add(size / 2);
    const active = step(sensitivity.mul(L * .25 + .25), echoAt(anchor));
    level = mix(level, float(L - 1), active.mul(equal(level, L)));
  }
  return level;
}
/** 99 Quadtree. Every pixel copies the transported history at the centre of its
 * block, and the block's size (1–16 cells) follows the change envelope: calm
 * areas become flat blocks, moving edges subdivide. Blocking a region is itself a
 * change, so the mosaic breathes. Injection .2 forgets the start. Grid only. */
const quadtree = (): KitGraph => ({
  maxEdge: 256, dither: 'cell', environment: 'activity-driven quadtree mosaic over transported islands',
  step: ctx => {
    const { u, pixel, texel, control, fold, bend, local, read, at, bounded } = ctx;
    const velocity = floor(vec2(fold.sub(.5).mul(7).add(control.y.mul(1.5)), bend.sub(.5).mul(7).add(control.z.mul(1.5))).add(local.gust.mul(2.5)).add(.5));
    const sensitivity = mix(.14, .03, u.detail).mul(control.x.mul(.5).add(.75));
    const source = islands(ctx).add(incisions(ctx, mix(5, 12, u.detail)).mul(.55));
    return {
      evolve: lane => {
        const here = lane(at(vec2(0)));
        const level = quadLevel(pixel, anchor => lane(read(bounded(anchor.mul(texel)))).y, sensitivity);
        const size = exp2(level);
        const centre = floor(pixel.div(size)).mul(size).add(floor(size.div(2)));
        const moved = lane(read(bounded(centre.sub(velocity).add(.5).mul(texel)))).x;
        const sorted = exchange(ctx, lane, float(0));
        return settle(mix(moved, sorted, equal(level, 0).mul(.5)), here, source, .2);
      },
      seed: vec2(source.clamp(0, 1), 0),
    };
  },
  display: ctx => {
    const { cell, sample, u, control } = ctx;
    const base = tonal(ctx);
    const sensitivity = mix(.14, .03, u.detail).mul(control.x.mul(.5).add(.75));
    const level = quadLevel(cell, anchor => sample(anchor.sub(cell)).y, sensitivity);
    const size = exp2(level);
    // Seams only where the tree is subdivided: a one-cell edge at blocks of 2–8
    // cells, with stationary dithered coverage that grows with intensity. Block
    // copies keep per-pixel change small, so the afterimage floor sits low.
    const seam = max(equal(cell.x.mod(size), 0), equal(cell.y.mod(size), 0)).mul(step(.5, level)).mul(step(level, 3.5)).mul(step(fract(ctx.threshold.add(.61)), u.intensity.mul(.55)));
    return afterimage(ctx, mix(base, tonal({ ...ctx, state: vec4(ctx.state.r.sub(.2), ctx.state.g, 0, 0) }), seam), .008, .1);
  },
});

/** 100 Misregister. Four ink layers, one per non-ground palette role. Each layer
 * has its own source mask and integer current. R holds the winning layer's role
 * index and G its age in 64ths of a frame budget: a fresh mask pixel is age 0, a
 * carried pixel ages by one, and a pixel dies once its age passes a limit set by
 * the intensity (dithered by a stationary threshold, so wakes have torn tails).
 * Nothing older than 64 frames survives, and no per-pixel coin is used, so the
 * layers are solid and the handoff is exact. Layers occlude by a priority that
 * is re-hashed on the slow clock, so the print keeps re-registering. */
const misregister = (): KitGraph => ({
  maxEdge: 320, environment: 'four ink layers with their own currents, aged wakes and shifting priority; role index transported without blending',
  step: ctx => {
    const { u, pixel, control, control2, field, other, domain, drift, local, at, slow } = ctx;
    const currents = [vec2(control.x, control.y), vec2(control.z, control.w), vec2(control2.x, control2.y), vec2(control2.z, control2.w)]
      .map(v => floor(v.mul(2.4).add(local.gust.mul(1.5)).add(.5)));
    const density = mix(5, 14, u.detail);
    // Each layer mixes a shared coarse field with its own finer noise, so a
    // frame never shows only a few noise cells and coverage stays near half.
    const fine = (offset: [number, number], frequency: number) => noise(domain.mul(frequency).add(vec2(...offset)).add(drift.yx.mul(.3)));
    const third = noise(domain.mul(1.9).add(vec2(5.3, 2.1)).sub(drift.xy.mul(.5)));
    const fourth = noise(domain.mul(1.3).sub(vec2(3.7, 8.9)).add(drift.zw.mul(.4)));
    const masks = [
      step(.5, mix(field, fine([1.7, 3.9], 3.1), .5).add(local.peak.mul(.3))),
      max(step(.52, mix(other, fine([8.1, 2.3], 2.7), .5)), step(.92, tri(field.mul(density)))),
      step(.52, mix(third, fine([5.5, 7.7], 3.7), .5)),
      max(step(.54, mix(fourth, fine([2.2, 9.1], 2.3), .5)), step(.94, tri(other.mul(density.mul(.7))))),
    ];
    // Wake length in frames (of 64), torn by a stationary threshold; events cut wakes short.
    const limit = mix(.12, .75, u.intensity.div(2).clamp(0, 1)).add(cellHash(pixel, 61).sub(.5).mul(.3)).sub(local.peak.mul(.3));
    return {
      evolve: lane => {
        let best: Scalar = float(0), bestRank: Scalar = float(0), bestAge: Scalar = float(0);
        masks.forEach((mask, k) => {
          const moved = lane(at(currents[k].negate()));
          const age = moved.y.add(1 / 64);
          const carried = equal(moved.x.mul(4).add(.5).floor(), k + 1).mul(step(age, limit));
          const present = max(carried, mask);
          const rank = cellHash(vec2(slow.x, k + 1), 77).mul(.9).add(.1).mul(present);
          const take = step(bestRank.add(.0001), rank);
          best = mix(best, float(k + 1), take); bestAge = mix(bestAge, mix(age, float(0), mask), take); bestRank = max(bestRank, rank);
        });
        return vec2(best.div(4), bestAge.clamp(0, 1));
      },
      seed: vec2(0, 0),
    };
  },
  display: ({ state, role }) => choose(state.r.mul(4).add(.5).floor(), [role(0), role(1), role(2), role(3), role(4)]),
});

/** Logic studies 91–100: chaotic, abstract pixel machines built from bit
 * operations, permutations, chaotic maps, error diffusion, space-filling curves,
 * iterated function systems, asynchronous clocks, quadtrees and ink layers.
 * They share the kit lifecycle and its 2–5-colour role display. Original TSL. */
export function createLogic(u: KitInputs, family: LogicFamily) {
  const count = u.colors.length;
  const graph = family === 'munch' ? munch() : family === 'butterfly' ? butterfly() : family === 'hilbert' ? hilbert() : family === 'residual' ? residual(count)
    : family === 'catmap' ? catmap() : family === 'compass' ? compass() : family === 'collage' ? collage() : family === 'stutter' ? stutter()
    : family === 'quadtree' ? quadtree() : misregister();
  return createKitStudy(u, family, graph, logicControls(family), logicSalt);
}
