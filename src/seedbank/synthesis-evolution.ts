import { intricacyRandom as random } from './intricacy-evolution.ts';
/** Mutable score owned by one renderer. Cached targets and births; no per-step arrays.
 * sample(t) is independent of call order, including negative priming and late seeks. */
export function createSynthesisEvolution(seed: number) {
  const periods = [4.73, 6.19, 3.37, 8.53];
  const cells = new Float64Array(4).fill(NaN), left = new Float64Array(4), right = new Float64Array(4);
  const values = new Float64Array(4);
  const events = Array.from({ length: 4 }, () => ({ index: NaN, start: 0, life: 0,
    constants: new Float64Array(12), a: new Float64Array(4), b: new Float64Array(4) }));
  const score = { drift: new Float64Array(4), events, carrier: 0 };
  const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
  return {
    sample(time: number) {
      for (let j = 0; j < 4; j++) {
        const t = time / periods[j], cell = Math.floor(t), f = ease(t-cell);
        if (cells[j] !== cell) { cells[j] = cell; left[j] = random(seed, cell, j+1); right[j] = random(seed, cell+1, j+1); }
        values[j] = left[j] + (right[j]-left[j])*f;
      }
      for (let j = 0; j < 4; j++) { score.drift[j] = (values[j]-.5)*6; }
      const head = Math.floor(time / 1.31);
      for (let j = 0; j < 4; j++) {
        const e = events[j], index = head-j, c = e.constants;
        if (e.index !== index) {
          e.index = index;
          for (let k = 0; k < 12; k++) c[k] = random(seed, index, k+20);
          e.start = index*1.31 + c[0]*.8; e.life = 3.1+c[1]*1.7;
        }
        const age = Math.max(0, Math.min(1, (time-e.start)/e.life));
        const radius = (.1+c[7]*.21)*(.7+age*.65), angle = c[8]*Math.PI*2 + age*(c[9]-.5)*2;
        e.a[0] = .12+c[2]*.76+(c[4]-.5)*age*.28; e.a[1] = .12+c[3]*.76+(c[5]-.5)*age*.28;
        e.a[2] = 1/radius; e.a[3] = ease(age/.14)*(1-ease((age-.58)/.42));
        e.b[0] = Math.cos(angle); e.b[1] = Math.sin(angle); e.b[2] = c[10]>.5 ? .97 : .03;
        e.b[3] = 1/(radius*(.65+c[11]*1.4));
      }
      score.carrier = Math.floor(random(seed, Math.floor(time*60+1e-6), 91)*16777215);
      return score;
    },
  };
}
/** Fixed seeded random lattice: geometry input only, never an animation tape. */
export function synthesisLattice(seed: number, edge = 128) {
  const bytes = new Uint8Array(edge*edge*4);
  for (let i=0; i<edge*edge; i++) for (let c=0; c<4; c++) bytes[i*4+c] = Math.floor(random(seed, i, 100+c)*256);
  return bytes;
}
