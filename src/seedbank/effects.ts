import { createMechanism } from './mechanism';
import { createPattern } from './pattern';
import { createRaster } from './raster';
import { createMatter } from './matter';
import { createSynthesis } from './synthesis';
import { createIntricacy } from './intricacy';
import { createEntropy } from './entropy';
import { createDamage } from './damage';
import { Color, Vector3 } from 'three';
import { MeshBasicNodeMaterial, type Node } from 'three/webgpu';
import { Fn, abs, cos, exp, float, floor, fract, fwidth, length, max, min, mix, sin, smoothstep, uniform, uv, vec2, vec3 } from 'three/tsl';
import { isPattern, isRaster, isMatter, isMechanism, isSynthesis, isPixelSorter, isDeparture, isDamage, isEntropy, isIntricacy, type Recipe } from './recipes';
import { additionalColor } from './additional-effects';
import { createDeparture } from './departures';
import { createPixelSorter } from './pixel-sorters';
import { createBrokenLcd } from './broken-lcd';

/** Original TSL graphs. Time and seed are inputs, never implicit globals. */
export function createEffect(recipe: Recipe) {
  const u = {
    time: uniform(recipe.time), seed: uniform(recipe.seed / 65535 * 60),
    scale: uniform(recipe.parameters.scale), speed: uniform(recipe.parameters.speed),
    intensity: uniform(recipe.parameters.intensity), detail: uniform(recipe.parameters.detail),
    aspect: uniform(1), colors: recipe.palette.map(hex => { const c = new Color(hex); return uniform(new Vector3(c.r, c.g, c.b)); }),
  };
  const feedback = isPattern(recipe.family) ? createPattern(u, recipe.family) : isRaster(recipe.family) ? createRaster(u, recipe.family) : isMatter(recipe.family) ? createMatter(u, recipe.family) : isMechanism(recipe.family) ? createMechanism(u, recipe.family) : isSynthesis(recipe.family) ? createSynthesis(u, recipe.family) : recipe.family === 'broken-lcd' ? createBrokenLcd(u) : isPixelSorter(recipe.family) ? createPixelSorter(u, recipe.family) : isDeparture(recipe.family) ? createDeparture(u, recipe.family) : isDamage(recipe.family) ? createDamage(u, recipe.family) : isEntropy(recipe.family) ? createEntropy(u, recipe.family) : isIntricacy(recipe.family) ? createIntricacy(u, recipe.family) : undefined;
  const material = feedback?.material ?? new MeshBasicNodeMaterial();
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  if (!feedback) material.colorNode = Fn(() => {
    const p = uv().sub(0.5).mul(vec2(u.aspect, 1));
    const t = u.time.mul(u.speed);
    const s = u.seed;
    // In expanded palettes, evaluate the existing graph as three pigment
    // weights. This decouples geometry from the user's chosen RGB values.
    const [paper, mid, light] = recipe.palette.length === 3 ? u.colors : [vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)];
    if (recipe.family === 'caustics') {
      const q = p.mul(u.scale).add(vec2(s, s.mul(0.71))).toVar();
      q.addAssign(vec2(sin(q.y.mul(1.7).add(t.mul(0.7))), cos(q.x.mul(1.3).sub(t.mul(0.6)))).mul(0.48));
      q.addAssign(vec2(cos(q.y.mul(2.3).sub(t.mul(0.5))), sin(q.x.mul(2).add(t.mul(0.8)))).mul(0.22));
      // Intersecting interference fields form moving, focused caustic ridges.
      const a = sin(q.x.mul(2.8).add(sin(q.y.mul(2.1).add(t))).add(t.mul(0.45)));
      const b = cos(q.y.mul(2.7).add(sin(q.x.mul(1.8).sub(t.mul(0.65)))));
      const field = abs(a.add(b).mul(0.5));
      const focus = mix(6, 28, u.detail);
      const ridge = exp(field.mul(focus).negate());
      const echo = exp(abs(a.sub(b).mul(0.5)).mul(focus.mul(0.65)).negate()).mul(0.28);
      const depth = sin(q.x.add(q.y).mul(0.7).add(t.mul(0.2))).mul(0.12).add(0.2);
      const color = mix(paper, mid, depth.add(ridge.mul(0.45)));
      const vignette = float(1).sub(length(p.mul(0.6)).mul(0.38)).max(0.3);
      return color.add(light.mul(ridge.add(echo).pow(1.4)).mul(u.intensity).mul(0.7)).mul(vignette);
    }
    if (recipe.family === 'phosphor') {
      const barrel = p.mul(float(1).add(p.dot(p).mul(0.14)));
      const x = barrel.x.mul(u.scale);
      const wave = sin(x.mul(3).add(t.mul(1.4)).add(s)).mul(0.14)
        .add(sin(x.mul(7.1).sub(t.mul(0.9))).mul(0.055));
      const distance = abs(barrel.y.sub(wave));
      const trace = exp(distance.mul(-160)).mul(1.6).add(exp(distance.mul(-25)).mul(0.2));
      const ghost = exp(abs(barrel.y.add(wave.mul(0.6)).add(0.13)).mul(-75)).mul(0.25);
      const gridUV = fract(barrel.mul(vec2(14, 10)).add(0.5));
      const grid = float(1).sub(smoothstep(0.013, 0.024, min(gridUV.x, gridUV.y))).mul(0.045);
      const scan = float(1).sub(sin(uv().y.mul(1100)).pow(2).mul(u.detail).mul(0.45));
      const refresh = exp(fract(uv().y.add(t.mul(0.22))).mul(-14)).mul(0.16).add(0.85);
      const grille = sin(uv().x.mul(1900)).mul(0.06).add(0.94);
      const edge = float(1).sub(smoothstep(0.42, 0.52, max(abs(barrel.x.div(u.aspect)), abs(barrel.y))));
      const color = vec3(paper).add(mid.mul(grid.add(ghost))).add(light.mul(trace).mul(u.intensity));
      return color.mul(scan).mul(refresh).mul(grille).mul(edge);
    }
    if (recipe.family !== 'halftone') return additionalColor(recipe.family, p, t, s, u.scale, u.intensity, u.detail, [paper, mid, light]);
    // A procedural ink field sampled at screen centers, rather than per pixel,
    // keeps each dot a clean circle as the underlying field breathes.
    const angle = float(0.36);
    const rotated = vec2(p.x.mul(cos(angle)).sub(p.y.mul(sin(angle))), p.x.mul(sin(angle)).add(p.y.mul(cos(angle))));
    const cells = rotated.mul(u.scale.mul(9));
    const center = floor(cells).add(0.5).div(u.scale.mul(9));
    const field = sin(center.x.mul(7).add(t).add(s)).mul(cos(center.y.mul(6).sub(t.mul(0.7))))
      .add(sin(length(center.add(vec2(0.25, -0.12))).mul(14).sub(t.mul(1.2))).mul(0.4));
    const tone = field.mul(0.3).add(0.42).mul(u.intensity).clamp(0.04, 0.96);
    const radius = tone.sqrt().mul(0.55);
    const d = length(fract(cells).sub(0.5));
    const aa = fwidth(d).max(0.008);
    const ink = float(1).sub(smoothstep(radius.sub(aa), radius.add(aa), d));
    const other = cells.add(vec2(u.detail.mul(1.8), u.detail.mul(0.7)));
    const d2 = length(fract(other).sub(0.5));
    const radius2 = float(0.65).sub(tone.mul(0.5)).max(0.05);
    const ink2 = float(1).sub(smoothstep(radius2.sub(aa), radius2.add(aa), d2));
    const grain = fract(sin(floor(uv().x.mul(1400)).mul(12.9898).add(floor(uv().y.mul(1000)).mul(78.233)).add(s)).mul(43758.5453)).mul(0.04);
    return mix(mix(paper, mid, ink2.mul(0.85)), light, ink.mul(0.92)).mul(float(1).sub(grain));
  })();
  if (!feedback && recipe.palette.length !== 3) {
    // The archived effects keep smooth lighting. Additional pigments share
    // the original middle and highlight weights; no extra geometry or clock.
    const original = material.colorNode as Node<'vec3'>;
    material.colorNode = Fn(() => {
      const weights = original.max(0).toVar();
      const middle = u.colors.length >= 4 ? mix(u.colors[1], u.colors[3], weights.y.div(weights.y.add(.15))) : u.colors[1];
      const highlight = u.colors.length === 5 ? mix(u.colors[2], u.colors[4], weights.z.div(weights.z.add(.15))) : u.colors[2] ?? u.colors[1];
      return u.colors[0].mul(weights.x).add(middle.mul(weights.y)).add(highlight.mul(weights.z));
    })();
  }
  return {
    material, uniforms: u, feedback,
    update(next: Recipe) {
      // Palette edits affect only display uniforms. Keep the transported field
      // intact instead of replaying feedback while the user drags a color picker.
      const simulationChanged = u.seed.value !== next.seed / 65535 * 60 ||
        (['scale', 'speed', 'intensity', 'detail'] as const).some(key => u[key].value !== next.parameters[key]);
      if (simulationChanged) feedback?.reset();
      u.seed.value = next.seed / 65535 * 60;
      for (const key of ['scale', 'speed', 'intensity', 'detail'] as const) u[key].value = next.parameters[key];
      next.palette.forEach((hex, i) => { const c = new Color(hex); u.colors[i].value.set(c.r, c.g, c.b); });
    },
  };
}
