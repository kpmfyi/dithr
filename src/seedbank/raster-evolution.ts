/** Per-frame controls for the raster studies. Pure functions of seed and absolute frame.
 * Positions come from bounded eased tracks or from a constant rate taken modulo
 * a period (closed form at any frame), never from an accumulated velocity. */
import { ease, type ControlTools, type Controls } from './kit-evolution.ts';
import type { RasterFamily } from './raster-meta.ts';

export const rasterSalt = 0x7a57;
const TAU = Math.PI * 2;
/** Fractional turns of a constant rate. Exact enough in double precision at 6e13 frames. */
const turn = (frame: number, rate: number) => ((frame * rate) % 1 + 1) % 1;
const mod = (value: number, period: number) => ((value % period) + period) % period;

// Vectorscope ------------------------------------------------------------------
/** Beam samples per frame: the first continues the previous frame's last sample. */
export const BEAM_POINTS = 33;
const RATIOS: [number, number][] = [[1, 2], [2, 3], [3, 4], [3, 5], [4, 5], [1, 3], [2, 5], [5, 6], [3, 2], [5, 4], [4, 3], [5, 3]];
const FIGURE_SLOT = 660, FIGURE_FADE = 110;
function figure(tools: ControlTools, slot: number, t: number, detail: number, scale: number): [number, number] {
  const r = (c: number) => tools.random(slot, 400 + c);
  const [p, q] = RATIOS[Math.floor(r(0) * RATIOS.length)];
  const [p2, q2] = RATIOS[Math.floor(r(2) * RATIOS.length)];
  const base = (1.25 + scale * .32) / 60;
  const detune = (r(1) - .5) * .0036;
  const k = detail * (.12 + r(3) * .26), m = 2 + Math.floor(r(4) * 2);
  const x = (1 - k) * Math.sin(TAU * p * base * t + TAU * r(5)) + k * Math.sin(TAU * p2 * m * base * 1.003 * t + TAU * r(6));
  const y = (1 - k) * Math.sin(TAU * (q * base + detune) * t + TAU * r(7)) + k * Math.sin(TAU * q2 * m * base * t + TAU * r(8));
  const amplitude = .4 * (.86 + .14 * Math.sin(TAU * t / 430 + TAU * r(9)));
  const angle = (r(10) - .5) * 1.2 + t * (r(11) - .5) * .0008;
  const c = Math.cos(angle), s = Math.sin(angle);
  return [(x * c - y * s) * amplitude, (x * s + y * c) * amplitude];
}
function beamAt(tools: ControlTools, tau: number, detail: number, scale: number): [number, number] {
  const slot = Math.floor(tau / FIGURE_SLOT), local = tau - slot * FIGURE_SLOT;
  const now = figure(tools, slot, local, detail, scale);
  if (local >= FIGURE_FADE) return now;
  // A new figure takes over from the previous one: the beam morphs, it never jumps.
  const before = figure(tools, slot - 1, local + FIGURE_SLOT, detail, scale), f = ease(local / FIGURE_FADE);
  return [before[0] + (now[0] - before[0]) * f, before[1] + (now[1] - before[1]) * f];
}
/** Beam positions (height units, centered) from the end of frame − 1 to frame. */
export function beamPath(tools: ControlTools, frame: number, detail: number, scale: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < BEAM_POINTS; j++) out.push(...beamAt(tools, frame - 1 + j / (BEAM_POINTS - 1), detail, scale));
  return out;
}

