import type { FiveColors } from './palettes.ts';

/**
 * Mood: hand-authored five-role palettes for emotional scenes (songs, film cues).
 * Colors follow the crisp display contract rather than a hue wheel alone:
 * [ground (field; its ×.3 shade is the middle band), accent (afterimage and
 * motion memory), ink (primary forms), body (secondary forms), trace (secondary
 * afterimage)]. Each palette meets the catalog's 5:1 luminance range and .25
 * RGB separation between every pair. Stable prefixes keep the first N roles.
 */
export const moodPalettes: { id: string; name: string; colors: FiveColors }[] = [
  // Solitude: one pale form in a dark field; trails barely lift from the ground.
  { id: 'mood-empty-road', name: 'Empty Road', colors: ['#0a0d14', '#33405a', '#d9e2f0', '#8fa2c4', '#5a7196'] },
  { id: 'mood-sodium-lamp', name: 'Sodium Lamp', colors: ['#0c0b0f', '#42331f', '#f2b456', '#b5782c', '#6d5a44'] },
  { id: 'mood-moonlit-frost', name: 'Moonlit Frost', colors: ['#081018', '#1f3a4d', '#e8f6ff', '#8cc4e0', '#3f6f8c'] },
  // Grief: low chroma, stepped values, cool violet/slate or faded rose.
  { id: 'mood-ash-lilac', name: 'Ash & Lilac', colors: ['#18171e', '#3d3849', '#a79dba', '#6b6180', '#e2dbe9'] },
  { id: 'mood-rain-on-glass', name: 'Rain on Glass', colors: ['#161c22', '#34424d', '#9fb4c3', '#5d7384', '#dde7ee'] },
  { id: 'mood-faded-rose', name: 'Faded Rose', colors: ['#1d1418', '#50323b', '#c99aa2', '#8a5a66', '#efd9d6'] },
  // Dread: murky field, sickly dissonant afterimages.
  { id: 'mood-static-green', name: 'Static Green', colors: ['#080b09', '#8dff2a', '#3d5244', '#6c2c6e', '#c9ff85'] },
  { id: 'mood-ultraviolet', name: 'Ultraviolet Hush', colors: ['#07060f', '#7b2cff', '#aab4c4', '#2d1a55', '#d4ff3f'] },
  { id: 'mood-red-alert', name: 'Red Alert', colors: ['#0d0707', '#ff2e2e', '#5c6470', '#4a1f22', '#ffd23f'] },
  // Fury: black-body fire ramp, maximum warm contrast.
  { id: 'mood-firestorm', name: 'Firestorm', colors: ['#0b0302', '#ff4d17', '#ffd36b', '#a3160f', '#fff4d2'] },
  { id: 'mood-blood-moon', name: 'Blood Moon', colors: ['#160406', '#d7263d', '#f6a15b', '#5e0b15', '#ffe1c6'] },
  { id: 'mood-cinder', name: 'Cinder', colors: ['#1c1c1c', '#ff5e1a', '#e8e2d6', '#8a2b0e', '#ffb347'] },
  // Tempest: cold electric chaos.
  { id: 'mood-lightning', name: 'Lightning', colors: ['#06070d', '#8b7bff', '#eef3ff', '#2a3a66', '#5ce1ff'] },
  { id: 'mood-hail', name: 'Hail', colors: ['#0e1116', '#4f8cff', '#cfd8e3', '#56606e', '#ffffff'] },
  { id: 'mood-squall', name: 'Squall', colors: ['#0b1418', '#2ee6c5', '#e6edf0', '#3b4f63', '#a57cff'] },
  // Dawn / defiance: indigo night meeting gold and coral (complementary light).
  { id: 'mood-first-light', name: 'First Light', colors: ['#151238', '#ff7a59', '#ffd27a', '#c5577f', '#fff3d6'] },
  { id: 'mood-breakthrough', name: 'Breakthrough', colors: ['#0e1a3a', '#3fc5f0', '#ffcf4a', '#f78b54', '#ffffff'] },
  { id: 'mood-rising-gold', name: 'Rising Gold', colors: ['#fff3dc', '#ff9f1c', '#2b2d6e', '#e85d75', '#ffd166'] },
  // Renewal: yellow-greens with a warm sun accent.
  { id: 'mood-green-shoots', name: 'Green Shoots', colors: ['#f3f1dc', '#9cc43d', '#2f6b3f', '#5fae63', '#e9b949'] },
  { id: 'mood-moss-gold', name: 'Moss & Gold', colors: ['#0f2418', '#a8c957', '#f1e6c8', '#5b8f45', '#f2a541'] },
  { id: 'mood-bloom', name: 'Bloom', colors: ['#fbf3e6', '#f28fad', '#2e5e3b', '#8cc084', '#f6c453'] },
  // Tenderness: warm analogous rose, coral and cream.
  { id: 'mood-heartline', name: 'Heartline', colors: ['#2a0c1b', '#ff6f91', '#ffc2a3', '#d8435f', '#fff0e8'] },
  { id: 'mood-blush', name: 'Blush', colors: ['#fbe8e0', '#ef7a8b', '#7d2845', '#f7c08a', '#c94f6d'] },
  { id: 'mood-candlelight', name: 'Candlelight', colors: ['#1c120c', '#f29e4c', '#fbe3c0', '#a8472b', '#6e2f4a'] },
  // Euphoria: saturated triads, every role in motion.
  { id: 'mood-neon-saints', name: 'Neon Saints', colors: ['#0b0221', '#ff2bd6', '#2af5ff', '#ffe600', '#7c3bff'] },
  { id: 'mood-carnival', name: 'Carnival', colors: ['#fff6e5', '#ff3d7f', '#1e3cc8', '#ffb400', '#00c49a'] },
  { id: 'mood-solar', name: 'Solar Flare', colors: ['#1a0b2e', '#ff9e00', '#fff275', '#ff5d8f', '#3ae0ff'] },
  // Serenity: pale, low-chroma analogous water and dusk.
  { id: 'mood-sea-glass', name: 'Sea Glass', colors: ['#e4efe9', '#9ec9bf', '#2e5b61', '#6aa19e', '#d9b38c'] },
  { id: 'mood-moon-tide', name: 'Moon Tide', colors: ['#0c1a22', '#2c5566', '#b3dbe6', '#5f9fb8', '#f6e3b4'] },
  { id: 'mood-lavender-hour', name: 'Lavender Hour', colors: ['#efe9f4', '#b7a6d6', '#4b3f72', '#8a7fb8', '#f2c6b4'] },
  // Imagery: neon city, winter, meltwater.
  { id: 'mood-chrome-rain', name: 'Chrome Rain', colors: ['#0a0b10', '#ff3ea5', '#c7ccd6', '#4a5068', '#36e2ff'] },
  { id: 'mood-terminal-glow', name: 'Terminal Glow', colors: ['#050807', '#1aff8c', '#b7ffd6', '#1f6b4a', '#ffb000'] },
  { id: 'mood-hoarfrost', name: 'Hoarfrost', colors: ['#eef5fa', '#a9cbe3', '#23405c', '#6591b8', '#4a6b8a'] },
  { id: 'mood-frozen-river', name: 'Frozen River', colors: ['#08121c', '#35637f', '#e3f4ff', '#6c98bd', '#5be0ff'] },
  { id: 'mood-meltwater', name: 'Meltwater', colors: ['#e9f3ee', '#7cc6c2', '#2a5d4c', '#9ccf7c', '#f2c572'] },
];
