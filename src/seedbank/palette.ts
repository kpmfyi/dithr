import type { Node } from 'three/webgpu';
import { fract, mix, smoothstep, step, type uniform } from 'three/tsl';

type ColorUniform = ReturnType<typeof uniform<'vec3'>>;
/** Display-only pigment selection. Three colors return the original uniforms
 * without adding any operations to the established shader graph. Additional
 * inks follow the transported scalar field; coverage thresholds stay stationary.
 * Two colors share the accent/body ink while preserving the existing masks. */
export function pigmentRoles(colors: ColorUniform[], signal: Node<'float'>, threshold: Node<'float'>) {
  const [ground, accent] = colors;
  const ink = colors[2] ?? accent;
  if (colors.length <= 3) return [ground, accent, ink];
  const bodyBand = step(threshold, smoothstep(.42, .58, fract(signal.mul(3.17))));
  const body = mix(ink, colors[3], bodyBand);
  const trace = colors.length === 5
    ? mix(accent, colors[4], step(threshold, smoothstep(.42, .58, fract(signal.mul(5.13).add(.19)))))
    : accent;
  return [ground, trace, body];
}
