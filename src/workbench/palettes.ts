import type { Recipe, PaletteSize } from '../seedbank/recipes.ts';
import { moodPalettes } from './mood-palettes.ts';
import { curatedPalettes } from './curated-palettes.ts';
import { studioPalettes } from './studio-palettes.ts';
import { logicPalettes } from './logic-palettes.ts';
import { deltaE, hexToOklch, hexToRgb, maxChroma, oklchToHex } from './oklab.ts';

export const paletteCollections = [
  { id: 'signature', name: 'Signatures' },
  { id: 'electric', name: 'Electric' },
  { id: 'print', name: 'Paper & ink' },
  { id: 'night', name: 'Night' },
  { id: 'earth', name: 'Earth & mineral' },
  { id: 'pastel', name: 'Pastel' },
  { id: 'duotone', name: 'Duotone' },
  { id: 'industrial', name: 'Industrial' },
  { id: 'experimental', name: 'Experimental' },
  { id: 'signal', name: 'Signal' },
  { id: 'bitmap', name: 'Bitmap' },
  { id: 'midtone', name: 'Midtone' },
  { id: 'mood', name: 'Mood' },
  { id: 'hours', name: 'Hours' },
  { id: 'weather', name: 'Weather' },
  { id: 'cinema', name: 'Cinema' },
  { id: 'genre', name: 'Genre' },
  { id: 'machines', name: 'Machines' },
  { id: 'movements', name: 'Movements' },
  { id: 'materials', name: 'Materials' },
  { id: 'now', name: 'Now' },
  { id: 'glitch', name: 'Glitch' },
  { id: 'circuits', name: 'Circuits' },
  { id: 'signage', name: 'Signage' },
  { id: 'maps', name: 'Cartography' },
] as const;
export type PaletteCollection = typeof paletteCollections[number]['id'];
export type FiveColors = [string, string, string, string, string];
export type PalettePreset = { id: string; name: string; collection: PaletteCollection; colors: FiveColors };

/* Generated structures are authored in OKLCH, role by role: [hue offset from the
 * anchor (degrees), chroma relative to the sRGB maximum at that lightness and
 * hue, perceptual lightness]. Roles follow the display order used everywhere:
 * ground, accent, ink, body, trace. Relative chroma keeps each structure's
 * vividness consistent around the wheel without clipping, and perceptual
 * lightness keeps its value pattern, so the 18 hue variants of one structure
 * read as the same idea. The previous HSL generator spent a third of its anchors
 * on near-identical greens, gave yellows and blues very different weights and
 * filled roles four and five by farthest-point search, which often chose muddy
 * extremes. */
