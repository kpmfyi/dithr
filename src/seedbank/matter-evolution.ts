/** Per-frame controls for the matter studies. Pure functions of seed and absolute frame. */
import type { Controls, Quad } from './kit-evolution.ts';
import type { MatterFamily } from './matter-meta.ts';

export const matterSalt = 0x8a77;
export function matterControls(family: MatterFamily): Controls {
  switch (family) {
    case 'ripple':
      // Rain intensity, unused, and a bounded swell drift (±6 units, eased).
      return (frame, { track }) => [[track(frame, 211, 1), 0, (track(frame, 977, 2) - .5) * 12, (track(frame, 1123, 3) - .5) * 12], [0, 0, 0, 0]];
    case 'smoke':
      // Four wandering source positions; source width/puff clocks (bounded); a cross-wind.
      return (frame, { track }) => [[.12 + track(frame, 401, 1) * .3, .45 + track(frame, 467, 2) * .4, .08 + track(frame, 523, 3) * .84, .2 + track(frame, 587, 4) * .6],
        [(frame % 60000) * .01, (frame % 40000) * .013, track(frame, 347, 5), 0]];
    case 'lightning': {
      // Two unrelated slot clocks. A slot may stay dark; a live strike flickers
      // through a random subset of return strokes, then only afterglow remains.
      const strokes = [0, 1, 2, 5, 6, 10, 11, 16, 17, 23];
      return (frame, { random }) => {
        const strike = (period: number, channel: number): Quad => {
          const slot = Math.floor(frame / period), age = frame - slot * period - Math.floor(random(slot, channel) * (period - 30));
          const live = random(slot, channel + 4) > .18;
          const bright = live && age >= 0 && strokes.includes(age) && (age < 3 || random(slot * 64 + age, channel + 5) > .35) ? .6 + random(slot * 64 + age, channel + 6) * .4 : 0;
          const x0 = .08 + random(slot, channel + 1) * .84;
          return [x0, Math.max(.02, Math.min(.98, x0 + (random(slot, channel + 2) - .5) * .5)), Math.floor(random(slot, channel + 3) * 4096), bright];
        };
        return [strike(89, 1), strike(127, 10)];
      };
    }
    case 'cumulus': {
      // Layer offsets wrap exactly on the 256-cell noise period (monotone, bounded).
      // Rates are noise cells per frame for far, middle and near layers.
      const wrap = (frame: number, rate: number) => ((frame * rate) % 256 + 256) % 256;
      return (frame, { track }) => [[wrap(frame, .0055), wrap(frame, .0095), wrap(frame, .016), (track(frame, 613, 1) - .5) * 3],
        [.2 + track(frame, 2203, 2) * .6, .68 + track(frame, 1777, 3) * .24, 1, track(frame, 887, 4)]];
    }
    case 'borealis': {
      // Curtain shifts are bounded eased tracks; the pulse phase and ray drift wrap
      // on the 64-cell noise period.
      const wrap = (value: number) => ((value % 64) + 64) % 64;
      return (frame, { track }) => [[(track(frame, 701, 1) - .5) * 6, (track(frame, 433, 2) - .5) * 5, wrap(frame * .006), wrap(frame * .0035)],
        [track(frame, 509, 3), track(frame, 1117, 4), track(frame, 1319, 5), 0]];
    }
    case 'strata': {
      // The section sinks by whole pixels; the offset wraps every 3072 px (about
      // three minutes at 1×), a single step that the 30% reversion absorbs. The
      // per-frame delta (0 or 1) moves history down with the bands. Faults slip
      // in 14-frame episodes toward a new bounded throw once per slot.
      const sink = (f: number) => Math.floor(f * .26);
      const fault = (frame: number, period: number, channel: number, random: (i: number, c: number) => number) => {
        const slot = Math.floor(frame / period), local = frame - slot * period;
        const start = random(slot, channel) * (period - 20);
        const target = (k: number) => (random(k, channel + 1) - .5) * 48;
        const t = Math.max(0, Math.min(1, (local - start) / 14));
        return target(slot - 1) + (target(slot) - target(slot - 1)) * t * t * (3 - 2 * t);
      };
      return (frame, { random, track }) => [[sink(frame) % 3072, sink(frame) - sink(frame - 1), (track(frame, 1543, 1) - .5) * 4, track(frame, 997, 2)],
        [fault(frame, 211, 10, random), fault(frame, 263, 20, random), fault(frame, 331, 30, random), 0]];
    }
    case 'agate':
      // Nodule centres wander on slow eased tracks; the band phase wraps on the
      // 64-band period so layers flow inward forever; the boundary wobble drifts.
      return (frame, { track }) => [[.18 + track(frame, 1201, 1) * .3, .3 + track(frame, 1409, 2) * .4, .6 + track(frame, 1307, 3) * .3, .25 + track(frame, 1511, 4) * .5],
        [.3 + track(frame, 1613, 5) * .4, .72 + track(frame, 1117, 6) * .2, (frame * .012) % 64, (track(frame, 919, 7) - .5) * 3]];
    case 'grain': {
      // Two bounded plank tracks (this frame and last, so the shader can take
      // exact integer deltas), and a saw that sweeps once per irregular slot.
      const saw = (frame: number, random: (i: number, c: number) => number) => {
        const slot = Math.floor(frame / 1100), local = frame - slot * 1100;
        const start = random(slot, 3) * 300, span = 420 + random(slot, 4) * 360;
        const t = (local - start) / span;
        if (t < 0 || t > 1) return 0;
        const x = -.05 + t * 1.1;
        return random(slot, 5) > .5 ? x : 1 - x;
      };
      return (frame, { random, track }) => [[track(frame, 1301, 1) - .5, track(frame, 1709, 2) - .5, Math.max(0, Math.min(1, saw(frame, random))), frame % 6000],
        [track(frame - 1, 1301, 1) - .5, track(frame - 1, 1709, 2) - .5, 0, 0]];
    }
    case 'swarm':
      // Displacement-domain offsets (bounded tracks: the flow), crowd offsets and
      // the orbit clock (frame modulo the 6000-frame base period).
      return (frame, { track }) => [[track(frame, 257, 1) * 3, track(frame, 311, 2) * 3, track(frame, 283, 3) * 3, track(frame, 347, 4) * 3],
        [track(frame, 911, 5) * 2, track(frame, 1033, 6) * 2, frame % 6000, 0]];
    case 'phyllotaxis':
      // Head centres wander; the turn angle wraps at 2π in double precision;
      // swell is a slow track; release slots are 90 frames long.
      return (frame, { track }) => [[.3 + track(frame, 1409, 1) * .2, .38 + track(frame, 1201, 2) * .24, (frame * .0045) % (Math.PI * 2), track(frame, 331, 3)],
        [.72 + track(frame, 1531, 4) * .18, .62 + track(frame, 1297, 5) * .24, Math.floor(frame / 90) % 65536, frame % 90]];
    default:
      return (frame, { track }) => [[track(frame, 127, 40), track(frame, 181, 41), track(frame, 233, 42), track(frame, 79, 43)], [0, 0, 0, 0]];
  }
}