// Orbit ------------------------------------------------------------------------
export const ORBIT_STAMPS = 64;
const SHAPE_SLOT = 540, SHAPE_FADE = 150;
type Vec3 = [number, number, number];
function shapePoint(shape: number, i: number, total: number): Vec3 {
  const u = (i + .5) / total;
  switch (shape) {
    case 0: { const y = 1 - 2 * u, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.399963; return [r * Math.cos(a), y, r * Math.sin(a)]; }
    case 1: { const a = TAU * u, r = .62 + .3 * Math.cos(3 * a); return [r * Math.cos(2 * a), r * Math.sin(2 * a), .34 * Math.sin(3 * a)]; }
    case 2: { const ring = i % 3, a = TAU * Math.floor(i / 3) / Math.ceil(total / 3), c = .92 * Math.cos(a), s = .92 * Math.sin(a);
      return ring === 0 ? [c, s, 0] : ring === 1 ? [c, 0, s] : [0, c, s]; }
    case 3: { const a = u * TAU * 3 + (i % 2) * Math.PI; return [.55 * Math.cos(a), 1.7 * u - .85, .55 * Math.sin(a)]; }
    case 4: {
      const edges: [Vec3, Vec3][] = [[[-1, -1, -1], [1, -1, -1]], [[-1, 1, -1], [1, 1, -1]], [[-1, -1, 1], [1, -1, 1]], [[-1, 1, 1], [1, 1, 1]],
        [[-1, -1, -1], [-1, 1, -1]], [[1, -1, -1], [1, 1, -1]], [[-1, -1, 1], [-1, 1, 1]], [[1, -1, 1], [1, 1, 1]],
        [[-1, -1, -1], [-1, -1, 1]], [[1, -1, -1], [1, -1, 1]], [[-1, 1, -1], [-1, 1, 1]], [[1, 1, -1], [1, 1, 1]]];
      const [a, b] = edges[i % 12], t = (Math.floor(i / 12) + .5) / Math.ceil(total / 12);
      return [0, 1, 2].map(k => (a[k] + (b[k] - a[k]) * t) * .62) as Vec3;
    }
    default: { const a = TAU * u; return [.9 * Math.sin(3 * a), .9 * Math.sin(2 * a + .6), .9 * Math.sin(5 * a + 1.1)]; }
  }
}
const shapeOf = (tools: ControlTools, slot: number) => {
  const a = Math.floor(tools.random(slot, 500) * 6), previous = Math.floor(tools.random(slot - 1, 500) * 6);
  return a === previous ? (a + 1) % 6 : a;
};
/** 64 stamps per frame: x, y (height units, centered), tone (depth) and size (0–2 px). */
export function orbitCloud(tools: ControlTools, frame: number, detail: number, scale: number): number[] {
  const subsets = 2 + Math.round(Math.max(0, Math.min(1, detail)) * 2), total = ORBIT_STAMPS * subsets;
  const subset = mod(frame, subsets);
  const slot = Math.floor(frame / SHAPE_SLOT), local = frame - slot * SHAPE_SLOT;
  const next = shapeOf(tools, slot), previous = shapeOf(tools, slot - 1), f = ease(local / SHAPE_FADE);
  const spin = Math.sign(tools.random(0, 510) - .5) || 1;
  const yaw = TAU * turn(frame, spin / (330 + tools.random(0, 511) * 220)) + 2.2 * tools.track(frame, 301, 512);
  const pitch = (tools.track(frame, 377, 513) - .5) * 1.7, roll = (tools.track(frame, 431, 514) - .5) * .9;
  const zoom = .35 / (.62 + scale * .14);
  const cx = (tools.track(frame, 509, 515) - .5) * .22, cy = (tools.track(frame, 587, 516) - .5) * .14;
  const [cyw, syw, cp, sp, cr, sr] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch), Math.cos(roll), Math.sin(roll)];
  const out: number[] = [];
  for (let j = 0; j < ORBIT_STAMPS; j++) {
    const i = subset + subsets * j;
    const a = shapePoint(previous, i, total), b = shapePoint(next, i, total);
    let [x, y, z] = [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * f);
    [x, z] = [x * cyw + z * syw, -x * syw + z * cyw];
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    [x, y] = [x * cr - y * sr, x * sr + y * cr];
    const depth = 3.1 / (z + 3.1);
    out.push(cx + x * zoom * depth, cy + y * zoom * depth, Math.max(0, Math.min(1, .62 - z * .38)), z < -.45 ? 2 : z < .35 ? 1 : 0);
  }
  return out;
}

// Copper -----------------------------------------------------------------------
export const COPPER_BARS = 8;
/** Bars: y center [0, 1], half height (height units), palette offset 0–4, active flag. */
export function copperBars(tools: ControlTools, frame: number, detail: number): number[] {
  const count = 2 + Math.round(Math.max(0, Math.min(1, detail)) * 5), out: number[] = [];
  for (let i = 0; i < COPPER_BARS; i++) {
    // Each bar swings between freshly hashed targets on its own clock, with pauses at the ends.
    const period = 46 + tools.random(i, 600) * 90;
    const y = .06 + .88 * tools.track(frame + tools.random(i, 601) * 997, period, 610 + i);
    const half = .04 + .05 * tools.track(frame, 260 + 41 * i, 620 + i);
    const tone = Math.floor(tools.random(Math.floor((frame + tools.random(i, 602) * 400) / (380 + 60 * i)), 630 + i) * 5);
    out.push(y, half, tone, i < count ? 1 : 0);
  }
  return out;
}

// Twister ----------------------------------------------------------------------
export const TWISTER_COLUMNS = 6;
/** Columns: center x (width units), radius (height units), angle (rad, bounded), twist (rad per height). */
export function twisterColumns(tools: ControlTools, frame: number, detail: number): number[] {
  const count = 2 + Math.round(Math.max(0, Math.min(1, detail)) * 4), out: number[] = [];
  for (let i = 0; i < TWISTER_COLUMNS; i++) {
    const slot = (i + .5) / count;
    const x = slot + (tools.track(frame, 610 + 97 * i, 650 + i) - .5) * (1.25 / count);
    const radius = (.07 + .06 * tools.random(i, 660)) * (4 / (count + 2));
    const rate = (Math.sign(tools.random(i, 661) - .5) || 1) / (80 + tools.random(i, 662) * 170);
    const angle = TAU * turn(frame, rate) + 3.2 * tools.track(frame, 250 + 31 * i, 670 + i);
    // Always visibly twisted: 4–14 rad over the panel height, direction per column.
    const twist = (Math.sign(tools.random(i, 663) - .5) || 1) * (4 + 10 * tools.track(frame, 380 + 53 * i, 680 + i));
    out.push(x, i < count ? radius : 0, angle, twist);
  }
  return out;
}

