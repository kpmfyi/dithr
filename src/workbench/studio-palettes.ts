import type { FiveColors } from './palettes.ts';

/**
 * Four hand-authored collections that widen the library's range of vibes.
 * Same five-role display order as Mood: [ground, accent, ink, body, trace].
 * Machines borrows the limited palettes of display hardware (named generically);
 * Movements distills art and design history; Materials takes minerals, dyes,
 * metals and food; Now covers contemporary digital aesthetics. Mid-tone grounds
 * are deliberately well represented here, because the generated structures are
 * mostly very light or very dark. Each palette meets the catalog's 5:1 luminance
 * range and perceptual separation checks.
 */
export const studioCollections = [
  { id: 'machines', name: 'Machines', note: 'Limited palettes of display hardware: handheld LCDs, four-color graphics modes, phosphor and vacuum-fluorescent tubes, nixies, e-ink, teletext and plasma panels.', palettes: [
    { id: 'machines-pocket-lcd', name: 'Pocket LCD', colors: ['#c4d09a', '#7f9a2e', '#0f2f14', '#3f6b2a', '#e8f0c8'] },
    { id: 'machines-four-color-cool', name: 'Four-Color Cool', colors: ['#0a0a0c', '#55ffff', '#ffffff', '#ff55ff', '#00a3a3'] },
    { id: 'machines-four-color-warm', name: 'Four-Color Warm', colors: ['#0a0a0c', '#55ff55', '#ffff55', '#ff5555', '#aa5500'] },
    { id: 'machines-amber-monitor', name: 'Amber Monitor', colors: ['#120a02', '#ffb000', '#ffe3a0', '#7a4a00', '#ff6a00'] },
    { id: 'machines-vector-monitor', name: 'Vector Monitor', colors: ['#02060a', '#29ffea', '#eaffff', '#0f5b73', '#ff3d7a'] },
    { id: 'machines-vacuum-fluorescent', name: 'Vacuum Fluorescent', colors: ['#050b0c', '#3df2e0', '#c6fff8', '#127c7c', '#ff8a3d'] },
    { id: 'machines-nixie', name: 'Nixie', colors: ['#0c0706', '#ff6a1f', '#ffd2a8', '#5a1f0f', '#6f8f94'] },
    { id: 'machines-red-stereoscope', name: 'Red Stereoscope', colors: ['#050000', '#ff1a1a', '#ffb0b0', '#6a0000', '#b80000'] },
    { id: 'machines-e-ink', name: 'E-Ink', colors: ['#e8e6df', '#8f8d86', '#1c1c1a', '#55544f', '#b5b2a9'] },
    { id: 'machines-teletext', name: 'Teletext', colors: ['#07070a', '#fff200', '#ffffff', '#1f3dff', '#ff2bd6'] },
    { id: 'machines-plasma-panel', name: 'Plasma Panel', colors: ['#140400', '#ff5a00', '#ffc28a', '#7a1f00', '#ff2d6f'] },
    { id: 'machines-calculator', name: 'Calculator', colors: ['#b9c2a6', '#6f7a62', '#1e2419', '#48523f', '#e6ecd6'] },
    { id: 'machines-home-micro', name: 'Home Micro', colors: ['#3a2d86', '#8d7dd8', '#f0f0f0', '#9ad284', '#e0a24d'] },
    { id: 'machines-cartridge-sunset', name: 'Cartridge Sunset', colors: ['#1b1340', '#f85898', '#fce0a8', '#8a2f9c', '#58d8ff'] },
  ] },
  { id: 'movements', name: 'Movements', note: 'Art and design history by description: a design school, Memphis, the Swiss poster, constructivism, deco, pop, fauvism, woodblock prints, color-field painting, a pool in the sun, paper cut-outs, gold leaf, arts & crafts and psychedelia.', palettes: [
    { id: 'movements-bauhaus', name: 'Bauhaus', colors: ['#ede3cc', '#c8391f', '#1d1b19', '#2a5b8a', '#e0a526'] },
    { id: 'movements-memphis', name: 'Memphis', colors: ['#fdf6e8', '#ff5aa5', '#1b1b1b', '#2ec4b6', '#ffcb2d'] },
    { id: 'movements-swiss-poster', name: 'Swiss Poster', colors: ['#f2f0eb', '#e2231a', '#111111', '#8a8a8a', '#f2b8b3'] },
    { id: 'movements-constructivist', name: 'Constructivist', colors: ['#e8dcc0', '#c1121f', '#161616', '#7a5a3f', '#d9a24a'] },
    { id: 'movements-art-deco', name: 'Art Deco', colors: ['#0f1a17', '#d4a64a', '#f1e6cf', '#1f5c50', '#a8323a'] },
    { id: 'movements-pop-art', name: 'Pop Art', colors: ['#fbe3d6', '#ff2a2a', '#111111', '#2a7fff', '#ffe600'] },
    { id: 'movements-fauve', name: 'Fauve', colors: ['#1d6b4f', '#ff5b24', '#ffe08a', '#7b2cbf', '#ff8fab'] },
    { id: 'movements-woodblock', name: 'Woodblock', colors: ['#efe3c8', '#c8472e', '#1d2a44', '#3b6e8f', '#d9a441'] },
    { id: 'movements-color-field', name: 'Color Field', colors: ['#3a0f14', '#c2461f', '#e8b04a', '#6b1a24', '#8e4a7a'] },
    { id: 'movements-pool-in-the-sun', name: 'Pool in the Sun', colors: ['#2a9fd8', '#ff7eb6', '#fff7e0', '#16457a', '#ffd23f'] },
    { id: 'movements-cut-outs', name: 'Cut-Outs', colors: ['#f6f1e7', '#f25c3a', '#1d3fbf', '#2a8f5b', '#f7c531'] },
    { id: 'movements-gilded', name: 'Gilded', colors: ['#1a1410', '#d9a73e', '#f3e3b0', '#8a5a1f', '#3f7a6b'] },
    { id: 'movements-arts-and-crafts', name: 'Arts & Crafts', colors: ['#e9dfc4', '#b0492f', '#27402f', '#3f6b7d', '#c9a13b'] },
    { id: 'movements-psychedelic', name: 'Psychedelic', colors: ['#2b0f3a', '#ff6b1a', '#ffe14d', '#d62ad6', '#3be8b0'] },
  ] },
  { id: 'materials', name: 'Materials', note: 'Minerals, dyes, metals, stone, glaze and food: malachite, lapis, rhodochrosite, obsidian, verdigris, terracotta, indigo, saffron, oxblood, brass, concrete, jade, reef and matcha.', palettes: [
    { id: 'materials-malachite', name: 'Malachite', colors: ['#0e2a22', '#2fbf71', '#c9f2dc', '#17694a', '#e0b35a'] },
    { id: 'materials-lapis', name: 'Lapis', colors: ['#10204f', '#d9b44a', '#e9edf7', '#2a4fb0', '#7fa0e8'] },
    { id: 'materials-rhodochrosite', name: 'Rhodochrosite', colors: ['#f6e1dc', '#e0607e', '#5a1e2e', '#b8475f', '#f2a5a8'] },
    { id: 'materials-obsidian', name: 'Obsidian', colors: ['#0b0b0f', '#5e7194', '#d3d9e2', '#2a2e38', '#a283e0'] },
    { id: 'materials-verdigris', name: 'Verdigris', colors: ['#dfe7dd', '#43a08a', '#3a2a1e', '#8c6a3a', '#9fd3c0'] },
    { id: 'materials-terracotta', name: 'Terracotta', colors: ['#c65d3b', '#f2c49b', '#2b1a14', '#8a3520', '#6f8a5a'] },
    { id: 'materials-indigo-dye', name: 'Indigo Dye', colors: ['#1b2a4a', '#6f8fc9', '#ece6d6', '#34568f', '#c0784a'] },
    { id: 'materials-saffron', name: 'Saffron', colors: ['#fff4df', '#f4a300', '#6b2b0e', '#d9531e', '#c21e56'] },
    { id: 'materials-oxblood', name: 'Oxblood', colors: ['#1c0b0c', '#9b1f2a', '#e8d5c0', '#5a3a2e', '#c77d4a'] },
    { id: 'materials-brass', name: 'Brass', colors: ['#16130e', '#c9a227', '#f4e7c1', '#6e5a2a', '#b35c2e'] },
    { id: 'materials-concrete', name: 'Concrete', colors: ['#b8b6b0', '#ff6b00', '#2a2a28', '#76746f', '#ecebe7'] },
    { id: 'materials-jade', name: 'Jade', colors: ['#e6efe6', '#3c8d6e', '#173a2e', '#86c4a5', '#c9a45c'] },
    { id: 'materials-reef', name: 'Reef', colors: ['#0b3d5c', '#ff7f6a', '#fff1d6', '#1d8a99', '#ffd23f'] },
    { id: 'materials-matcha', name: 'Matcha', colors: ['#eef0e0', '#8aa83a', '#2d3a1c', '#c4d27e', '#b27a4a'] },
  ] },
  { id: 'now', name: 'Now', note: 'Contemporary digital aesthetics: chrome Y2K, vaporwave, aero gloss, neo-brutalist web, acid graphics, dark mode, fintech, liminal spaces, solarpunk, outdoor gear, bubblegum, cyberdecks, frosted glass and acid lime.', palettes: [
    { id: 'now-chrome-y2k', name: 'Chrome Y2K', colors: ['#dfe6ee', '#6aaeff', '#1d2433', '#b09cff', '#c6ff4a'] },
    { id: 'now-vaporwave', name: 'Vaporwave', colors: ['#231942', '#ff71ce', '#fffb96', '#01cdfe', '#b967ff'] },
    { id: 'now-aero-gloss', name: 'Aero Gloss', colors: ['#e9f7ff', '#35b6ff', '#0b4a6f', '#7ed957', '#ffcf3a'] },
    { id: 'now-neo-brutalist', name: 'Neo-Brutalist', colors: ['#f4efe4', '#ffd23f', '#0f0f0f', '#ff6fb5', '#4d7cff'] },
    { id: 'now-acid-graphics', name: 'Acid Graphics', colors: ['#c8c8c8', '#c6ff00', '#111111', '#7e7e7e', '#ff3df2'] },
    { id: 'now-dark-mode', name: 'Dark Mode', colors: ['#0f1115', '#7c5cff', '#e6e8ee', '#2a2f3a', '#2dd4bf'] },
    { id: 'now-fintech', name: 'Fintech', colors: ['#0a1f33', '#00d4a0', '#f2f7fb', '#1f4b7a', '#ffd166'] },
    { id: 'now-liminal', name: 'Liminal', colors: ['#f2e8b6', '#c9b76a', '#4d4a3a', '#8f948a', '#4fb0a4'] },
    { id: 'now-solarpunk', name: 'Solarpunk', colors: ['#f3f7e6', '#f2b705', '#1e4d2b', '#7cc36a', '#2fa6a0'] },
    { id: 'now-trailhead', name: 'Trailhead', colors: ['#3f4a3a', '#ff7a1a', '#e8e2d0', '#7f9160', '#3ab0c9'] },
    { id: 'now-bubblegum', name: 'Bubblegum', colors: ['#ffd6e8', '#ff4fa3', '#5a1740', '#9b59d0', '#fff2a8'] },
    { id: 'now-cyberdeck', name: 'Cyberdeck', colors: ['#101418', '#ffcc00', '#dfe6ea', '#3a4a55', '#00e0ff'] },
    { id: 'now-frosted-glass', name: 'Frosted Glass', colors: ['#c9d7ff', '#ff8ad8', '#1b1f4a', '#7f96ff', '#fefefe'] },
    { id: 'now-acid-lime', name: 'Acid Lime', colors: ['#8ace00', '#1a1a1a', '#f6ffe0', '#4a7a00', '#ff4fd8'] },
  ] },
] as const satisfies readonly { id: string; name: string; note: string; palettes: readonly { id: string; name: string; colors: FiveColors }[] }[];
export const studioPalettes = studioCollections.flatMap(collection => collection.palettes.map(palette => ({ ...palette, colors: [...palette.colors] as FiveColors, collection: collection.id })));
