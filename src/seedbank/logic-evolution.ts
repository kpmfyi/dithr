/** Per-frame controls for the logic studies. Pure functions of seed and absolute frame. */
import type { Controls, Quad } from './kit-evolution.ts';
import type { LogicFamily } from './logic-meta.ts';

export const logicSalt = 0x10c1;
/** Least common multiple of the asynchronous update periods 1–12: Stutter's frame counter wraps here, so every clock stays in phase. */
export const STUTTER_WRAP = 27720;
const TAU = Math.PI * 2;
const wrap = (value: number, period: number) => ((value % period) + period) % period;

export function logicControls(family: LogicFamily): Controls {
  switch (family) {
    case 'munch':
      // Texture offsets advance monotonically and wrap on the 256-cell bit period
      // (seamless, since the shader masks coordinates to 8 bits); the frame modulo
      // each plane's refresh period (41, 59, 73, 97); two direction tracks.
      return (frame, { track }) => [[wrap(frame * .21, 256), wrap(frame * .13, 256), wrap(frame, 41), wrap(frame, 59)],
        [wrap(frame, 73), wrap(frame, 97), track(frame, 191, 5), track(frame, 277, 6)]];
    case 'butterfly':
      // Two permutation ops on unrelated slots: kind (0–4), the two bit choices
      // (uniform in [0, 1), quantized in the shader by the detail slider), and a
      // gate seed that decides which tiles the op touches.
      return (frame, { random }) => {
        const op = (period: number, channel: number): Quad => {
          const slot = Math.floor(frame / period);
          return [Math.floor(random(slot, channel) * 5), random(slot, channel + 1), random(slot, channel + 2), Math.floor(random(slot, channel + 3) * 4096)];
        };
        return [op(41, 10), op(67, 20)];
      };
    case 'hilbert':
      // Segment length and stride tracks, a sort gate, the segment-direction slot
      // (81 frames) and the tile-orientation slot (601 frames).
      return (frame, { track }) => [[track(frame, 347, 1), track(frame, 211, 2), track(frame, 173, 3), Math.floor(frame / 81) % 65536],
        [Math.floor(frame / 601) % 65536, track(frame, 419, 4), track(frame, 263, 5), 0]];
    case 'residual':
      // The cone direction turns at a constant rate (wrapped at 2π) plus a bounded
      // wobble; a region swirl track; a leak track; a current track.
      return (frame, { track }) => [[wrap(frame * .009, TAU), (track(frame, 383, 1) - .5) * 1.6, track(frame, 521, 2), track(frame, 299, 3)],
        [track(frame, 457, 4), track(frame, 631, 5), track(frame, 197, 6), 0]];
    case 'catmap':
      // Two square lenses: centre tracks, size in blocks (6–22) and the map
      // direction, which flips on its own slot.
      return (frame, { track, random }) => {
        const lens = (channel: number, period: number): Quad => [.15 + track(frame, 587 + channel, channel) * .7, .15 + track(frame, 673 + channel, channel + 1) * .7,
          6 + track(frame, 809 + channel, channel + 2) * 16, random(Math.floor(frame / period), channel + 3) > .5 ? 1 : 0];
        return [lens(30, 137), lens(40, 191)];
      };
    case 'compass':
      // A wrapped spin, a swirl track, a bias track and the sort-axis slot.
      return (frame, { track, random }) => [[wrap(frame * .011, TAU), track(frame, 409, 1), track(frame, 271, 2), random(Math.floor(frame / 113), 3) > .5 ? 1 : 0],
        [track(frame, 331, 4), track(frame, 503, 5), 0, 0]];
    case 'collage':
      // Two affine maps: fixed points on bounded tracks, wrapped angles at
      // unequal rates, contraction factors between .42 and .7.
      return (frame, { track }) => [[.2 + track(frame, 709, 1) * .6, .2 + track(frame, 823, 2) * .6, wrap(frame * .006 + track(frame, 367, 3) * 2, TAU), .42 + track(frame, 541, 4) * .28],
        [.2 + track(frame, 761, 5) * .6, .2 + track(frame, 877, 6) * .6, wrap(frame * -.0045 + track(frame, 431, 7) * 2, TAU), .42 + track(frame, 599, 8) * .28]];
    case 'stutter':
      // The frame counter wraps on the lcm of all periods; a hold-length track;
      // region field offsets.
      return (frame, { track }) => [[wrap(frame, STUTTER_WRAP), track(frame, 487, 1), (track(frame, 641, 2) - .5) * 6, (track(frame, 733, 3) - .5) * 6],
        [track(frame, 281, 4), track(frame, 359, 5), 0, 0]];
    case 'quadtree':
      // Sensitivity wobble and a wandering current bias.
      return (frame, { track }) => [[track(frame, 397, 1), (track(frame, 563, 2) - .5) * 2, (track(frame, 617, 3) - .5) * 2, track(frame, 227, 4)], [0, 0, 0, 0]];
    case 'misregister':
      // Four layer currents in [-1, 1] per axis; the shader rounds them to integer cells.
      return (frame, { track }) => [[track(frame, 311, 1) * 2 - 1, track(frame, 373, 2) * 2 - 1, track(frame, 401, 3) * 2 - 1, track(frame, 443, 4) * 2 - 1],
        [track(frame, 467, 5) * 2 - 1, track(frame, 509, 6) * 2 - 1, track(frame, 547, 7) * 2 - 1, track(frame, 601, 8) * 2 - 1]];
    default:
      return (frame, { track }) => [[track(frame, 127, 40), track(frame, 181, 41), track(frame, 233, 42), track(frame, 79, 43)], [0, 0, 0, 0]];
  }
}
