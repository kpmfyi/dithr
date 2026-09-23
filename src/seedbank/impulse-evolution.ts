// Irregular impact arrivals, addressed by explicit time. Keep the four latest
// events; the maximum life is shorter than four minimum interarrival periods.
type Impulse = { start: number; life: number; x: number; y: number };
function random(seed: number, index: number, channel: number) {
  let n = Math.imul(seed ^ Math.imul(index, 0x45d9f3b), 0x27d4eb2d) ^ Math.imul(channel, 0x85ebca6b);
  n = Math.imul(n ^ n >>> 16, 0x7feb352d); n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
export function createImpulseEvolution(seed: number) {
  const events: Impulse[] = [];
  for (let start = -8, i = 0; start <= 7210; i++) {
    events.push({ start, life: 2.1 + random(seed, i, 1) * 1.35,
      x: .05 + random(seed, i, 2) * .9, y: .05 + random(seed, i, 3) * .9 });
    start += .9 + random(seed, i, 4) * .85;
  }
  return {
    sample(time: number): [number, number, number, number][] {
      let low = 0, high = events.length;
      while (low < high) { const mid = (low + high) >>> 1; if (events[mid].start <= time) low = mid + 1; else high = mid; }
      return [0, 1, 2, 3].map(offset => {
        const event = events[low - 1 - offset];
        if (!event) return [0, 0, 1, 0];
        const age = Math.max(0, Math.min(1, (time - event.start) / event.life));
        const attack = Math.min(1, age / .07), decay = Math.min(1, (1 - age) / .28);
        return [event.x, event.y, age, attack * decay];
      });
    },
  };
}
