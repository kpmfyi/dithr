/** Absolute-frame score shared by the pattern, raster and matter studies.
 * It reuses the intricacy score for drift, warp and local births, then adds
 * per-frame controls supplied by each family. Every value is a pure function
 * of seed and absolute simulation frame: no stored tape, loop or wall clock. */
import { createIntricacyEvolution, intricacyRandom } from './intricacy-evolution.ts';

export type Quad = [number, number, number, number];
export const ease = (n: number) => { const x = Math.max(0, Math.min(1, n)); return x * x * (3 - 2 * x); };
export type ControlTools = {
  /** Uniform [0, 1) value for an integer index and channel. */
  random(index: number, channel: number): number;
  /** Eased random walk between independently hashed targets every `period` frames. */
  track(frame: number, period: number, channel: number): number;
  /** Staggered clock: [id of epoch k, id of epoch k+1, phase in [0, 1), extra id]. */
  clock(frame: number, period: number, channel: number): Quad;
};
export type Controls = (frame: number, tools: ControlTools) => [Quad, Quad];
export const noControls: Controls = () => [[0, 0, 0, 0], [0, 0, 0, 0]];

export function createKitEvolution(seed: number, salt: number, controls: Controls = noControls) {
  const score = createIntricacyEvolution(seed ^ salt);
  const random = (index: number, channel: number) => intricacyRandom(seed ^ salt, index, channel + 300);
  const track = (frame: number, period: number, channel: number) => {
    const t = frame / period, index = Math.floor(t), f = ease(t - index);
    return random(index, channel) * (1 - f) + random(index + 1, channel) * f;
  };
  const clock = (frame: number, period: number, channel: number): Quad => {
    const k = Math.floor(frame / period);
    return [Math.floor(random(k, channel) * 16777215), Math.floor(random(k + 1, channel) * 16777215), frame / period - k, Math.floor(random(k, channel + 1) * 16777215)];
  };
  const tools: ControlTools = { random, track, clock };
  return {
    tools,
    sample(frame: number) {
      const base = score.sample(frame / 60);
      const [control, control2] = controls(frame, tools);
      return { ...base, carrier: Math.floor(random(frame, 91) * 16777215), slow: clock(frame, 97, 60), fast: clock(frame, 29, 62), control, control2 };
    },
  };
}
export type KitScore = ReturnType<ReturnType<typeof createKitEvolution>['sample']>;