type Role = readonly [number, number, number];
type Template = { name: string; collection: Exclude<PaletteCollection, 'signature' | 'mood' | 'hours' | 'weather' | 'cinema' | 'genre' | 'machines' | 'movements' | 'materials' | 'now' | 'glitch' | 'circuits' | 'signage' | 'maps'>; roles: readonly [Role, Role, Role, Role, Role] };
const templates: Template[] = [
  { name: 'Voltage', collection: 'electric', roles: [[180, .35, .17], [0, .95, .64], [140, .8, .91], [0, .78, .42], [-45, .9, .79]] },
  { name: 'Arc', collection: 'electric', roles: [[0, .72, .58], [180, .7, .88], [0, .55, .2], [180, .85, .5], [60, .85, .8]] },
  { name: 'Neon', collection: 'electric', roles: [[60, .1, .965], [0, .98, .6], [125, .95, .5], [0, .8, .33], [-60, .9, .72]] },
  { name: 'Interference', collection: 'electric', roles: [[0, .55, .15], [150, .95, .8], [270, .9, .62], [210, .8, .45], [60, .95, .9]] },
  { name: 'Risograph', collection: 'print', roles: [[80, .14, .955], [0, .92, .64], [190, .55, .3], [220, .85, .52], [60, .9, .83]] },
  { name: 'Overprint', collection: 'print', roles: [[30, .08, .93], [20, .6, .64], [200, .6, .28], [200, .5, .52], [20, .9, .8]] },
  { name: 'Carbon', collection: 'print', roles: [[70, .05, .97], [0, .95, .56], [40, .25, .2], [40, .2, .43], [0, .75, .77]] },
  { name: 'Edition', collection: 'print', roles: [[180, .45, .41], [0, .8, .64], [60, .45, .94], [180, .5, .21], [30, .85, .82]] },
  { name: 'Afterhours', collection: 'night', roles: [[0, .3, .11], [40, .78, .6], [180, .8, .88], [40, .6, .34], [180, .9, .66]] },
  { name: 'Nocturne', collection: 'night', roles: [[210, .4, .19], [0, .62, .72], [40, .25, .93], [210, .45, .44], [0, .82, .56]] },
  { name: 'Blacklight', collection: 'night', roles: [[0, .45, .11], [100, .95, .82], [270, .8, .76], [270, .85, .45], [180, .9, .62]] },
  { name: 'Ember', collection: 'night', roles: [[20, .62, .5], [0, .4, .13], [60, .6, .92], [0, .7, .32], [40, .9, .76]] },
  { name: 'Sediment', collection: 'earth', roles: [[50, .25, .91], [0, .45, .53], [60, .3, .24], [30, .35, .75], [150, .45, .42]] },
  { name: 'Patina', collection: 'earth', roles: [[150, .38, .44], [0, .5, .66], [40, .3, .92], [150, .4, .23], [20, .55, .8]] },
  { name: 'Terrace', collection: 'earth', roles: [[40, .15, .925], [140, .42, .52], [20, .5, .32], [140, .35, .74], [60, .55, .68]] },
  { name: 'Shale', collection: 'earth', roles: [[0, .15, .25], [210, .28, .66], [40, .4, .87], [210, .22, .46], [40, .6, .64]] },
  { name: 'Chalk', collection: 'pastel', roles: [[40, .22, .965], [0, .6, .74], [200, .35, .36], [200, .35, .66], [80, .7, .82]] },
  { name: 'Sherbet', collection: 'pastel', roles: [[0, .42, .89], [120, .7, .74], [260, .45, .31], [0, .62, .7], [200, .5, .79]] },
  { name: 'Porcelain', collection: 'pastel', roles: [[200, .18, .945], [0, .6, .64], [10, .4, .29], [200, .45, .58], [40, .6, .8]] },
  { name: 'Velvet', collection: 'pastel', roles: [[0, .3, .23], [30, .55, .81], [170, .45, .91], [0, .45, .46], [300, .5, .74]] },
  { name: 'Tonal', collection: 'duotone', roles: [[0, .5, .17], [0, .85, .6], [0, .35, .94], [0, .65, .39], [0, .6, .79]] },
  { name: 'Wash', collection: 'duotone', roles: [[0, .18, .955], [10, .5, .67], [0, .6, .26], [0, .45, .46], [10, .45, .83]] },
  { name: 'Negative', collection: 'duotone', roles: [[0, .7, .55], [0, .4, .15], [350, .3, .94], [0, .7, .35], [0, .55, .78]] },
  { name: 'Silverplate', collection: 'duotone', roles: [[0, .3, .16], [0, .42, .58], [180, .16, .95], [0, .26, .37], [180, .38, .78]] },
  { name: 'Hazard', collection: 'industrial', roles: [[0, .03, .91], [0, .95, .6], [0, .04, .17], [0, .05, .52], [40, .95, .8]] },
  { name: 'Alloy', collection: 'industrial', roles: [[0, .06, .2], [0, .72, .56], [180, .1, .86], [180, .08, .46], [0, .6, .74]] },
  { name: 'Blueprint', collection: 'industrial', roles: [[0, .62, .43], [0, .42, .72], [40, .12, .955], [0, .5, .2], [180, .6, .83]] },
  { name: 'Terminal', collection: 'industrial', roles: [[0, .1, .11], [0, .85, .8], [180, .3, .56], [0, .6, .42], [-60, .75, .64]] },
  { name: 'Clash', collection: 'experimental', roles: [[0, .75, .6], [120, .7, .22], [240, .8, .87], [240, .85, .5], [60, .95, .85]] },
  { name: 'Solarize', collection: 'experimental', roles: [[150, .45, .91], [0, .9, .4], [280, .95, .58], [60, .8, .72], [200, .8, .62]] },
  { name: 'Mutant', collection: 'experimental', roles: [[0, .5, .2], [75, .9, .74], [210, .7, .82], [140, .75, .52], [300, .8, .66]] },
  { name: 'Collision', collection: 'experimental', roles: [[220, .6, .55], [0, .8, .78], [110, .5, .16], [0, .8, .44], [60, .9, .91]] },
  /* Added with the logic studies. Signal is the benchmark look in 18 hues: pale
   * stock, one electric accent, a dark ink and a bright complementary trace.
   * Bitmap is the limited, high-contrast register of early colour graphics on a
   * dark field. Midtone puts a mid-lightness ground under light and dark inks. */
  { name: 'Stock', collection: 'signal', roles: [[60, .06, .955], [0, .95, .6], [200, .25, .2], [0, .2, .55], [180, .9, .82]] },
  { name: 'Latch', collection: 'signal', roles: [[200, .08, .94], [0, .9, .55], [0, .5, .25], [120, .6, .7], [-120, .8, .82]] },
  { name: 'Sync', collection: 'signal', roles: [[0, .12, .93], [180, .95, .62], [0, .6, .28], [180, .35, .48], [60, .9, .85]] },
  { name: 'Tear', collection: 'signal', roles: [[30, .05, .965], [0, .98, .5], [0, .1, .15], [-30, .7, .78], [150, .85, .68]] },
  { name: 'Plane', collection: 'bitmap', roles: [[0, .3, .12], [0, .95, .62], [180, .2, .93], [0, .55, .38], [120, .9, .78]] },
  { name: 'Mask', collection: 'bitmap', roles: [[200, .35, .17], [60, .95, .75], [0, .1, .97], [0, .8, .5], [-60, .85, .68]] },
  { name: 'Sprite', collection: 'bitmap', roles: [[0, .15, .1], [0, .9, .68], [0, .35, .9], [150, .8, .5], [-150, .85, .8]] },
  { name: 'Raster', collection: 'bitmap', roles: [[0, .55, .22], [0, .9, .7], [40, .15, .95], [180, .75, .55], [180, .6, .85]] },
  { name: 'Slab', collection: 'midtone', roles: [[0, .35, .55], [180, .85, .8], [0, .4, .16], [0, .5, .35], [60, .6, .92]] },
  { name: 'Plaster', collection: 'midtone', roles: [[30, .12, .68], [0, .9, .48], [0, .3, .2], [200, .35, .45], [0, .2, .95]] },
  { name: 'Bloc', collection: 'midtone', roles: [[0, .5, .48], [120, .8, .8], [0, .1, .1], [240, .6, .3], [0, .3, .93]] },
  { name: 'Tarmac', collection: 'midtone', roles: [[0, .08, .42], [0, .95, .7], [0, .05, .95], [0, .1, .22], [180, .7, .8]] },
];
/** Eighteen anchors spaced evenly (20°) around the OKLCH hue circle. */
const hues: readonly (readonly [string, number])[] = [['Rose', 5], ['Scarlet', 25], ['Copper', 45], ['Amber', 65], ['Marigold', 85], ['Citron', 105], ['Lime', 125], ['Fern', 145], ['Jade', 165], ['Lagoon', 185], ['Cyan', 205], ['Glacier', 225], ['Azure', 245], ['Cobalt', 265], ['Iris', 285], ['Violet', 305], ['Orchid', 325], ['Magenta', 345]];

