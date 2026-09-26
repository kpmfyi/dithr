import type { FiveColors } from './palettes.ts';

/**
 * Four hand-authored collections added with the logic studies (91–100). Same
 * five-role display order as the rest of the library: [ground, accent, ink,
 * body, trace]. Glitch takes the colours of failing displays and broken video;
 * Circuits the components on a board; Signage the safety and wayfinding
 * conventions of the built world (several vivid mid-tone grounds); Cartography
 * the conventions of printed and screen maps. Each palette meets the 5:1
 * luminance range and OKLab ΔE ≥ .085 separation gates.
 */
export const logicCollections = [
  { id: 'glitch', name: 'Glitch', note: 'Failing displays and broken video: dead and hot pixels, chroma bleed, tracking error, test patterns, datamosh, split channels, burn-in and static.', palettes: [
    { id: 'glitch-dead-pixel', name: 'Dead Pixel', colors: ['#0b0b0d', '#ff2a6d', '#f4f4f4', '#3d3d44', '#05d9e8'] },
    { id: 'glitch-hot-pixel', name: 'Hot Pixel', colors: ['#f2f2ee', '#ff0033', '#111111', '#8c8c8c', '#00b8d9'] },
    { id: 'glitch-chroma-bleed', name: 'Chroma Bleed', colors: ['#101018', '#ff00a8', '#e8f6ff', '#0077e6', '#ffe600'] },
    { id: 'glitch-tracking-error', name: 'Tracking Error', colors: ['#1d1a1c', '#8fd3ff', '#f0ede6', '#5a5560', '#ff7aa2'] },
    { id: 'glitch-test-pattern', name: 'Test Pattern', colors: ['#f5f5f0', '#ffe600', '#1a1a1a', '#0090d0', '#ff3cac'] },
    { id: 'glitch-color-bars', name: 'Color Bars', colors: ['#0d0d0d', '#ffe100', '#f8f8f8', '#2a7bd6', '#e0148c'] },
    { id: 'glitch-datamosh', name: 'Datamosh', colors: ['#2a1b3d', '#a7ff3d', '#f1e9ff', '#6a4a9a', '#ff5fa2'] },
    { id: 'glitch-rgb-split', name: 'RGB Split', colors: ['#e9e9e9', '#ff3b3b', '#151515', '#3b6dff', '#22c55e'] },
    { id: 'glitch-burn-in', name: 'Burn-In', colors: ['#d8d3c1', '#b8862e', '#2f2a22', '#8b8570', '#5a4a30'] },
    { id: 'glitch-rolling-shutter', name: 'Rolling Shutter', colors: ['#141821', '#7cffc4', '#ffffff', '#2e4a5e', '#ffb86b'] },
    { id: 'glitch-dropout', name: 'Dropout', colors: ['#f3efe4', '#111111', '#e63946', '#a8a29e', '#2a9d8f'] },
    { id: 'glitch-field-tear', name: 'Field Tear', colors: ['#0e1a14', '#c8ff4d', '#e8ffe0', '#2f5f3f', '#ff8f3d'] },
    { id: 'glitch-ghost-image', name: 'Ghost Image', colors: ['#e6e8ec', '#6b7c93', '#1c2230', '#a9b4c4', '#ff6f59'] },
    { id: 'glitch-static', name: 'Static', colors: ['#1a1a1a', '#bfbfbf', '#ffffff', '#4d4d4d', '#ff4136'] },
  ] },
  { id: 'circuits', name: 'Circuits', note: 'What is on the board: solder mask, copper traces, ribbon cable, resistor bands, LEDs, phosphor scopes, silicon, enamel wire, capacitors, ferrite, power rails and neon.', palettes: [
    { id: 'circuits-solder-mask', name: 'Solder Mask', colors: ['#0f3d2e', '#d4af37', '#f5f0dc', '#2a6f4f', '#a8b0b8'] },
    { id: 'circuits-copper-trace', name: 'Copper Trace', colors: ['#12332a', '#e0873a', '#f8e8c8', '#1f5a47', '#7fd8b4'] },
    { id: 'circuits-ribbon-cable', name: 'Ribbon Cable', colors: ['#2a2a2e', '#ff4d4d', '#f0f0f0', '#4d79ff', '#ffd23f'] },
    { id: 'circuits-resistor-bands', name: 'Resistor Bands', colors: ['#d9c8a9', '#c8102e', '#1b1b1b', '#8b5a2b', '#2a7f62'] },
    { id: 'circuits-breadboard', name: 'Breadboard', colors: ['#efe9dc', '#2d6cdf', '#1c1c1c', '#d63b2f', '#7dbb50'] },
    { id: 'circuits-blue-led', name: 'Blue LED', colors: ['#050a14', '#2f80ff', '#e6f0ff', '#12305f', '#9cc8ff'] },
    { id: 'circuits-oscilloscope', name: 'Oscilloscope', colors: ['#0b1a12', '#5fff8f', '#d7ffe4', '#1c4a2e', '#ffe45c'] },
    { id: 'circuits-silicon-die', name: 'Silicon Die', colors: ['#1a1f2b', '#7f8fa6', '#e3e8f0', '#3b465a', '#c9a227'] },
    { id: 'circuits-enamel-wire', name: 'Enamel Wire', colors: ['#f4e6d3', '#b4552a', '#3b2418', '#d99a63', '#5b7b8a'] },
    { id: 'circuits-capacitor', name: 'Capacitor', colors: ['#2b2b3a', '#2fb0c9', '#f0f2f5', '#5e5e75', '#e8a13a'] },
    { id: 'circuits-ferrite', name: 'Ferrite', colors: ['#151515', '#8a8a8a', '#e6e6e6', '#3d3d3d', '#c85c2a'] },
    { id: 'circuits-power-rail', name: 'Power Rail', colors: ['#f7f4ee', '#d81e05', '#101010', '#1e3ed8', '#8a8a8a'] },
    { id: 'circuits-thermal-paste', name: 'Thermal Paste', colors: ['#e9e9e9', '#8d8d8d', '#1f1f1f', '#bfbfbf', '#5a5a5a'] },
    { id: 'circuits-neon-sign', name: 'Neon Sign', colors: ['#120a1e', '#ff2fd6', '#fff0fa', '#3a1f66', '#2fffe0'] },
  ] },
  { id: 'signage', name: 'Signage', note: 'Safety and wayfinding: caution yellow, safety orange, motorway blue, exit green, detour, hazard stripes, crosswalks, wet paint, enamel plates, high-vis and neon.', palettes: [
    { id: 'signage-caution', name: 'Caution', colors: ['#ffd400', '#111111', '#ffffff', '#7a6600', '#ff6a00'] },
    { id: 'signage-safety-orange', name: 'Safety Orange', colors: ['#ff6a00', '#111111', '#fff4e6', '#8c3a00', '#00a8b5'] },
    { id: 'signage-motorway', name: 'Motorway', colors: ['#0b3d91', '#ffffff', '#ffd400', '#3f6fc4', '#1c1c1c'] },
    { id: 'signage-wayfinding', name: 'Wayfinding', colors: ['#1c1c1c', '#f2f2f2', '#ffb400', '#5c5c5c', '#00a3e0'] },
    { id: 'signage-fire-exit', name: 'Fire Exit', colors: ['#0b6b3a', '#ffffff', '#111111', '#2f9e5a', '#f2e600'] },
    { id: 'signage-detour', name: 'Detour', colors: ['#f26d21', '#ffffff', '#1a1a1a', '#b34a0f', '#ffd166'] },
    { id: 'signage-site-plan', name: 'Site Plan', colors: ['#1f3a5f', '#f2f2f2', '#ffcc00', '#5b7fa6', '#d81e05'] },
    { id: 'signage-hazard-stripe', name: 'Hazard Stripe', colors: ['#111111', '#ffd400', '#f5f5f5', '#4d4d4d', '#ff2e2e'] },
    { id: 'signage-crosswalk', name: 'Crosswalk', colors: ['#2b2b2b', '#f4f4f4', '#ffe500', '#6b6b6b', '#00c2a8'] },
    { id: 'signage-wet-paint', name: 'Wet Paint', colors: ['#f5f0e8', '#d62828', '#1b1b1b', '#9a9a9a', '#3a86ff'] },
    { id: 'signage-enamel-plate', name: 'Enamel Plate', colors: ['#0e2a47', '#f0ece2', '#c8102e', '#3d5a80', '#e0b400'] },
    { id: 'signage-high-vis', name: 'High Vis', colors: ['#c6ff00', '#111111', '#ffffff', '#5c7a00', '#ff2fd6'] },
    { id: 'signage-neon-open', name: 'Neon Open', colors: ['#1a0a0a', '#ff2a2a', '#fff5f5', '#4a1010', '#2fd6ff'] },
    { id: 'signage-braille-plate', name: 'Braille Plate', colors: ['#c9c2b5', '#3f3a33', '#f5f1ea', '#8a8378', '#b5651d'] },
  ] },
  { id: 'maps', name: 'Cartography', note: 'Printed and screen maps: ordnance survey, nautical charts, transit diagrams, topographic sheets, satellite imagery, thermal, bathymetry, cadastral plans, geologic sections, night lights, radar and old atlases.', palettes: [
    { id: 'maps-ordnance', name: 'Ordnance', colors: ['#f4efe1', '#d0502b', '#2b2b2b', '#5f8f3a', '#3a7bd5'] },
    { id: 'maps-nautical-chart', name: 'Nautical Chart', colors: ['#e9f1ee', '#3a7bd5', '#1b2a3a', '#b7d7c4', '#d9a441'] },
    { id: 'maps-transit-map', name: 'Transit Map', colors: ['#f6f6f4', '#e2231a', '#1a1a1a', '#0060a8', '#00a651'] },
    { id: 'maps-topographic', name: 'Topographic', colors: ['#efe8d6', '#a86a2a', '#3d3a34', '#c9b38a', '#4d7ea8'] },
    { id: 'maps-satellite', name: 'Satellite', colors: ['#1e2f22', '#8fb24b', '#e6e0c8', '#4d6a3e', '#5a8fc2'] },
    { id: 'maps-thermal-map', name: 'Thermal Map', colors: ['#0a0a2a', '#ff5e1a', '#ffe94d', '#4a1f7a', '#ffffff'] },
    { id: 'maps-bathymetry', name: 'Bathymetry', colors: ['#08243a', '#3fa7d6', '#e8f4fb', '#134a6b', '#9ad6ee'] },
    { id: 'maps-cadastral', name: 'Cadastral', colors: ['#f8f5ec', '#8a2be2', '#2f2f2f', '#c8bfa8', '#e07a5f'] },
    { id: 'maps-geologic', name: 'Geologic', colors: ['#ece4cf', '#b5484a', '#33302b', '#6f9a7a', '#e2b04a'] },
    { id: 'maps-night-lights', name: 'Night Lights', colors: ['#050814', '#ffc857', '#e8ecf5', '#1c2a4a', '#ff7b54'] },
    { id: 'maps-weather-radar', name: 'Weather Radar', colors: ['#101820', '#2ecc71', '#f1c40f', '#1f6ea6', '#e74c3c'] },
    { id: 'maps-old-atlas', name: 'Old Atlas', colors: ['#e7d9b9', '#9b6b3d', '#3b2f22', '#b79a6a', '#5f7d8a'] },
    { id: 'maps-metro-tile', name: 'Metro Tile', colors: ['#f2efe9', '#00794f', '#101010', '#c0392b', '#2980b9'] },
  ] },
] as const satisfies readonly { id: string; name: string; note: string; palettes: readonly { id: string; name: string; colors: FiveColors }[] }[];
export const logicPalettes = logicCollections.flatMap(collection => collection.palettes.map(palette => ({ ...palette, colors: [...palette.colors] as FiveColors, collection: collection.id })));
