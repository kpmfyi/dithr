/** Absolute-frame score for the mechanism studies. It reuses the intricacy
 * score for drift, warp and local births, then adds the per-frame controls
 * each accumulator needs (sort gaps, automaton rules, write heads, zoom).
 * Every value is a pure function of seed and absolute simulation frame. */
import { createIntricacyEvolution, intricacyRandom } from './intricacy-evolution.ts';
import type { MechanismFamily } from './recipes';

type Quad = [number, number, number, number];
const ease = (n: number) => { const x = Math.max(0, Math.min(1, n)); return x * x * (3 - 2 * x); };
// Wolfram rules whose empty neighborhood stays empty, so blank rows do not strobe.
// 170, 204 and 240 simply shift or copy, so some regions stream instead of computing.
const rules = [18, 22, 26, 30, 54, 60, 90, 102, 110, 122, 126, 146, 150, 170, 204, 240];
const gaps = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
/** Rows the automaton advances per frame. The whole panel must be rewritten
 * from the top feed within the 128-frame priming window. */
export const automatonRowStep = (height: number) => 2 * Math.max(1, Math.ceil(height / 240));

export function createMechanismEvolution(seed: number, family: MechanismFamily) {
  const score = createIntricacyEvolution(seed ^ 0x5a17);
  const random = (index: number, channel: number) => intricacyRandom(seed, index, channel + 200);
  const track = (frame: number, period: number, channel: number) => {
    const t = frame / period, index = Math.floor(t), f = ease(t - index);
    return random(index, channel) * (1 - f) + random(index + 1, channel) * f;
  };
  // Staggered switching: a cell uses the id of epoch k or k+1 depending on its own phase.
  const clock = (frame: number, period: number, channel: number): Quad => {
    const k = Math.floor(frame / period);
    return [Math.floor(random(k, channel) * 16777215), Math.floor(random(k + 1, channel) * 16777215), frame / period - k, Math.floor(random(k, channel + 1) * 16777215)];
  };
  const control = (frame: number): [Quad, Quad] => {
    if (family === 'shellsort') {
      const gap = gaps[Math.floor(random(frame, 1) * gaps.length)];
      const vertical = track(frame, 131, 2) > .68 ? 1 : 0;
      return [[gap, Math.floor(random(frame, 3) * 64), vertical, Math.floor(random(Math.floor(frame / 97), 4) * 65535)],
        [track(frame, 211, 5), track(frame, 173, 6), 0, 0]];
    }
    if (family === 'rule') {
      // Four regional rules change at unrelated, overlapping times.
      const pick = (channel: number, period: number) => {
        const phase = random(0, channel) * period;
        return rules[Math.floor(random(Math.floor((frame + phase) / period), channel) * rules.length)];
      };
      return [[pick(10, 283), pick(11, 347), pick(12, 419), pick(13, 509)], [.04 + track(frame, 157, 14) * .5, track(frame, 97, 15), 0, 0]];
    }
    if (family === 'scanhead') {
      // Monotone heads: a steady sweep plus a bounded, slowly eased wobble.
      // Each row is rewritten at least every ~110 frames, inside the priming window.
      const head = (period: number, channel: number) => {
        const wobble = track(frame, 307, channel) * .3;
        return ((frame / period + random(0, channel) + wobble) % 1 + 1) % 1;
      };
      return [[head(107, 20), head(89, 21), head(131, 22), 0], [track(frame, 71, 23), track(frame, 113, 24), 0, 0]];
    }
    if (family === 'larsen') {
      const inward = track(frame, 389, 30) > .74;
      const zoom = inward ? .972 + track(frame, 83, 31) * .012 : 1.012 + track(frame, 101, 32) * .04;
      const angle = (track(frame, 149, 33) - .5) * .075;
      const fold = track(frame, 241, 34);
      return [[zoom, angle, fold > .78 ? 2 : fold > .45 ? 1 : 0, 0],
        [.5 + (track(frame, 173, 35) - .5) * .46, .5 + (track(frame, 199, 36) - .5) * .46, (track(frame, 61, 37) - .5) * 3, (track(frame, 67, 38) - .5) * 3]];
    }
    return [[track(frame, 127, 40), track(frame, 181, 41), track(frame, 233, 42), track(frame, 79, 43)], [0, 0, 0, 0]];
  };
  return {
    sample(frame: number) {
      const base = score.sample(frame / 60);
      const [a, b] = control(frame);
      return { ...base, carrier: Math.floor(random(frame, 91) * 16777215), slow: clock(frame, 97, 60), fast: clock(frame, 29, 62), control: a, control2: b };
    },
  };
}
