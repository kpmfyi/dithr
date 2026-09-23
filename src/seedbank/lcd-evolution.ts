// A seeded, absolute-time score. No clock, playback cursor, or random globals.
// Unequal event intervals replenish local areas; independent interpolated tracks
// change the field itself, so the feedback does not reuse a cyclic motif.
type Quad = [number, number, number, number];
type Renewal = { start: number; duration: number; center: [number, number]; radius: number; aspect: number; angle: number; level: number };
const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
function random(seed: number, index: number, channel: number) {
  let bits = Math.imul(seed ^ Math.imul(index, 0x45d9f3b), 0x27d4eb2d) ^ Math.imul(channel, 0x85ebca6b);
  bits = Math.imul(bits ^ bits >>> 16, 0x7feb352d);
  bits = Math.imul(bits ^ bits >>> 15, 0x846ca68b);
  return ((bits ^ bits >>> 16) >>> 0) / 4294967296;
}

export function createLcdEvolution(seed: number) {
  const events: Renewal[] = [];
  let start = -8;
  for (let i = 0; start <= 7210; i++) {
    const value = (channel: number) => random(seed, i, channel);
    events.push({ start, duration: 1.5 + value(10) * 2.3,
      center: [value(11) * 1.3 - .15, value(12) * 1.3 - .15],
      radius: .12 + value(13) * .29, aspect: .65 + value(14) * 1.8,
      angle: (value(15) - .5) * 2.1, level: value(16) });
    start += 2.2 + value(17) * 4.6;
  }
  const track = (time: number, period: number, channel: number) => {
    const position = time / period, index = Math.floor(position), blend = ease(position - index);
    return random(seed, index, channel) * (1 - blend) + random(seed, index + 1, channel) * blend;
  };
  const renewal = (event: Renewal | undefined, time: number): [Quad, Quad] => {
    if (!event) return [[0, 0, 1, 0], [1, 0, 0, 0]];
    const age = (time - event.start) / event.duration;
    const strength = ease(age / .24) * (1 - ease((age - .58) / .42));
    return [[...event.center, event.radius, strength], [event.aspect, event.angle, event.level, age]];
  };
  return {
    sample(time: number) {
      // Binary search makes a seek to 3600 seconds cost the same as a live tick.
      let low = 0, high = events.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (events[mid].start <= time) low = mid + 1; else high = mid;
      }
      return {
        drift: [time * .041 + track(time, 7.31, 21) * 2.8,
          time * -.027 + track(time, 5.17, 22) * 2.4,
          (track(time, 11.93, 23) - .5) * .55,
          .68 + track(time, 8.61, 24) * .9] as Quad,
        warp: [.25 + track(time, 4.79, 25) * .8,
          .15 + track(time, 9.37, 26) * .27,
          time * .019 + track(time, 13.13, 27) * 2.5,
          track(time, 3.83, 28)] as Quad,
        renewalA: renewal(events[low - 1], time),
        renewalB: renewal(events[low - 2], time),
      };
    },
  };
}