export function rasterControls(family: RasterFamily): Controls {
  switch (family) {
    case 'pyre':
      // Wind lean, gust strength, burner drift and flare rate: independent eased tracks.
      // control2.x scrolls the cooling map one row per frame (wrapping far apart, every 20000 frames).
      return (frame, { track }) => [[track(frame, 173, 1), track(frame, 67, 2), frame % 100000, track(frame, 131, 4)], [frame % 20000, 0, 0, 0]];
    case 'tunnel':
      // Wandering vanishing point and bend; depth and roll advance at a base rate
      // plus a bounded eased wander, taken modulo the 64-row texture period.
      return (frame, { track }) => [
        [(track(frame, 197, 1) - .5) * .42, (track(frame, 233, 2) - .5) * .3, (track(frame, 151, 3) - .5) * .9, (track(frame, 173, 4) - .5) * .9],
        [mod(frame * .034 + 3 * track(frame, 311, 5), 64), mod(turn(frame, 1 / 900) + .45 * track(frame, 263, 6), 1), track(frame, 523, 7), frame % 100000]];
    case 'warp': {
      // Depth phase Z advances at a base rate plus a bounded wander: bursts, drifts and brief stalls.
      const depth = (frame: number, track: ControlTools['track']) => frame / 230 + 1.15 * track(frame, 420, 3);
      return (frame, { track }) => {
        const speed = depth(frame, track) - depth(frame - 1, track);
        return [[(track(frame, 289, 1) - .5) * .5, (track(frame, 337, 2) - .5) * .34, mod(depth(frame, track), 1), Math.max(.006, Math.min(.3, speed * 11))],
          [TAU * turn(frame, 1 / 5200) + (track(frame, 719, 4) - .5) * .8, (track(frame, 811, 5) - .5) * 3, (track(frame, 907, 6) - .5) * 3, speed * 230]];
      };
    }
    case 'copper':
      return (frame, { track }) => [
        [2 + 9 * track(frame, 347, 1), .6 + 2.2 * track(frame, 421, 2), mod(turn(frame, 1 / 97) + track(frame, 283, 3), 1), Math.floor(frame * .75) % 60000],
        [.12 + .76 * track(frame, 613, 4), track(frame, 191, 5), 0, 0]];
    case 'vectorscope':
      return (frame, { track }) => [[track(frame, 353, 1), 0, 0, 0], [0, 0, 0, 0]];
    case 'flipdot':
      // Front direction and sweep phase, a marquee that advances one disc every four
      // frames (wrapping far apart), and blob drift.
      return (frame, { track }) => [
        [TAU * track(frame, 733, 1), mod(turn(frame, 1 / 260) + 1.5 * track(frame, 347, 2), 1), Math.floor(frame / 4) % 60000, track(frame, 619, 3)],
        [(track(frame, 409, 4) - .5) * 9, (track(frame, 463, 5) - .5) * 9, track(frame, 997, 6), track(frame, 271, 7)]];
    case 'voxel':
      // Terrain repeats every 256 world units in z; the camera flies forward at a
      // base rate plus a bounded wander, banks and climbs on eased tracks.
      return (frame, { track }) => {
        const z = (f: number) => f * .13 + 22 * track(f, 520, 2);
        const yaw = (f: number) => (track(f, 467, 3) - .5) * 1.1;
        return [[(track(frame, 689, 1) - .5) * 40, mod(z(frame), 256), yaw(frame), (yaw(frame + 30) - yaw(frame - 30)) * 2.4],
          [track(frame, 571, 4), track(frame, 389, 5), track(frame, 1201, 6), 0]];
      };
    case 'mode7':
      return (frame, { track }) => [
        [(track(frame, 613, 1) - .5) * 180, (track(frame, 701, 2) - .5) * 180, TAU * turn(frame, 1 / 1400) + 2.4 * track(frame, 353, 3), track(frame, 431, 4)],
        [track(frame, 587, 5), frame % 100000, track(frame, 829, 6), 0]];
    case 'orbit':
      return (frame, { track }) => [[track(frame, 353, 1), track(frame, 457, 2), 0, 0], [0, 0, 0, 0]];
    case 'twister':
      return (frame, { track }) => [[.004 + .03 * track(frame, 457, 1), .3 + 1.2 * track(frame, 523, 2), mod(turn(frame, 1 / 210) + track(frame, 331, 3), 1), 0], [0, 0, 0, 0]];
    default:
      return (frame, { track }) => [[track(frame, 127, 40), track(frame, 181, 41), track(frame, 233, 42), track(frame, 79, 43)], [0, 0, 0, 0]];
  }
}
