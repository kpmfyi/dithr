import type { Recipe } from '../seedbank/recipes.ts';

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
] as const;
export type PaletteCollection = typeof paletteCollections[number]['id'];
export type PalettePreset = { id: string; name: string; collection: PaletteCollection; colors: Recipe['palette'] };
// Offset (degrees), saturation and lightness. Templates deliberately vary the
// placement of light/dark colors as well as hue relationships and saturation.
type Hsl = readonly [number, number, number];
type Template = { name: string; collection: Exclude<PaletteCollection, 'signature'>; colors: readonly [Hsl, Hsl, Hsl] };
const templates: Template[] = [
  { name: 'Voltage', collection: 'electric', colors: [[240, .28, .08], [0, .94, .54], [120, .90, .74]] },
  { name: 'Arc', collection: 'electric', colors: [[0, .90, .58], [180, .95, .63], [60, .35, .09]] },
  { name: 'Neon', collection: 'electric', colors: [[30, .22, .93], [0, .95, .40], [140, .98, .55]] },
  { name: 'Interference', collection: 'electric', colors: [[0, .60, .12], [160, .95, .63], [300, .84, .50]] },
  { name: 'Risograph', collection: 'print', colors: [[45, .18, .94], [0, .80, .44], [190, .50, .17]] },
  { name: 'Overprint', collection: 'print', colors: [[0, .15, .89], [20, .50, .57], [210, .64, .24]] },
  { name: 'Carbon', collection: 'print', colors: [[0, .10, .95], [35, .24, .22], [0, .90, .51]] },
  { name: 'Edition', collection: 'print', colors: [[180, .38, .23], [0, .75, .49], [55, .43, .87]] },
  { name: 'Afterhours', collection: 'night', colors: [[0, .32, .07], [40, .72, .38], [180, .84, .72]] },
  { name: 'Nocturne', collection: 'night', colors: [[210, .36, .12], [0, .58, .66], [30, .24, .88]] },
  { name: 'Blacklight', collection: 'night', colors: [[0, .50, .09], [100, .90, .49], [270, .78, .74]] },
  { name: 'Ember', collection: 'night', colors: [[25, .80, .54], [0, .40, .09], [55, .62, .84]] },
  { name: 'Sediment', collection: 'earth', colors: [[30, .32, .85], [0, .39, .44], [55, .24, .18]] },
  { name: 'Patina', collection: 'earth', colors: [[160, .27, .18], [0, .46, .57], [35, .32, .80]] },
  { name: 'Terrace', collection: 'earth', colors: [[0, .20, .89], [140, .31, .46], [15, .50, .31]] },
  { name: 'Shale', collection: 'earth', colors: [[0, .18, .23], [210, .21, .64], [40, .43, .76]] },
  { name: 'Chalk', collection: 'pastel', colors: [[40, .32, .95], [0, .62, .75], [200, .36, .29]] },
  { name: 'Sherbet', collection: 'pastel', colors: [[0, .68, .79], [100, .63, .84], [240, .39, .24]] },
  { name: 'Porcelain', collection: 'pastel', colors: [[180, .42, .91], [0, .50, .67], [10, .38, .21]] },
  { name: 'Velvet', collection: 'pastel', colors: [[0, .29, .20], [30, .58, .74], [170, .55, .88]] },
  { name: 'Tonal', collection: 'duotone', colors: [[0, .48, .12], [0, .72, .49], [0, .40, .89]] },
  { name: 'Wash', collection: 'duotone', colors: [[0, .28, .93], [12, .42, .58], [0, .65, .25]] },
  { name: 'Negative', collection: 'duotone', colors: [[0, .78, .55], [0, .40, .10], [350, .38, .91]] },
  { name: 'Silverplate', collection: 'duotone', colors: [[0, .04, .14], [0, .12, .57], [0, .08, .94]] },
  { name: 'Hazard', collection: 'industrial', colors: [[0, .06, .88], [0, .90, .50], [0, .05, .14]] },
  { name: 'Alloy', collection: 'industrial', colors: [[0, .08, .19], [0, .64, .43], [180, .12, .78]] },
  { name: 'Blueprint', collection: 'industrial', colors: [[0, .69, .26], [0, .48, .63], [40, .22, .94]] },
  { name: 'Terminal', collection: 'industrial', colors: [[0, .10, .10], [0, .72, .71], [180, .22, .46]] },
  { name: 'Clash', collection: 'experimental', colors: [[0, .84, .58], [120, .64, .19], [240, .83, .80]] },
  { name: 'Solarize', collection: 'experimental', colors: [[150, .75, .88], [0, .90, .31], [280, .93, .54]] },
  { name: 'Mutant', collection: 'experimental', colors: [[0, .52, .18], [75, .87, .58], [210, .74, .76]] },
  { name: 'Collision', collection: 'experimental', colors: [[220, .63, .55], [0, .81, .74], [110, .47, .10]] },
];
const hues = ['Scarlet', 'Copper', 'Amber', 'Citron', 'Lime', 'Fern', 'Emerald', 'Jade', 'Lagoon', 'Cyan', 'Glacier', 'Azure', 'Cobalt', 'Iris', 'Violet', 'Orchid', 'Magenta', 'Rose'];

