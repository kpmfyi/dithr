import { pigmentRoles } from './palette';
import { DataTexture, HalfFloatType, LinearFilter, NearestFilter, NoColorSpace, RepeatWrapping, RenderTarget, RGBAFormat, UnsignedByteType, Vector2, Vector4 } from 'three';
import { MeshBasicNodeMaterial, QuadMesh, type Node, type WebGPURenderer } from 'three/webgpu';
import { Fn, If, hash, uint, abs, float, floor, fract, max, min, mix, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import type { SynthesisFamily } from './recipes';
import { createSynthesisEvolution, synthesisLattice } from './synthesis-evolution';
type Scalar = Node<'float'>;
type Point = Node<'vec2'>;
type Inputs = { seed: ReturnType<typeof uniform<'float'>>; scale: ReturnType<typeof uniform<'float'>>;
  speed: ReturnType<typeof uniform<'float'>>; intensity: ReturnType<typeof uniform<'float'>>;
  detail: ReturnType<typeof uniform<'float'>>; aspect: ReturnType<typeof uniform<'float'>>;
  colors: ReturnType<typeof uniform<'vec3'>>[] };
/** Options are for controlled research ablations, not part of the recipe format.
 * RG = signal + activity. BA = independently primed next history. Activity
 * regulates transport/replenishment, so the visible traces also change the system. */
export function createSynthesis(u: Inputs, family: SynthesisFamily, options: { coupling?: number } = {}) {
  const coupling = float(options.coupling ?? 1);
  const lattice = new DataTexture(synthesisLattice(0), 128, 128, RGBAFormat, UnsignedByteType);
  lattice.minFilter = LinearFilter; lattice.magFilter = LinearFilter;
  lattice.wrapS = RepeatWrapping; lattice.wrapT = RepeatWrapping;
  lattice.colorSpace = NoColorSpace; lattice.generateMipmaps = false; lattice.needsUpdate = true;
  const fieldTexture = texture(lattice);
  const dimensions = uniform(new Vector2(384, 384)), screen = uniform(new Vector2(960, 640));
  const drift = uniform(new Vector4());
  const tick = uniform(0), initialize = uniform(1), carrier = uniform(0);
  const events = Array.from({ length: 4 }, () => ({ a: uniform(new Vector4()), b: uniform(new Vector4()) }));
  const targets = [0,1].map(() => new RenderTarget(384, 384, { minFilter: NearestFilter, magFilter: NearestFilter,
    depthBuffer: false, stencilBuffer: false, type: HalfFloatType, generateMipmaps: false, colorSpace: NoColorSpace }));
  const previous = texture(targets[0].texture), result = texture(targets[0].texture);
  const stepMaterial = new MeshBasicNodeMaterial();
  stepMaterial.depthTest = false; stepMaterial.depthWrite = false; stepMaterial.toneMapped = false;
  stepMaterial.fragmentNode = Fn(() => {
    const st = uv(), q = st.sub(.5).mul(vec2(u.aspect, 1)).mul(u.scale).toVar();
    // One bilinear RGBA read supplies four independent scalar fields.
    // Only the source is filtered; feedback and final marks remain nearest/pixel exact.
    const a = fieldTexture.sample(q.mul(.017).add(drift.xy.mul(.012)).add(.43)).toVar();
    const domain = q.add(a.rg.sub(.5).mul(1.8)).toVar();
    const b = a.barg;
    const density = mix(7, 23, u.detail);
    const tri = (x: Scalar) => abs(fract(x).sub(.5)).mul(2);
    const mass = float(.001).toVar(), deposit = float(0).toVar(), gust = vec2(0).toVar();
    for (const event of events) {
      const d = st.sub(event.a.xy).mul(vec2(u.aspect, 1)).mul(vec2(event.a.z, event.b.w));
      const metric = ['relay','countermarch','avalanche','grain-boundary'].includes(family) ? max(abs(d.x),abs(d.y)) : d.dot(d);
      const footprint = float(1).sub(smoothstep(.08, 1, metric)).mul(event.a.w).toVar();
      mass.addAssign(footprint); deposit.addAssign(footprint.mul(event.b.z)); gust.addAssign(event.b.xy.mul(footprint));
    }
    const local = deposit.div(mass).toVar();
    gust.divAssign(mass.add(.7));
    let cut: Scalar, body: Scalar, v: Point, w: Point, junction: Scalar;
    if (family === 'estuary') {
      const channel = abs(a.r.sub(b.g)).toVar();
      cut = tri(channel.mul(density.mul(2)).add(b.r.mul(4)));
      body = a.b.mul(.62).add(b.r.mul(.55));
      v = vec2(a.g.sub(.5).mul(5), 2.8).add(gust.mul(2));
      w = vec2(4, b.b.sub(.5).mul(-6)).mul(mix(-1,1,step(.5,a.a)));
      junction = smoothstep(.04,.22,channel);
    } else if (family === 'excitable') {
      const front = tri(a.r.mul(density.mul(.65)).add(b.b.mul(3)));
      cut = max(front, tri(domain.x.mul(4).add(b.g.mul(7))));
      body = b.r.mul(.58).add(a.b.mul(.46)).sub(.09);
      v = a.gb.sub(.5).mul(8).add(gust.mul(3)); w = vec2(v.y.negate(),v.x);
      junction = front;
    } else if (family === 'sgraffito') {
      const under = tri(b.r.mul(density).add(domain.y.mul(2)));
      const upper = tri(a.b.mul(density.mul(1.2)).sub(domain.x.mul(3)));
      cut = mix(under,upper,step(.48,b.b)); body = mix(a.r,b.g,step(.5,a.a));
      v = vec2(4,b.g.sub(.5).mul(4)).add(gust); w = vec2(b.r.sub(.5).mul(4),-3);
      junction = abs(under.sub(upper));
    }
    else if (family === 'relay') {
      const row = floor(q.y.mul(5).add(drift.y));
      const address = floor(q.x.mul(4).add(a.r.mul(5)).add(drift.x));
      const latch = hash(uint(abs(address)).add(uint(abs(row)).mul(1987)).add(uint(u.seed.mul(99))));
      cut = tri(q.x.mul(density).add(row.mul(.71))).mul(.7).add(tri(q.y.mul(density.mul(.63))).mul(.3));
      body = latch.mul(.7).add(b.r.mul(.45));
      v = vec2(mix(-4,4,step(.5,latch)),0); w = vec2(0,mix(-4,4,step(.5,a.g)));
      junction = step(.25,tri(q.y.mul(5).add(drift.y))).mul(step(.3,tri(q.x.mul(4).add(a.r.mul(5)))));
    } else if (family === 'slipstream') {
      const center = domain.add(drift.zw.mul(.32)), radius = center.length().add(.16);
      const bend = center.x.div(radius).add(a.g.mul(.8));
      cut = tri(radius.mul(density.mul(.7)).add(bend.mul(5)));
      body = a.r.mul(.6).add(b.b.mul(.55));
      v = vec2(center.y.negate(),center.x).div(radius).mul(4).add(gust);
      w = vec2(3.5,bend.mul(3)).add(gust);
      junction = smoothstep(.18,.85,abs(bend));
    } else if (family === 'grain-boundary') {
      // Unequal moving Manhattan domains; etched internal terraces meet at seams.
      const d0 = abs(domain.x.add(drift.x.mul(.4))).add(abs(domain.y.sub(.65)));
      const d1 = abs(domain.x.sub(.9)).mul(.8).add(abs(domain.y.add(drift.y.mul(.5))));
      const d2 = abs(domain.x.add(.8)).mul(1.2).add(abs(domain.y.add(.6)));
      const seam = min(abs(d0.sub(d1)),min(abs(d1.sub(d2)),abs(d2.sub(d0))));
      cut = tri(min(d0,min(d1,d2)).mul(density).add(b.r.mul(2)));
      body = mix(a.r,b.b,step(d0,d1));
      v = vec2(mix(-3,3,step(d0,d1)),2); w = vec2(1,mix(-4,4,step(d1,d2)));
      junction = float(1).sub(smoothstep(.02,.3,seam));
    } else if (family === 'countermarch') {
      const row = floor(q.y.mul(3.5).add(drift.y.mul(.35))), parity = row.mod(2);
      const skew = q.x.add(q.y.mul(mix(-.8,.8,parity))).add(a.r.mul(.35));
      cut = tri(skew.mul(density).add(b.r.mul(4)));
      body = tri(skew.mul(2.1).add(a.b.mul(2))).mul(.7).add(b.g.mul(.35));
      v = vec2(mix(-3,3,parity),0); w = vec2(v.x.negate(),mix(-1,1,step(.5,a.g)));
      junction = tri(q.y.mul(3.5).add(drift.y.mul(.35))).mul(.6).add(abs(a.g.sub(b.r)));
    } else if (family === 'overprint') {
      const x = domain.x.add(domain.y.mul(.43)), y = domain.y.sub(domain.x.mul(.27));
      const warpMesh = tri(x.mul(density.mul(.63)).add(b.g.mul(3)));
      const weftMesh = tri(y.mul(density.mul(.91)).add(a.b.mul(4)));
      cut = min(warpMesh,weftMesh); body = a.r.mul(.65).add(b.b.mul(.45));
      v = vec2(4,1).add(gust); w = vec2(-1,4).sub(gust);
      junction = abs(warpMesh.sub(weftMesh));
    } else if (family === 'avalanche') {
      const terrace = floor(domain.y.mul(4).add(a.r.mul(3)));
      const slope = domain.x.add(terrace.mul(.29)).add(b.g.mul(.6));
      cut = tri(slope.mul(density)).mul(.7).add(tri(domain.y.mul(density)).mul(.3));
      body = tri(slope.mul(2.3)).mul(.55).add(a.b.mul(.5));
      v = vec2(0); w = vec2(mix(-3,3,step(.5,b.r)),4);
      junction = tri(domain.y.mul(4).add(a.r.mul(3)));
    } else {
      const center = domain.sub(drift.xy.mul(.22)), r = center.length().add(.18);
      const lobes = center.x.mul(center.y).div(r.mul(r)).mul(3).add(b.g);
      cut = tri(r.mul(density.mul(.75)).add(lobes.mul(5)));
      body = tri(r.mul(1.2).add(a.r)).mul(.65).add(b.b.mul(.45));
      v = vec2(center.y.negate(),center.x).div(r).mul(4); w = center.div(r).mul(4).add(gust.mul(2));
      junction = abs(lobes).clamp(0,1);
    }
    const etched = cut.toVar(), gate = junction.toVar();
    const source = body.sub(.5).mul(2.6).add(.5).add(etched.sub(.5).mul(1.25)).add(mass.clamp(0,1).mul(local.sub(.5)).mul(.45)).toVar();
    const boundary = float(1).sub(step(.5,tick.mod(256)));
    const bounded = (p: Point) => p.clamp(vec2(.5).div(dimensions),vec2(1).sub(vec2(.5).div(dimensions)));
    const aRead = previous.sample(bounded(st.sub(floor(v.add(.5)).div(dimensions)))).toVar();
    const bRead = previous.sample(bounded(st.sub(floor(w.add(.5)).div(dimensions)))).toVar();
    const flowA = mix(aRead,aRead.zwzw,boundary).toVar(), flowB = mix(bRead,bRead.zwzw,boundary).toVar();
    const evolve = (state: Point, first: Point, second: Point) => {
      const activity = state.y.mul(5).clamp(0,1).mul(coupling).toVar();
      let routed: Scalar, target: Scalar, feed: Scalar;
      if (family === 'estuary') {
        // Sediment memory diverts crossing flows instead of merely tinting their wake.
        routed = mix(first.x,second.x,activity.mul(gate));
        target = mix(source,local.mul(1.5).sub(.25).add(etched.sub(.5)),mass.clamp(0,1).mul(.35));
        feed = float(.27).sub(activity.mul(.13));
      } else if (family === 'excitable') {
        // Neighbor excitation needs a recovered site; the same activity inhibits
        // re-excitation, producing refractory scars rather than additive rings.
        const trigger = smoothstep(.52,.85,max(first.x,second.x)).mul(float(1).sub(activity));
        routed = mix(first.x,second.x,gate.mul(.65));
        target = source.add(trigger.mul(.42)).sub(activity.mul(.55)).add(mass.mul(local.sub(.5)).mul(.35));
        feed = float(.29);
      } else if (family === 'sgraffito') {
        // Moving abrasions expose an underlayer; surviving scars resist overprint.
        routed = mix(first.x,second.x,smoothstep(.13,.65,gate).mul(activity));
        target = mix(source,float(1).sub(source).add(etched.sub(.5)),activity.mul(gate).mul(.85));
        feed = float(.19).add(mass.clamp(0,1).mul(.14));
      }
      else if (family === 'relay') {
        const latch = smoothstep(.35,.65,state.x.add(activity.mul(.35)));
        routed = mix(first.x,second.x,latch.mul(gate));
        target = source.add(mass.mul(local.sub(.5)).mul(.6)); feed = float(.25).sub(activity.mul(.1));
      } else if (family === 'slipstream') {
        const capture = smoothstep(.03,.18,abs(first.x.sub(second.x))).mul(activity);
        routed = mix(first.x,second.x,capture.mul(gate));
        target = source.add(first.x.sub(second.x).mul(activity).mul(.45)); feed = float(.25);
      } else if (family === 'grain-boundary') {
        const jam = gate.mul(activity);
        routed = mix(first.x,min(first.x,second.x),jam);
        target = source.add(jam.mul(etched.sub(.5)).mul(1.8)); feed = float(.26).sub(jam.mul(.1));
      } else if (family === 'countermarch') {
        const collision = abs(first.x.sub(second.x)).mul(activity).mul(.85).clamp(0,1);
        routed = mix(first.x,second.x,collision.mul(smoothstep(.35,.75,gate)));
        target = source.add(collision.mul(gate.sub(.4))); feed = float(.36);
      } else if (family === 'overprint') {
        const registration = smoothstep(.15,.8,gate.add(activity.mul(.45)));
        routed = mix(first.x,second.x,registration);
        target = mix(source,source.add(etched.sub(.5).mul(1.8)),activity);
        feed = float(.28).sub(activity.mul(.09));
      } else if (family === 'avalanche') {
        const release = smoothstep(.15,.5,second.x.sub(first.x).add(activity.mul(.85)));
        routed = mix(state.x,mix(first.x,second.x,gate),release);
        target = source.add(mass.mul(local.sub(.5)).mul(.5)); feed = float(.25).sub(activity.mul(.08));
      } else {
        const eject = smoothstep(.2,.7,activity.mul(gate).add(abs(first.x.sub(second.x)).mul(.4)));
        routed = mix(first.x,second.x,eject);
        target = source.add(eject.mul(etched.sub(.5)).mul(1.5)); feed = float(.27);
      }
      const history = mix(state.x,routed,.73);
      const signal = mix(history,target,feed).sub(.5).mul(1.025).add(.5).clamp(0,1).toVar();
      const echo = mix(mix(state.y,mix(first.y,second.y,.3),.25),abs(signal.sub(state.x)),.075).clamp(0,1);
      return vec2(signal,echo);
    };
    // Material memory travels with the primary current. Two packed history reads
    // supply both histories and both routing choices; no center sample is needed.
    const main = evolve(flowA.rg,flowA.rg,flowB.rg), shadow = vec2(0).toVar();
    // The next history is needed only during its 128-step priming window.
    // Skipping its first half-epoch preserves RG output while saving its ALU work.
    If(tick.greaterThanEqual(128), () => { shadow.assign(evolve(flowA.ba,flowA.ba,flowB.ba)); });
    const prime = max(initialize,float(1).sub(step(.5,abs(tick.mod(256).sub(128)))));
    return vec4(mix(main,vec2(source.clamp(0,1),0),initialize),mix(shadow,vec2(source.clamp(0,1),0),prime));
  })();
  const quad = new QuadMesh(stepMaterial), material = new MeshBasicNodeMaterial();
  material.depthTest = false; material.depthWrite = false; material.toneMapped = false;
  material.colorNode = Fn(() => {
    const pixel = floor(uv().mul(screen)), st = pixel.add(.5).div(screen);
    const state = result.sample(st).toVar();
    const threshold = hash(uint(pixel.x).add(uint(pixel.y).mul(65537)).add(uint(u.seed.mul(65535)))).toVar();
    const [paper,accent,ink] = pigmentRoles(u.colors, state.r, threshold);
    const pigmentLevel = state.r.add(u.intensity.sub(1.1).mul(.09));
    const high = step(threshold,smoothstep(.62,.66,pigmentLevel));
    const middle = step(fract(threshold.add(.37)),smoothstep(.19,.23,pigmentLevel)).mul(float(1).sub(high));
    const pigment = mix(mix(paper,paper.mul(.28),middle),ink,high);
    const row = floor(pixel.y.div(2)), cell = floor(pixel.x.div(family === 'estuary' ? 127 : family === 'excitable' ? 41 : 83));
    const flicker = hash(uint(row).mul(1987).add(uint(cell).mul(7919)).add(uint(carrier)));
    const marks = step(.55,flicker).mul(step(.035,state.g));
    const exposure = mix(1,mix(.65,.83,step(1,pixel.y.mod(3))),marks);
    // Activity exposes engraved bands of the carried signal. A high activity
    // envelope cannot flood the whole frame with accent and hide its structure.
    const traceCuts = abs(fract(state.r.mul(mix(5,11,u.detail))).sub(.5)).mul(2);
    // Avalanche's slow exchange can leave its legacy accent absent for whole
    // frames. Expanded palettes expose the same memory cuts at lower activity
    // so colors two and five remain useful; preserve the three-color threshold.
    const expandedAvalanche = family === 'avalanche' && u.colors.length >= 4;
    const coverage = smoothstep(expandedAvalanche ? .02 : .09, expandedAvalanche ? .035 : .105, state.g.mul(u.intensity)).mul(smoothstep(.38,.48,traceCuts));
    return mix(pigment.mul(exposure),accent,step(threshold,coverage)).max(vec3(0));
  })();
  const epochFrames = 256, primingFrames = 128;
  let frame = -1, epoch = -1, read = 0, evolutionSeed = -1;
  let evolution = createSynthesisEvolution(0);
  const reset = () => { frame = -1; epoch = -1; };
  return { material, reset,
    resize(width: number,height: number) {
      screen.value.set(width,height);
      const ratio = Math.min(1,384/Math.max(width,height)), w = Math.max(2,Math.round(width*ratio)), h = Math.max(2,Math.round(height*ratio));
      dimensions.value.set(w,h); for (const target of targets) target.setSize(w,h); reset();
    },
    async compile(renderer: WebGPURenderer) {
      const saved = renderer.getRenderTarget();
      try { renderer.setRenderTarget(targets[1]); await renderer.compileAsync(quad,quad.camera); }
      finally { renderer.setRenderTarget(saved); }
    },
    advance(renderer: WebGPURenderer,time: number) {
      const seed = Math.round(u.seed.value/60*65535);
      if (seed !== evolutionSeed) {
        evolutionSeed = seed; evolution = createSynthesisEvolution(seed);
        lattice.image.data!.set(synthesisLattice(seed)); lattice.needsUpdate = true;
      }
      const wanted = Math.floor(time*u.speed.value*60+1e-6), nextEpoch = Math.floor(wanted/epochFrames);
      const restart = epoch<0 || wanted<frame || wanted-frame>epochFrames;
      if (!restart && wanted===frame) return;
      const saved = renderer.getRenderTarget();
      const savedAutoClear = renderer.autoClear;
      // Every step overwrites all four channels across the full target. Clearing
      // the same color buffer first adds a redundant write and synchronization.
      renderer.autoClear = false;
      try {
        if (restart) { epoch=nextEpoch; frame=epoch*epochFrames-primingFrames-1; read=0; }
        while (frame<wanted) {
          frame++; tick.value = ((frame%epochFrames)+epochFrames)%epochFrames;
          const score = evolution.sample(frame/60);
          drift.value.fromArray(score.drift); carrier.value = score.carrier;
          for (let i=0;i<4;i++) { events[i].a.value.fromArray(score.events[i].a); events[i].b.value.fromArray(score.events[i].b); }
          initialize.value = restart && frame===epoch*epochFrames-primingFrames ? 1 : 0;
          previous.value = targets[read].texture; renderer.setRenderTarget(targets[1-read]); quad.render(renderer); read=1-read;
        }
        result.value = targets[read].texture;
      } finally { renderer.setRenderTarget(saved); renderer.autoClear = savedAutoClear; }
    },
    dispose() { stepMaterial.dispose(); lattice.dispose(); for (const target of targets) target.dispose(); },
    environment() { return { simulation: 'fixed 60 Hz feedback', composition: family,
      display: 'flat pigments, memory-gated row exposure, stationary PCG coverage',
      evolution: 'absolute-time events and cached random targets; no playback tape',
      feedbackWidth: dimensions.value.x, feedbackHeight: dimensions.value.y, fieldBytes: 128*128*4,
      coupling: options.coupling ?? 1, maxReplaySteps: epochFrames+primingFrames }; },
  };
}