function luminance(hex: string): number {
  const c = hexToRgb(hex).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
/** Separation checks for shader colors, not a text accessibility certification.
 * minDeltaE is the smallest perceptual (OKLab) distance between any two colors. */
export function paletteQuality(colors: readonly string[]) {
  const light = colors.map(luminance);
  const pairs = colors.flatMap((a, i) => colors.slice(i + 1).map(b => [a, b] as const));
  const minDistance = Math.min(...pairs.map(([a, b]) => Math.hypot(...hexToRgb(a).map((v, i) => v - hexToRgb(b)[i]))));
  const minDeltaE = Math.min(...pairs.map(([a, b]) => deltaE(a, b)));
  return { contrast: (Math.max(...light) + .05) / (Math.min(...light) + .05), minDistance, minDeltaE };
}
function makeColors(template: Template, hue: number): FiveColors {
  const roles = template.roles.map(role => [...role]);
  const make = () => roles.map(([offset, relative, L]) => { const h = (hue + offset + 360) % 360; return oklchToHex(L, relative * maxChroma(L, h), h); }) as FiveColors;
  let colors = make();
  // Keep a 5:1 luminance range: deepen the darkest role, then lift the lightest.
  for (let pass = 0; paletteQuality(colors).contrast < 5 && pass < 16; pass++) {
    const light = colors.map(luminance), dark = light.indexOf(Math.min(...light)), bright = light.indexOf(Math.max(...light));
    roles[dark][2] *= .93;
    if (pass % 2) roles[bright][2] = Math.min(.985, roles[bright][2] + .012);
    colors = make();
  }
  return colors;
}
/** The first three colors of each signature are the original catalog triplets;
 * body and trace are authored to extend them. */
const signatures: { id: string; name: string; colors: FiveColors }[] = [
  { id: 'electric-paper', name: 'Electric paper', colors: ['#eeeae0', '#0757ff', '#ceff39', '#16204a', '#ff5c8a'] },
  { id: 'orchid-acid', name: 'Orchid / acid', colors: ['#f2efdf', '#b84be8', '#d4ef35', '#2b1740', '#ff8a5c'] },
  { id: 'hot-press', name: 'Hot press', colors: ['#ece3d0', '#ff4b2e', '#1b2432', '#2f5d8a', '#f2b134'] },
  { id: 'night-signal', name: 'Night signal', colors: ['#14152e', '#ed5479', '#b9f76b', '#3b3f8f', '#8fe3ff'] },
  { id: 'oxidized', name: 'Oxidized', colors: ['#092e35', '#ed7859', '#e9e4c8', '#1f6f6a', '#f2c14e'] },
  { id: 'cobalt-cream', name: 'Cobalt / cream', colors: ['#16243d', '#3163ed', '#ffedbb', '#8fb8ff', '#ff7a59'] },
  { id: 'thermal', name: 'Thermal', colors: ['#260f3b', '#fc4835', '#ffd958', '#9c1f6a', '#fff3c4'] },
  { id: 'mint-carbon', name: 'Mint / carbon', colors: ['#171f25', '#4de2b0', '#e8f1db', '#2f5d57', '#ffab9e'] },
  { id: 'rose-ink', name: 'Rose ink', colors: ['#efe2d8', '#db6d96', '#263d34', '#7f9c8b', '#f0a979'] },
  { id: 'ultraviolet', name: 'Ultraviolet', colors: ['#171139', '#7352ff', '#efa8ff', '#3a2a8f', '#6ff7ff'] },
  { id: 'ochre-archive', name: 'Ochre archive', colors: ['#f2e4c7', '#be8739', '#42392f', '#8a6f4d', '#5f8a91'] },
  { id: 'silver', name: 'Silver halide', colors: ['#141918', '#838b84', '#f2f1e9', '#3c4442', '#c4c9c2'] },
];

/** Completes a custom palette to five roles. Candidates stay within the palette's
 * own hue families (±30°) and chroma, and the most separated candidate
 * (in OKLab) is chosen, so added roles extend the palette instead of importing
 * a foreign or muddy color. Existing colors are never changed. */
export function completePalette(input: Recipe['palette']): FiveColors {
  const colors: string[] = [...input];
  if (colors.length >= 5) return colors.slice(0, 5) as FiveColors;
  const lch = input.map(hexToOklch);
  const relative = lch.map(([L, C, h]) => C / Math.max(1e-4, maxChroma(L, h)));
  const vivid = Math.max(.08, Math.max(...relative));
  const candidates = lch.flatMap(([, C, h]) => (C < .02 ? [h] : [h, h - 30, h + 30]).flatMap(hue =>
    Array.from({ length: 14 }, (_, i) => .16 + i * .058).flatMap(L => [.55, 1].map(k => oklchToHex(L, k * vivid * maxChroma(L, (hue + 360) % 360), (hue + 360) % 360)))));
  while (colors.length < 5) {
    let best = candidates[0], distance = -1;
    for (const candidate of candidates) {
      const separation = Math.min(...colors.map(c => deltaE(candidate, c)));
      if (separation > distance) { best = candidate; distance = separation; }
    }
    colors.push(best);
  }
  return colors as FiveColors;
}
/** A stable prefix keeps the first three established role assignments intact. */
export function paletteVariant(colors: Recipe['palette'], size: PaletteSize): Recipe['palette'] {
  if (![2, 3, 4, 5].includes(size)) throw new Error('Choose two to five colors.');
  return (size <= colors.length ? colors : completePalette(colors)).slice(0, size) as Recipe['palette'];
}

export type PaletteVibes = { tone: 'light' | 'mid' | 'dark'; energy: 'muted' | 'balanced' | 'vivid'; temperature: 'warm' | 'cool' | 'neutral' };
/** Coarse, computed descriptors for filtering: ground lightness, average chroma of
 * the four non-ground roles, and chroma-weighted hue temperature. */
export function paletteVibes(colors: readonly string[]): PaletteVibes {
  const lch = colors.map(hexToOklch);
  const ground = lch[0][0];
  const chroma = lch.slice(1).reduce((sum, [, C]) => sum + C, 0) / Math.max(1, lch.length - 1);
  let warm = 0, cool = 0;
  for (const [, C, h] of lch) {
    const weight = Math.max(0, C - .025);
    if (h < 110 || h >= 330) warm += weight; else if (h >= 160 && h < 300) cool += weight;
  }
  return {
    tone: ground > .72 ? 'light' : ground < .36 ? 'dark' : 'mid',
    energy: chroma > .13 ? 'vivid' : chroma < .065 ? 'muted' : 'balanced',
    temperature: warm > cool * 1.35 && warm > .05 ? 'warm' : cool > warm * 1.35 && cool > .05 ? 'cool' : 'neutral',
  };
}

/** 12 signatures + 44 structures × 18 hue anchors (792) + 85 earlier hand-authored
 * palettes (Mood, Hours, Weather, Cinema, Genre) + 56 in Machines, Movements,
 * Materials and Now + 55 in Glitch, Circuits, Signage and Cartography = 1000. */
export const palettePresets: PalettePreset[] = [
  ...signatures.map(p => ({ ...p, collection: 'signature' as const })),
  ...templates.flatMap(template => hues.map(([hue, angle]) => ({
    id: `${template.collection}-${hue.toLowerCase()}-${template.name.toLowerCase()}`,
    name: `${hue} ${template.name}`,
    collection: template.collection,
    colors: makeColors(template, angle),
  }))),
  ...moodPalettes.map(p => ({ ...p, collection: 'mood' as const })),
  ...curatedPalettes,
  ...studioPalettes,
  ...logicPalettes,
];
const vibeWords = new Map(palettePresets.map(p => { const v = paletteVibes(p.colors); return [p.id, `${v.tone} ${v.energy} ${v.temperature}`]; }));
export const vibeOf = (palette: PalettePreset) => paletteVibes(palette.colors);
/** Terms intersect across name, collection, hex values and computed vibes
 * (light / mid / dark, muted / balanced / vivid, warm / cool / neutral). */
export function filterPalettes(collection = 'all', query = ''): PalettePreset[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return palettePresets.filter(p => (collection === 'all' || p.collection === collection) && terms.every(term => `${p.name} ${paletteCollections.find(c => c.id === p.collection)?.name} ${p.colors.join(' ')} ${vibeWords.get(p.id)}`.toLowerCase().includes(term)));
}