function hsl([hue, saturation, lightness]: Hsl): string {
  const h = ((hue % 360) + 360) % 360 / 60;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(h % 2 - 1));
  const rgb = h < 1 ? [chroma, x, 0] : h < 2 ? [x, chroma, 0] : h < 3 ? [0, chroma, x] : h < 4 ? [0, x, chroma] : h < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return '#' + rgb.map(c => Math.round((c + lightness - chroma / 2) * 255).toString(16).padStart(2, '0')).join('');
}
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
function luminance(hex: string): number {
  const c = rgb(hex).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
/** Separation checks for shader colors, not a text accessibility certification. */
export function paletteQuality(colors: Recipe['palette']) {
  const light = colors.map(luminance);
  const minDistance = Math.min(...[[0, 1], [0, 2], [1, 2]].map(([a, b]) => Math.hypot(...rgb(colors[a]).map((v, i) => v - rgb(colors[b])[i]))));
  return { contrast: (Math.max(...light) + .05) / (Math.min(...light) + .05), minDistance };
}
function makeColors(template: Template, hue: number): Recipe['palette'] {
  const values = template.colors.map(([offset, s, l]) => [hue + offset, s, l] as [number, number, number]);
  let colors = values.map(hsl) as Recipe['palette'];
  // Yellow/green and blue have very different luminance at the same HSL L.
  // Deepen the darkest role when needed to keep shapes legible across the wheel.
  for (let pass = 0; paletteQuality(colors).contrast < 5 && pass < 12; pass++) {
    const darkest = colors.map(luminance).indexOf(Math.min(...colors.map(luminance)));
    values[darkest][2] *= .84;
    colors = values.map(hsl) as Recipe['palette'];
  }
  return colors;
}
const signatures: Omit<PalettePreset, 'collection'>[] = [
  { id: 'electric-paper', name: 'Electric paper', colors: ['#eeeae0', '#0757ff', '#ceff39'] },
  { id: 'orchid-acid', name: 'Orchid / acid', colors: ['#f2efdf', '#b84be8', '#d4ef35'] },
  { id: 'hot-press', name: 'Hot press', colors: ['#ece3d0', '#ff4b2e', '#1b2432'] },
  { id: 'night-signal', name: 'Night signal', colors: ['#14152e', '#ed5479', '#b9f76b'] },
  { id: 'oxidized', name: 'Oxidized', colors: ['#092e35', '#ed7859', '#e9e4c8'] },
  { id: 'cobalt-cream', name: 'Cobalt / cream', colors: ['#16243d', '#3163ed', '#ffedbb'] },
  { id: 'thermal', name: 'Thermal', colors: ['#260f3b', '#fc4835', '#ffd958'] },
  { id: 'mint-carbon', name: 'Mint / carbon', colors: ['#171f25', '#4de2b0', '#e8f1db'] },
  { id: 'rose-ink', name: 'Rose ink', colors: ['#efe2d8', '#db6d96', '#263d34'] },
  { id: 'ultraviolet', name: 'Ultraviolet', colors: ['#171139', '#7352ff', '#efa8ff'] },
  { id: 'ochre-archive', name: 'Ochre archive', colors: ['#f2e4c7', '#be8739', '#42392f'] },
  { id: 'silver', name: 'Silver halide', colors: ['#141918', '#838b84', '#f2f1e9'] },
];

/** 12 original signatures plus 32 color structures × 18 hue anchors = 588. */
export const palettePresets: PalettePreset[] = [
  ...signatures.map(p => ({ ...p, collection: 'signature' as const })),
  ...templates.flatMap(template => hues.map((hue, index) => ({
    id: `${template.collection}-${hue.toLowerCase()}-${template.name.toLowerCase()}`,
    name: `${hue} ${template.name}`,
    collection: template.collection,
    colors: makeColors(template, index * 20),
  }))),
];
export function filterPalettes(collection = 'all', query = ''): PalettePreset[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return palettePresets.filter(p => (collection === 'all' || p.collection === collection) && terms.every(term => `${p.name} ${paletteCollections.find(c => c.id === p.collection)?.name} ${p.colors.join(' ')}`.toLowerCase().includes(term)));
}
