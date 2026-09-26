import { hexToOklch, hexToRgb } from './oklab.ts';

const luminance = (hex: string) => { const c = hexToRgb(hex).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; };
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };
/** Interface tokens taken from the live palette. The chrome stays neutral gray;
 * the accent is the palette color that best combines chroma with legibility on
 * that gray, and text on the accent flips between near-white and near-black. */
export function paletteTheme(palette: readonly string[], chrome = '#262626') {
  const roles = [0, 1, 2, 3, 4].map(i => palette[i] ?? palette[[0, 1, 2, 2, 1][i]] ?? palette[1] ?? palette[0]);
  const score = (hex: string) => { const [, C] = hexToOklch(hex); return (C + .03) * Math.min(contrast(hex, chrome), 7); };
  const candidates = palette.length > 1 ? palette.slice(1) : palette;
  const accent = [...candidates].sort((a, b) => score(b) - score(a))[0];
  const second = [...palette].filter(c => c !== accent).sort((a, b) => score(b) - score(a))[0] ?? accent;
  const onAccent = contrast(accent, '#111111') >= contrast(accent, '#f5f5f5') ? '#111111' : '#f5f5f5';
  const legible = contrast(accent, chrome) >= 3 ? accent : luminance(accent) < luminance(chrome) ? '#d9d9d9' : accent;
  return { roles, accent, second, onAccent, accentText: legible };
}
