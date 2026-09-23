/** Time-addressed event score. No stored tape, periodic reset or wall-clock RNG.
 * Indexing births directly keeps late seeks as cheap as a starting frame. */
type Quad = [number, number, number, number];
export function intricacyRandom(seed: number, index: number, channel: number) {
  const high = Math.floor(index / 4294967296);
  let n = Math.imul(seed ^ Math.imul(index, 0x45d9f3b) ^ Math.imul(high, 0x9e3779b9), 0x27d4eb2d) ^ Math.imul(channel, 0x85ebca6b);
  n = Math.imul(n ^ n >>> 16, 0x7feb352d); n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
const ease = (n: number) => { const x = Math.max(0, Math.min(1, n)); return x * x * (3 - 2 * x); };
export function createIntricacyEvolution(seed: number) {
  const track = (time: number, period: number, channel: number) => {
    const t = time / period, index = Math.floor(t), f = ease(t - index);
    return intricacyRandom(seed, index, channel) * (1 - f) + intricacyRandom(seed, index + 1, channel) * f;
  };
  return {
    sample(time: number) {
      // Bounded GPU coordinates retain precision even after years of explicit time.
      const drift: Quad = [(track(time, 4.73, 1) - .5) * 8, (track(time, 6.19, 2) - .5) * 8,
        (track(time, 3.37, 3) - .5) * 5, (track(time, 8.53, 4) - .5) * 5];
      const warp: Quad = [.3 + track(time, 5.11, 5), .3 + track(time, 7.79, 6),
        track(time, 2.83, 7), track(time, 11.47, 8)];
      const head = Math.floor(time / 1.73);
      const events = Array.from({ length: 6 }, (_, offset) => {
        const index = head - offset;
        const r = (channel: number) => intricacyRandom(seed, index, channel + 20);
        const start = index * 1.73 + r(0) * 1.25;
        const life = 4 + r(1) * 2.7;
        const age = Math.max(0, Math.min(1, (time - start) / life));
        const strength = ease(age / .15) * (1 - ease((age - .64) / .36));
        const x = r(2) * .72 + .14, y = r(3) * .72 + .14;
        const vx = (r(4) - .5) * .7, vy = (r(5) - .5) * .7;
        const bend = age * (1 - age) * (r(6) - .5) * 1.3;
        const a: Quad = [Math.max(.02, Math.min(.98, x + vx * age + vy * bend)), Math.max(.02, Math.min(.98, y + vy * age - vx * bend)),
          (.075 + r(7) * .22) * (.65 + age * .8), strength];
        const b: Quad = [(r(8) - .5) * Math.PI * 2 + age * (r(9) - .5) * 5,
          .5 + r(10) * 2.4, r(11) > .5 ? .95 : .06, age];
        return { index, start, life, a, b };
      });
      return { drift, warp, events };
    },
  };
}
