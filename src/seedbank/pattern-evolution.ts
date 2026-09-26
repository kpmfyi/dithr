/** Per-frame controls for the pattern studies. Pure functions of seed and absolute
 * frame. Every value sent to the GPU stays bounded at late frames; phases wrap
 * at multiples of their visual period, so each wrap is seamless. Priming starts
 * before frame 0, so negative frames are valid input. */
import type { Controls } from './kit-evolution.ts';
import type { PatternFamily } from './pattern-meta.ts';

export const patternSalt = 0x61a7;
/** Wrap for the shared frame counter F: divisible by every shader-side period
 * that uses it (150 × 64 belt steps, 1800 retypes, 2400 re-dyes, 8 × 8 × 30 climbs). */
export const frameWrap = 15840000;
/** Bargello band heights: 8 × height divides frameWrap / 8, so the one-row-per-8-frames
 * climb stays seamless when F wraps. */
export const bandHeights = [30, 20, 18, 15, 12, 10, 9, 6];
const pmod = (x: number, m: number) => ((x % m) + m) % m;

export function patternControls(family: PatternFamily): Controls {
  switch (family) {
    case 'tartan':
      // Fixed 900-frame slots; each slot sweeps a shuttle over a random span of
      // the slot and weaves sett k+1 over sett k. Pan offsets are bounded eased
      // walks; the per-frame delta transports history with the target.
      return (frame, { random, track }) => {
        const slot = Math.floor(frame / 900), local = frame - slot * 900;
        const start = random(slot, 1) * 380, span = 260 + random(slot, 2) * 240;
        const shuttle = Math.max(0, Math.min(1.02, (local - start) / span));
        const pan = (f: number, channel: number) => Math.floor(400 * (track(f, 613, channel) - .5));
        const panX = pan(frame, 3), panY = pan(frame, 4);
        return [[Math.floor(random(slot, 5) * 65535), Math.floor(random(slot + 1, 5) * 65535), shuttle, panX],
          [panY, Math.floor(random(Math.floor(frame / 1500), 6) * 65535), panX - pan(frame - 1, 3), panY - pan(frame - 1, 4)]];
      };
    case 'ikat':
      // Bundle walks advance one hashed target every 90 frames (T wraps at 256 targets);
      // amplitudes of the fine and coarse bundle drifts swell independently.
      return (frame, { track }) => [[0, 0, 4 + track(frame, 1100, 1) * 18, track(frame, 1700, 2) * 26],
        [pmod(frame, 23040) / 90, pmod(frame - 1, 23040) / 90, 0, pmod(frame, frameWrap)]];
    case 'truchet':
      // Two fronts (phases wrap at an even number of passes, so parity is seamless),
      // a drifting pan, a slowly turning main direction and dash flow.
      return (frame, { random, track }) => [[Math.round((track(frame, 1300, 1) - .5) * 360), Math.round((track(frame, 1700, 2) - .5) * 240), (track(frame, 2100, 3) - .5) * 5, 4 + track(frame, 900, 4) * 7],
        [pmod(frame, 280 * 512) / 280, pmod(frame, 48) / 48 * 2, Math.floor(random(0, 5) * 65535), pmod(frame, 430 * 512) / 430]];
    case 'bauhaus':
      // Quarter-turn wave (phase in [0, 4) so the wrap is a whole revolution),
      // its direction and wavelength, a belt key and the shared counter.
      return (frame, { random, track }) => [[0, 0, (track(frame, 1500, 1) - .5) * 7, 3 + track(frame, 1100, 2) * 7],
        [pmod(frame, 480) / 120, 0, Math.floor(random(0, 3) * 65535), pmod(frame, frameWrap)]];
    case 'marbling': {
      // Tine positions slide on bounded walks; amplitudes swell. A stone drop per
      // 600-frame slot grows and relaxes to zero before the next one lands.
      return (frame, { random, track }) => {
        const slot = Math.floor(frame / 600), age = (frame - slot * 600) / 600;
        const radius = (random(slot, 3) * .2 + .1) * Math.sin(Math.PI * age) ** 2 * (random(slot, 4) > .2 ? 1 : 0);
        return [[(track(frame, 900, 1) - .5) * 1400, (track(frame, 1300, 2) - .5) * 1400, (track(frame, 700, 5) - .5) * 900, track(frame, 800, 6)],
          [.2 + random(slot, 7) * .6 + (age - .5) * .05, .2 + random(slot, 8) * .6, radius, 0]];
      };
    }
    case 'rosette':
      // Misregistration of two screens (pixels) and small angle drifts (radians).
      return (frame, { track }) => [[(track(frame, 700, 1) - .5) * 14, (track(frame, 900, 2) - .5) * 14, (track(frame, 800, 3) - .5) * 14, (track(frame, 1000, 4) - .5) * 14],
        [(track(frame, 1300, 5) - .5) * .12, (track(frame, 1500, 6) - .5) * .12, (track(frame, 1100, 7) - .5) * .12, 0]];
    case 'bargello':
      // Profile phases and wavelengths (in stitch columns), peak heights, shared counter.
      return (frame, { track }) => [[(track(frame, 1400, 1) - .5) * 6, (track(frame, 1900, 2) - .5) * 6, 14 + track(frame, 1200, 3) * 40, 5 + track(frame, 1000, 4) * 14],
        [track(frame, 700, 5), track(frame, 900, 6), 0, pmod(frame, frameWrap)]];
    case 'vega':
      // Two lens centers (height units about the middle), radii and bulge powers.
      return (frame, { track }) => [[(track(frame, 700, 1) - .5) * 1.3, (track(frame, 800, 2) - .5) * .8, (track(frame, 900, 3) - .5) * 1.3, (track(frame, 1000, 4) - .5) * .8],
        [.18 + track(frame, 600, 5) * .26, .12 + track(frame, 650, 6) * .2, .3 + track(frame, 500, 7) * .9, track(frame, 550, 8) * .7]];
    case 'kaleidoscope':
      // Wandering center, a turning eased walk (bounded ±2π) and periodic seed orbits.
      return (frame, { track }) => [[.5 + (track(frame, 1300, 1) - .5) * .3, .5 + (track(frame, 1500, 2) - .5) * .24, (track(frame, 1100, 3) - .5) * 12.566, 0],
        [pmod(frame, 1800) / 1800, pmod(frame, 600) / 600, 0, 0]];
    case 'hatch':
      // Base angle of the line sets turns slowly within ±0.8 radians.
      return (frame, { track }) => [[(track(frame, 1600, 1) - .5) * 1.6, 0, 0, 0], [0, 0, 0, 0]];
    default:
      return (frame, { track }) => [[track(frame, 127, 40), track(frame, 181, 41), track(frame, 233, 42), track(frame, 79, 43)], [0, 0, 0, 0]];
  }
}
