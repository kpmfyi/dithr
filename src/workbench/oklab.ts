/** OKLab / OKLCH helpers for palette design. Perceptual lightness and chroma
 * keep hue variants of one color structure looking like the same structure. */
const toLinear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const toGamma = (v: number) => v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055;
export const hexToRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

export function hexToOklab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .7936177850 * m - .0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .8086757660 * s];
}
function oklabToLinear(L: number, a: number, b: number) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.7076147010 * s];
}
/** Lightness 0–1, chroma, hue in degrees. */
export function hexToOklch(hex: string): [number, number, number] {
  const [L, a, b] = hexToOklab(hex);
  return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360];
}
const inGamut = (L: number, C: number, h: number) => oklabToLinear(L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)).every(v => v >= -1e-5 && v <= 1 + 1e-5);
/** Largest in-gamut sRGB chroma at a lightness and hue. */
export function maxChroma(L: number, h: number) {
  let lo = 0, hi = .37;
  for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (inGamut(L, mid, h)) lo = mid; else hi = mid; }
  return lo;
}
/** Converts OKLCH to hex. Out-of-gamut colors keep lightness and hue and lose chroma. */
export function oklchToHex(L: number, C: number, h: number) {
  const lightness = Math.max(0, Math.min(1, L));
  const chroma = Math.min(C, maxChroma(lightness, h));
  return '#' + oklabToLinear(lightness, chroma * Math.cos(h * Math.PI / 180), chroma * Math.sin(h * Math.PI / 180))
    .map(v => Math.round(Math.max(0, Math.min(1, toGamma(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('');
}
/** Perceptual distance (ΔE in OKLab, roughly 0–1). */
export function deltaE(a: string, b: string) {
  const x = hexToOklab(a), y = hexToOklab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
