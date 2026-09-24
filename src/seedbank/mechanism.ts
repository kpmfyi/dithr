import { HalfFloatType, NearestFilter, NoColorSpace, RenderTarget, Vector2, Vector4 } from 'three';
import { MeshBasicNodeMaterial, QuadMesh, type Node, type WebGPURenderer } from 'three/webgpu';
import type { MechanismFamily } from './recipes';
import { automatonRowStep, createMechanismEvolution } from './mechanism-evolution';
import { Fn, hash as pixelHash, uint, abs, cos, exp2, float, floor, fract, max, min, mix, sin, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';

type Scalar = Node<'float'>;
type Point = Node<'vec2'>;
type Quad = Node<'vec4'>;
type ScalarUniform = ReturnType<typeof uniform<'float'>>;
type Inputs = {
  seed: ScalarUniform; scale: ScalarUniform; speed: ScalarUniform;
  intensity: ScalarUniform; detail: ScalarUniform; aspect: ScalarUniform;
  colors: ReturnType<typeof uniform<'vec3'>>[];
};

function hash(p: Point): Scalar {
  return fract(sin(p.dot(vec2(127.1, 311.7))).mul(43758.5453));
}
function noise(p: Point): Scalar {
  const cell = floor(p), f = fract(p);
  const eased = f.mul(f).mul(vec2(3).sub(f.mul(2)));
  return mix(mix(hash(cell), hash(cell.add(vec2(1, 0))), eased.x),
    mix(hash(cell.add(vec2(0, 1))), hash(cell.add(vec2(1, 1))), eased.x), eased.y);
}
const equal = (a: Scalar, b: Scalar | number) => float(1).sub(step(.5, abs(a.sub(b))));
const pick4 = (index: Scalar, value: Quad) => mix(mix(value.x, value.y, step(.5, index)), mix(value.z, value.w, step(2.5, index)), step(1.5, index));
/** Mechanism studies change the accumulator itself rather than only the source
 * and velocity fields. Every mechanism stays contractive (or has a bounded
 * dependency cone) inside the 128-frame priming window, so the BA shadow
 * epoch converges with the displayed history before each handoff.
 * RG: signal and slower difference envelope. BA: the priming epoch.
 * Original TSL implementation; no source or artwork from the references is embedded.
 */
export function createMechanism(u: Inputs, family: MechanismFamily) {
  const maxEdge = 384;
  const events = Array.from({ length: 6 }, () => ({ a: uniform(new Vector4()), b: uniform(new Vector4()) }));
  const dimensions = uniform(new Vector2(384, 384));
  const screen = uniform(new Vector2(960, 640));
  const tick = uniform(0), initialize = uniform(1), carrier = uniform(0), rowStep = uniform(2);
  const drift = uniform(new Vector4()), warp = uniform(new Vector4());
  const slow = uniform(new Vector4()), fast = uniform(new Vector4());
  const control = uniform(new Vector4()), control2 = uniform(new Vector4());
  let evolutionSeed = -1;
  let evolution = createMechanismEvolution(0, family);
  const targets = [0, 1].map(() => new RenderTarget(384, 384, {
    minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false,
    stencilBuffer: false, type: HalfFloatType, generateMipmaps: false, colorSpace: NoColorSpace,
  }));
  const previous = texture(targets[0].texture);
  const result = texture(targets[0].texture);
  const stepMaterial = new MeshBasicNodeMaterial();
  stepMaterial.depthTest = false; stepMaterial.depthWrite = false; stepMaterial.toneMapped = false;
  stepMaterial.fragmentNode = Fn(() => {
    const st = uv(), s = u.seed;
    const texel = vec2(1).div(dimensions), pixel = floor(st.mul(dimensions));
    const toDomain = (point: Point) => point.sub(.5).mul(vec2(u.aspect, 1)).mul(u.scale);
    const q = toDomain(st);
    const bend = noise(q.mul(.91).add(drift.xy).add(s));
    const fold = noise(q.mul(1.47).sub(drift.zw).sub(s));
    const domain = q.add(vec2(bend, fold).sub(.5).mul(warp.x.mul(2.4)));
    const field = noise(domain.mul(1.5).add(drift.zw).add(s));
    const other = noise(domain.mul(2.1).sub(drift.yx).add(s.mul(.7)));
    // Local arrivals, evaluated at any point so block mechanisms can agree on them.
    const arrivals = (point: Point) => {
      const gust = vec2(0).toVar(), mass = float(.01).toVar(), deposit = float(0).toVar(), peak = float(0).toVar();
      const lens = vec4(.5, .5, 1, 0).toVar();
      for (const event of events) {
        const delta = point.sub(event.a.xy).mul(vec2(u.aspect, 1));
        const radius = delta.div(vec2(event.b.y, 1)).length().div(event.a.z);
        const footprint = float(1).sub(smoothstep(.25, 1.5, radius)).mul(event.a.w);
        gust.addAssign(vec2(cos(event.b.x), sin(event.b.x)).mul(footprint));
        mass.addAssign(footprint); deposit.addAssign(footprint.mul(event.b.z));
        // Hard-edged lens footprint: the strongest event owns the pixel.
        const inside = step(radius, .9).mul(event.a.w);
        const owns = step(lens.w, inside.sub(.001));
        lens.assign(mix(lens, vec4(event.a.xy, event.b.z, inside), owns.mul(step(.05, inside))));
        peak.assign(max(peak, footprint));
      }
      return { gust: gust.div(mass), mass, level: deposit.div(mass), peak, lens };
    };
    const local = arrivals(st);
    // Dense torn islands plus fine incisions: the benchmark's extrapolated signal zones.
    const density = mix(7, 21, u.detail);
    const etched = (phase: Scalar) => fract(phase).sub(.5).mul(2).abs();
    const islands = noise(domain.mul(vec2(.8, 2.1)).sub(drift.xy)).sub(.5).mul(2.8).add(.5);
    const incisions = etched(field.mul(density).add(other.mul(2.3)));
    const torn = islands.add(incisions.sub(.5).mul(1.2)).add(local.level.sub(.5).mul(local.mass.clamp(0, 1)).mul(.8));

    const boundary = float(1).sub(step(.5, tick.mod(256)));
    const bounded = (point: Point) => point.clamp(texel.mul(.5), vec2(1).sub(texel.mul(.5)));
    const read = (point: Point): Quad => { const v = previous.sample(point); return mix(v, v.zwzw, boundary); };
    const at = (offset: Point) => read(bounded(st.add(offset.mul(texel))));
    const wrapped = (offset: Point) => read(fract(st.add(offset.mul(texel))));
    type Lane = (value: Quad) => Point;
    const lanes: Lane[] = [v => v.xy, v => v.zw];
    const finish = (history: Scalar, value: Scalar, echoHistory: Scalar, target: Scalar, injection: Scalar | number, gain = 1.035) => {
      const signal = mix(history, target, injection).sub(.5).mul(gain).add(.5).clamp(0, 1);
      const echo = mix(echoHistory, abs(signal.sub(value)), .035).clamp(0, 1);
      return vec2(signal, echo);
    };
    const coin = (salt: number) => pixelHash(uint(pixel.x).add(uint(pixel.y).mul(65537)).add(uint(carrier)).add(uint(salt)));

    let evolve: (lane: Lane) => Point;
    if (family === 'shellsort') {
      // Gapped compare/exchange (a shell-sort pass per frame). Partners at
      // ±gap agree through a shared offset parity, so sorted runs grow tens of
      // pixels per second instead of one. Key R, payload G travel together.
      const horizontal = float(1).sub(control.z);
      const index = mix(pixel.y, pixel.x, horizontal), across = mix(pixel.x, pixel.y, horizontal);
      const shift = floor(noise(vec2(across.mul(.043), drift.x.add(s))).sub(.5).mul(5).add(.5));
      const base = index.sub(shift);
      const upper = floor(base.add(control.y).div(control.x)).mod(2);
      const reach = control.x.mul(float(1).sub(upper.mul(2)));
      const axis = (n: Scalar) => mix(vec2(0, n), vec2(n, 0), horizontal);
      const band = floor(across.div(mix(2, 7, hash(vec2(floor(across.div(9)), control.w)))));
      const ascending = step(.5, pixelHash(uint(band).add(uint(control.w))));
      const takeMin = abs(float(1).sub(upper).add(ascending).sub(1));
      const partnerPoint = st.add(axis(reach.sub(shift)).mul(texel));
      const inside = step(0, partnerPoint.x).mul(step(partnerPoint.x, 1)).mul(step(0, partnerPoint.y)).mul(step(partnerPoint.y, 1));
      const middle = toDomain(st.add(axis(reach.mul(.5).sub(shift)).mul(texel)));
      const zone = step(mix(.55, .3, control2.x), noise(middle.mul(vec2(.7, 1.9)).add(drift.zw)));
      const lower = mix(.05, .32, u.detail);
      evolve = lane => {
        const mine = lane(at(axis(shift.negate()))), partner = lane(read(bounded(partnerPoint)));
        const chosen = mix(max(mine.x, partner.x), min(mine.x, partner.x), takeMin);
        const eligible = step(lower, min(mine.x, partner.x)).mul(zone).mul(inside);
        const swapped = step(.0001, abs(chosen.sub(mine.x))).mul(eligible);
        const value = lane(at(vec2(0))).x;
        return finish(mix(mine.x, partner.x, swapped), value, mix(mine.y, partner.y, swapped), torn, .1);
      };
    } else if (family === 'rule') {
      // Elementary automata cascading down the panel, rowStep rows per frame.
      // Rows at an even stride form interleaved fields. Every pixel depends
      // only on the top feed and events from the last H / rowStep frames.
      const band = floor(pixel.y.div(13));
      const slip = floor(noise(vec2(band.mul(.61), control2.y.mul(3).add(s))).sub(.5).mul(4).add(.5));
      const top = step(dimensions.y.sub(rowStep).sub(.5), pixel.y);
      const feedDensity = mix(.0015, .05, u.detail).mul(control2.x.mul(1.6).add(.2));
      const feed = (dx: number) => step(float(1).sub(feedDensity), pixelHash(uint(pixel.x.add(dx).add(slip).add(512)).add(uint(carrier))));
      const region = floor(noise(domain.mul(.55).add(drift.xy.mul(.5))).mul(3.2).add(noise(domain.mul(2.3).sub(drift.zw)).mul(.8)));
      const rule = pick4(region.clamp(0, 3), control);
      const tone = mix(1, .5, region.mod(2));
      const flip = step(coin(17), local.peak.mul(.006));
      evolve = lane => {
        const cell = (dx: number) => mix(step(.1, lane(at(vec2(slip.add(dx), rowStep))).x), feed(dx), top);
        const pattern = cell(-1).mul(4).add(cell(0).mul(2)).add(cell(1));
        const bit = abs(floor(rule.div(exp2(pattern))).mod(2).sub(flip));
        // Afterimage marks where the rule departs from plain scrolling; it scrolls too.
        const above = mix(lane(at(vec2(slip, rowStep))).y, 0, top);
        return vec2(bit.mul(tone), mix(above, abs(bit.sub(cell(0))).mul(.4), .035).clamp(0, 1));
      };
    } else if (family === 'macroblock') {
      // Datamosh: every block copies history through one motion vector, so
      // smears cross block borders. Residuals are single DCT basis patterns;
      // intra refreshes arrive only where events land.
      const size = floor(mix(13, 6, u.detail).add(.5));
      const id = floor(pixel.div(size)), within = pixel.sub(id.mul(size));
      const phase = pixelHash(uint(id.x).mul(uint(97)).add(uint(id.y).mul(uint(7919))).add(uint(s.mul(4099))));
      const epoch = mix(fast.x, fast.y, step(float(1).sub(phase), fast.z));
      const blockRandom = (channel: number) => pixelHash(uint(id.x).mul(uint(73)).add(uint(id.y).mul(uint(9151))).add(uint(epoch)).add(uint(channel * 977)));
      const center = id.add(.5).mul(size).div(dimensions);
      const centerDomain = toDomain(center);
      const flow = vec2(noise(centerDomain.mul(.6).add(drift.xy)), noise(centerDomain.mul(.6).sub(drift.zw))).sub(.5).mul(7);
      const rogue = vec2(blockRandom(2), blockRandom(3)).sub(.5).mul(18);
      const skip = step(.86, blockRandom(1));
      const motion = floor(mix(flow, rogue, step(blockRandom(1), .2)).mul(float(1).sub(skip)).add(.5));
      const frequency = floor(vec2(blockRandom(4), blockRandom(5)).mul(mix(3, 8, u.detail)));
      const basis = step(0, cos(within.x.add(.5).mul(3.14159).mul(frequency.x).div(size)).mul(cos(within.y.add(.5).mul(3.14159).mul(frequency.y).div(size))));
      const residual = step(blockRandom(6), .35).mul(.14);
      const intra = max(step(.45, arrivals(center).peak), step(blockRandom(7), .025));
      const target = mix(torn, basis, .4);
      evolve = lane => {
        const moved = lane(at(motion.negate())), value = lane(at(vec2(0))).x;
        const history = mix(moved.x, basis, residual);
        return finish(history, value, moved.y, target, mix(.05, .92, intra), 1);
      };
    } else if (family === 'frost') {
      // Directional grayscale dilation with decay: facets grow one pixel per
      // frame along one of three quantized axes (a hexagonal approximation),
      // with sparse side branches. Nuclei glide on an integer lattice; stale
      // growth fades fast. Lipschitz ≤ .975 per frame.
      const axisIndex = floor(noise(domain.mul(.45).add(drift.xy)).mul(3).add(warp.z.mul(6))).mod(3);
      const axes = [vec2(1, 0), vec2(1, 2), vec2(-1, 2)];
      const along = mix(mix(axes[0], axes[1], step(.5, axisIndex)), axes[2], step(1.5, axisIndex));
      const branch = mix(mix(axes[1], axes[2], step(.5, axisIndex)), axes[0], step(1.5, axisIndex));
      const porous = step(mix(.08, .34, u.detail), pixelHash(uint(pixel.x).add(uint(pixel.y).mul(65537)).add(uint(s.mul(8191)))));
      const sideGate = step(.78, other).mul(step(.5, fract(pixel.x.add(pixel.y).mul(.5))));
      // Point nuclei on an integer-gliding lattice; density follows the field and events.
      const lattice = floor(drift.xy.mul(24).add(drift.zw.mul(11))), np = pixel.sub(lattice).add(4096);
      const sparse = pixelHash(uint(np.x).add(uint(np.y).mul(65537)).add(uint(s.mul(8191))));
      const rate = mix(.0003, .0035, smoothstep(.4, .8, field)).add(local.peak.mul(.02));
      const nuclei = step(float(1).sub(rate), sparse);
      const melt = local.peak.mul(step(local.level, .45)).mul(.3);
      evolve = lane => {
        const from = (offset: Point) => lane(at(offset));
        const here = from(vec2(0)), a = from(along), b = from(along.negate());
        const c = from(branch), d = from(branch.negate());
        const grown = max(here.x.mul(.9), max(max(a.x, b.x), max(c.x, d.x).mul(sideGate).mul(.94)).mul(.975).mul(porous));
        const signal = max(grown, nuclei).mul(float(1).sub(melt)).clamp(0, 1);
        const value = lane(at(vec2(0))).x;
        return vec2(signal, mix(here.y, abs(signal.sub(value)), .035).clamp(0, 1));
      };
    } else if (family === 'larsen') {
      // Video feedback: history is resampled through a drifting rotate/zoom
      // map with optional mirror folds, so every injected mark repeats as a
      // spiral of nearest-neighbor copies (inward or outward).
      const centre = control2.xy;
      const offset = st.sub(centre).mul(vec2(u.aspect, 1)).toVar();
      offset.assign(vec2(mix(offset.x, abs(offset.x), step(.5, control.z)), mix(offset.y, abs(offset.y), step(1.5, control.z))));
      const turned = vec2(offset.x.mul(cos(control.y)).sub(offset.y.mul(sin(control.y))), offset.x.mul(sin(control.y)).add(offset.y.mul(cos(control.y))));
      const sample = centre.add(turned.div(control.x).div(vec2(u.aspect, 1))).add(control2.zw.mul(texel));
      const parity = pixel.y.add(tick).mod(2), direction = float(1).sub(parity.mul(2));
      const order = abs(parity.sub(step(.5, warp.w)));
      const mark = local.peak.mul(.3);
      const target = mix(torn, incisions.sub(.5).mul(2.2).add(.5), .45);
      evolve = lane => {
        const moved = lane(read(bounded(sample))), neighbor = lane(at(vec2(0, direction))), here = lane(at(vec2(0)));
        const sorted = mix(min(here.x, neighbor.x), max(here.x, neighbor.x), order);
        return finish(mix(moved.x, sorted, .12), here.x, moved.y, target, mark.add(.05), 1);
      };
    } else if (family === 'buoyancy') {
      // Two-dimensional pixel sort on alternating 2×2 (Margolus) blocks: each
      // block permutes its four pixels so brighter values move along a
      // curling direction field. Inside events the order inverts.
      const o = tick.mod(2);
      const origin = floor(pixel.sub(o).div(2)).mul(2).add(o);
      const mine = pixel.sub(origin);
      const center = origin.add(1).div(dimensions);
      const centerDomain = toDomain(center);
      const angle = noise(centerDomain.mul(.5).add(drift.xy)).mul(9.5).add(noise(centerDomain.mul(1.3).sub(drift.zw)).mul(2.5)).add(warp.z.mul(6.283));
      const centerArrivals = arrivals(center);
      const g = vec2(cos(angle), sin(angle)).add(centerArrivals.gust.mul(1.5));
      const invert = step(.35, centerArrivals.peak).mul(step(centerArrivals.level, .5));
      const blockIndex = uint(origin.x).add(uint(origin.y).mul(65537)).add(uint(carrier));
      const pressure = step(pixelHash(blockIndex), mix(.55, .95, warp.y));
      const slots = [vec2(0, 0), vec2(1, 0), vec2(0, 1), vec2(1, 1)];
      const myIndex = mine.x.add(mine.y.mul(2));
      const position = slots.map((slot, i) => g.dot(slot).add(i * .001));
      const myPosition = pick4(myIndex, vec4(position[0], position[1], position[2], position[3]));
      const order = position.reduce((sum: Scalar, value) => sum.add(step(value, myPosition)), float(-1));
      const gate = mix(.015, .2, u.detail);
      evolve = lane => {
        const cells = slots.map(slot => lane(read(bounded(origin.add(slot).add(.5).mul(texel)))));
        const keys = cells.map((cell, i) => cell.x.add(i * .0001));
        const rank = keys.map(key => keys.reduce((sum: Scalar, other) => sum.add(step(other, key)), float(-1)));
        const target = mix(order, float(3).sub(order), invert);
        const value = cells.reduce((sum: Scalar, cell, i) => sum.add(cell.x.mul(equal(rank[i], target))), float(0));
        const echo = cells.reduce((sum: Scalar, cell, i) => sum.add(cell.y.mul(equal(rank[i], target))), float(0));
        const high = max(max(cells[0].x, cells[1].x), max(cells[2].x, cells[3].x));
        const low = min(min(cells[0].x, cells[1].x), min(cells[2].x, cells[3].x));
        const active = step(gate, high.sub(low)).mul(pressure);
        const here = pick4(myIndex, vec4(cells[0].x, cells[1].x, cells[2].x, cells[3].x));
        const hereEcho = pick4(myIndex, vec4(cells[0].y, cells[1].y, cells[2].y, cells[3].y));
        return finish(mix(here, value, active), here, mix(hereEcho, echo, active), torn, .11);
      };
    } else if (family === 'glyph') {
      // Procedural 5×7 mirrored glyphs, retyped by a staggered cursor sweep.
      // Melt zones sort bright pixels downward and let the text drip.
      const column = floor(pixel.x.div(6)), line = floor(pixel.y.div(8));
      const gx = pixel.x.sub(column.mul(6)), gy = float(7).sub(pixel.y.sub(line.mul(8)));
      const lineRandom = hash(vec2(line, s.add(3.1)));
      const phase = fract(column.mul(mix(.009, .03, lineRandom)).add(lineRandom));
      const switched = step(float(1).sub(phase), slow.z);
      const epoch = mix(slow.x, slow.y, switched);
      const character = pixelHash(uint(column).mul(uint(131)).add(uint(line).mul(uint(7919))).add(uint(epoch)));
      const bitIndex = min(gx, float(4).sub(gx)).add(gy.sub(1).mul(3));
      const bit = step(.5, pixelHash(uint(character.mul(65535)).add(uint(bitIndex).mul(uint(40503)))));
      const inCell = step(gx, 4).mul(step(1, gy));
      const word = step(.2, pixelHash(uint(character.mul(9973)).add(uint(99))));
      const blankLine = step(.86, pixelHash(uint(line).add(uint(slow.w))));
      const ink = bit.mul(inCell).mul(word).mul(float(1).sub(blankLine));
      const zone = noise(domain.mul(.5).add(drift.xy.mul(.6)));
      const inverse = step(.74, zone), dim = step(zone, .18);
      const cursor = step(abs(phase.sub(float(1).sub(slow.z))), .012).mul(float(1).sub(blankLine));
      const text = max(mix(mix(ink, ink.mul(.5), dim), float(1).sub(ink), inverse), cursor);
      const melting = max(step(mix(.74, .5, u.detail).sub(warp.y.mul(.08)), noise(domain.mul(vec2(1.1, .4)).sub(drift.zw))), step(.4, local.peak));
      const fall = floor(mix(1, 3, other).add(.5)).mul(melting);
      const parity = pixel.y.add(tick).mod(2), direction = float(1).sub(parity.mul(2));
      evolve = lane => {
        const here = lane(at(vec2(0))), moved = lane(at(vec2(floor(local.gust.x.mul(2)).mul(melting), fall)));
        const neighbor = lane(at(vec2(0, direction)));
        // Descending order below: brighter values settle toward the lower row.
        const sorted = mix(max(moved.x, neighbor.x), min(moved.x, neighbor.x), parity);
        const history = mix(moved.x, sorted, melting.mul(.7));
        return finish(history, here.x, moved.y, text, mix(.55, .05, melting), 1);
      };
    } else if (family === 'scanhead') {
      // Rolling-shutter writing: three heads sweep the panel at unequal,
      // monotone speeds and write fresh detail. Between passes each row band
      // slides sideways (wrapping) at its own switching speed.
      const heads = [control.x, control.y, control.z].map(h => step(abs(pixel.y.sub(floor(h.mul(dimensions.y)))), 2));
      const band = floor(pixel.y.div(mix(2, 6, hash(vec2(floor(pixel.y.div(17)), s)))));
      const phase = hash(vec2(band, s.add(1.7)));
      const epoch = mix(fast.x, fast.y, step(float(1).sub(phase), fast.z));
      const speed = pixelHash(uint(band).mul(uint(313)).add(uint(epoch))).sub(.5).mul(mix(4, 14, control2.x));
      const slide = floor(speed.add(local.gust.x.mul(3)).add(.5));
      const fine = etched(domain.x.mul(density.mul(.9)).add(field.mul(4)));
      const variants = [torn, float(1).sub(islands).add(incisions.sub(.5).mul(.8)), step(.45, fine).mul(step(.4, other))];
      const written = variants.reduce((sum: Scalar, variant, i) => mix(sum, variant, heads[i]), torn);
      const writing = max(max(heads[0], heads[1]), heads[2]);
      const parity = pixel.x.add(tick).mod(2), direction = float(1).sub(parity.mul(2));
      evolve = lane => {
        const here = lane(at(vec2(0))), moved = lane(wrapped(vec2(slide.negate(), 0)));
        const neighbor = lane(wrapped(vec2(direction.sub(slide), 0)));
        const sorted = mix(min(moved.x, neighbor.x), max(moved.x, neighbor.x), abs(parity.sub(step(.5, control2.y))));
        const history = mix(moved.x, sorted, step(.06, min(moved.x, neighbor.x)).mul(.35));
        return finish(history, here.x, moved.y, written, mix(.02, 1, writing), 1);
      };
    } else if (family === 'loupe') {
      // Hard-edged lenses crush history into mosaic cells that grow with each
      // event's age, and bulge it slightly. Outside, shear currents and
      // vertical compare/exchange tear the enlarged blocks back apart.
      const lens = local.lens, inside = step(.5, lens.w);
      const cellSize = floor(mix(2, mix(6, 14, u.detail), lens.z).add(.5));
      const lensPixel = floor(lens.xy.mul(dimensions));
      const cell = floor(pixel.sub(lensPixel).div(cellSize)).mul(cellSize).add(lensPixel).add(floor(cellSize.mul(.5)));
      const bulge = lensPixel.add(cell.sub(lensPixel).mul(mix(.985, 1.02, step(.5, lens.z))));
      const lensed = floor(bulge).add(.5).mul(texel);
      const velocity = floor(vec2(other.sub(.5).mul(6), bend.sub(.5).mul(3)).add(local.gust.mul(2)).add(.5));
      const parity = pixel.y.add(tick).mod(2), direction = float(1).sub(parity.mul(2));
      const order = abs(parity.sub(step(.5, warp.w)));
      evolve = lane => {
        const here = lane(at(vec2(0))), moved = lane(at(velocity.negate()));
        const neighbor = lane(at(vec2(0, direction)));
        const sorted = mix(min(here.x, neighbor.x), max(here.x, neighbor.x), order);
        const outside = mix(sorted, moved.x, .6);
        const crushed = lane(read(bounded(lensed)));
        const history = mix(outside, crushed.x, inside);
        return finish(history, here.x, mix(moved.y, crushed.y, inside), torn, mix(.2, .04, inside));
      };
    } else {
      // Interlaced fields: each frame rewrites only the rows of one field.
      // The two fields carry different sources through different currents,
      // so every moving edge combs; events let one field bleed into the other.
      const field2 = pixel.y.mod(2);
      const active = equal(field2, tick.mod(2));
      const currentA = vec2(other.sub(.5).mul(9), field.sub(.5).mul(6)).add(local.gust.mul(3));
      const currentB = vec2(bend.sub(.5).mul(-10), 4).add(local.gust.mul(2));
      const current = mix(currentA, currentB, field2);
      const bleed = step(.35, local.peak);
      const velocity = vec2(floor(current.x.add(.5)), floor(current.y.mul(.5).add(.5)).mul(2).add(bleed));
      const sourceB = etched(domain.y.mul(density.mul(.6)).add(field.mul(3))).sub(.5).mul(1.6).add(islands.mul(.5));
      const target = mix(torn, sourceB, field2);
      const parity = floor(pixel.y.div(2)).add(floor(tick.div(2))).mod(2), direction = float(1).sub(parity.mul(2));
      const order = abs(parity.sub(step(.5, warp.w)));
      evolve = lane => {
        const here = lane(at(vec2(0))), moved = lane(at(velocity.negate()));
        const neighbor = lane(at(vec2(0, direction.mul(2))));
        const sorted = mix(min(moved.x, neighbor.x), max(moved.x, neighbor.x), order);
        const history = mix(moved.x, sorted, step(.06, min(moved.x, neighbor.x)).mul(.5));
        const updated = finish(history, here.x, moved.y, target, .2);
        return mix(here, updated, active);
      };
    }
    const main = evolve(lanes[0]), shadow = evolve(lanes[1]);
    const seedState = vec2(torn.clamp(0, 1), 0);
    const prime = max(initialize, float(1).sub(step(.5, abs(tick.mod(256).sub(128)))));
    return vec4(mix(main, seedState, initialize), mix(shadow, seedState, prime));
  })();
  const quad = new QuadMesh(stepMaterial);
  const material = new MeshBasicNodeMaterial();
  material.depthTest = false; material.depthWrite = false; material.toneMapped = false;
  material.colorNode = Fn(() => {
    const pixel = floor(uv().mul(screen)), st = pixel.add(.5).div(screen);
    const cellPixel = floor(st.mul(dimensions));
    const state = result.sample(st);
    const [ground, accent, ink] = u.colors;
    // Stationary integer PCG coverage thresholds; three flat pigments.
    const threshold = pixelHash(uint(pixel.x).add(uint(pixel.y).mul(65537)).add(uint(u.seed.mul(65535))));
    const cut = family === 'frost' ? .62 : family === 'rule' ? .75 : .72;
    const high = step(threshold, smoothstep(cut - .04, cut + .1, state.r));
    const middle = step(fract(threshold.add(.37)), smoothstep(.09, .2, state.r)).mul(float(1).sub(high));
    const pigment = mix(mix(ground, ground.mul(.32), middle), ink, high);
    // Carrier identity follows the mechanism: sorted row segments, automaton
    // fields, text lines, write heads, block exposure. Five studies have none.
    let marks: Scalar = float(0);
    const row = floor(pixel.y.div(2));
    if (family === 'shellsort') {
      const segment = floor(pixel.x.div(83).add(hash(vec2(row, u.seed)).mul(3)));
      marks = step(.52, pixelHash(uint(row).mul(1987).add(uint(segment).mul(7919)).add(uint(carrier))));
    } else if (family === 'rule' || family === 'interlace') {
      const segment = floor(pixel.x.div(family === 'rule' ? 157 : 61));
      const fieldRow = cellPixel.y.add(tick).mod(2);
      marks = fieldRow.mul(step(.4, pixelHash(uint(floor(cellPixel.y.div(4))).mul(1987).add(uint(segment).mul(7919)).add(uint(carrier)))));
    } else if (family === 'glyph') {
      const line = floor(cellPixel.y.div(8));
      marks = step(.62, pixelHash(uint(line).mul(4099).add(uint(floor(pixel.x.div(193))).mul(31)).add(uint(carrier)))).mul(step(1, pixel.y.mod(3)));
    } else if (family === 'scanhead') {
      const head = [control.x, control.y, control.z].reduce((sum: Scalar, h) => max(sum, step(abs(cellPixel.y.sub(floor(h.mul(dimensions.y)))), 1)), float(0));
      marks = max(step(.5, pixelHash(uint(row).mul(1987).add(uint(floor(pixel.x.div(127))).mul(7919)).add(uint(carrier)))), head);
    } else if (family === 'macroblock') {
      const size = floor(mix(13, 6, u.detail).add(.5));
      const id = floor(cellPixel.div(size));
      const phase = pixelHash(uint(id.x).mul(uint(97)).add(uint(id.y).mul(uint(7919))).add(uint(u.seed.mul(4099))));
      const epoch = mix(fast.x, fast.y, step(float(1).sub(phase), fast.z));
      marks = step(.9, pixelHash(uint(id.x).mul(uint(73)).add(uint(id.y).mul(uint(9151))).add(uint(epoch))));
    }
    const register = pixel.y.mod(3);
    const exposure = mix(1, mix(.58, .8, step(1, register)), marks.mul(float(1).sub(high.mul(.75))));
    const flatExposure = mix(.58, mix(.8, 1, step(.9, exposure)), step(.7, exposure));
    // Busy accumulators change almost everywhere; they need a higher afterimage
    // floor or the accent turns into dust.
    const busy = ['shellsort', 'rule', 'buoyancy', 'scanhead', 'interlace', 'glyph', 'larsen'].includes(family);
    const memory = smoothstep(busy ? .08 : .02, busy ? .4 : .23, state.g).mul(u.intensity).mul(.88).clamp(0, 1);
    return mix(pigment.mul(flatExposure), accent, step(threshold, memory)).max(vec3(0));
  })();

  // Fixed 60 Hz simulation. BA starts 128 frames before each 256-frame epoch
  // and becomes RG at the boundary; seeks rebuild at most 384 steps.
  const epochFrames = 256, primingFrames = 128;
  let frame = -1, epoch = -1, read = 0;
  const reset = () => { frame = -1; epoch = -1; };
  return {
    material,
    reset,
    resize(width: number, height: number) {
      screen.value.set(width, height);
      const ratio = Math.min(1, maxEdge / Math.max(width, height));
      const w = Math.max(2, Math.round(width * ratio)), h = Math.max(2, Math.round(height * ratio));
      dimensions.value.set(w, h);
      // The automaton's dependency cone must fit inside the priming window.
      rowStep.value = automatonRowStep(h);
      for (const target of targets) target.setSize(w, h);
      reset();
    },
    async compile(renderer: WebGPURenderer) {
      const saved = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(targets[1]);
        await renderer.compileAsync(quad, quad.camera);
      } finally { renderer.setRenderTarget(saved); }
    },
    advance(renderer: WebGPURenderer, time: number) {
      const seed = Math.round(u.seed.value / 60 * 65535);
      if (seed !== evolutionSeed) { evolutionSeed = seed; evolution = createMechanismEvolution(seed, family); }
      const wanted = Math.floor(time * u.speed.value * 60 + 1e-6);
      const nextEpoch = Math.floor(wanted / epochFrames);
      const restart = epoch < 0 || wanted < frame || wanted - frame > epochFrames;
      if (!restart && wanted === frame) return;
      const saved = renderer.getRenderTarget();
      try {
        if (restart) {
          epoch = nextEpoch; frame = epoch * epochFrames - primingFrames - 1;
          read = 0;
        }
        while (frame < wanted) {
          frame++;
          tick.value = ((frame % epochFrames) + epochFrames) % epochFrames;
          const score = evolution.sample(frame);
          carrier.value = score.carrier;
          drift.value.set(...score.drift); warp.value.set(...score.warp);
          slow.value.set(...score.slow); fast.value.set(...score.fast);
          control.value.set(...score.control); control2.value.set(...score.control2);
          score.events.forEach((event, i) => { events[i].a.value.set(...event.a); events[i].b.value.set(...event.b); });
          initialize.value = restart && frame === epoch * epochFrames - primingFrames ? 1 : 0;
          previous.value = targets[read].texture;
          renderer.setRenderTarget(targets[1 - read]);
          quad.render(renderer);
          read = 1 - read;
        }
        result.value = targets[read].texture;
      } finally { renderer.setRenderTarget(saved); }
    },
    dispose() { stepMaterial.dispose(); for (const target of targets) target.dispose(); },
    environment() { return { simulation: 'fixed 60 Hz feedback', display: 'flat pigments, stationary pixel coverage, mechanism-specific carrier', composition: family, evolution: 'absolute-frame controls and counter-addressed births; no animation loop', feedbackWidth: dimensions.value.x,
      feedbackHeight: dimensions.value.y, maxReplaySteps: epochFrames + primingFrames }; },
  };
}
