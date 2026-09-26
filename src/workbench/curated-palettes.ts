import type { FiveColors } from './palettes.ts';

/**
 * Hand-authored collections beyond Mood. Same five-role display order:
 * [ground (field; its ×.3 shade is the middle band), accent (afterimage/motion
 * memory), ink (primary forms), body (secondary forms), trace (secondary
 * afterimage)]. Every palette meets the catalog's 5:1 luminance range and .25
 * RGB separation between every pair; stable prefixes keep the first N roles.
 */
export const curatedCollections = [
  { id: 'hours', name: 'Hours', note: 'Light through a day: pre-dawn blue, sunrise, haze, noon glare, golden hour, sunset, dusk, city twilight, midnight, moonlight, 4 a.m. and starlight.', palettes: [
    { id: 'hours-blue-before-dawn', name: 'Blue Before Dawn', colors: ['#0d1b3e', '#3f5c9a', '#f3c9a4', '#7f8fc4', '#c7d3f2'] },
    { id: 'hours-sunrise', name: 'Sunrise', colors: ['#2b1d3f', '#ff8a5b', '#ffd89b', '#e0527a', '#fce9ff'] },
    { id: 'hours-morning-haze', name: 'Morning Haze', colors: ['#eef0e6', '#bcc9c2', '#3e5763', '#e0a27a', '#7f9fb8'] },
    { id: 'hours-high-noon', name: 'High Noon', colors: ['#fffbe8', '#ffd23f', '#1b3a5c', '#7ec4e8', '#f28c28'] },
    { id: 'hours-golden-hour', name: 'Golden Hour', colors: ['#3a1f0b', '#f4a340', '#ffe3a3', '#c7652a', '#fffdf5'] },
    { id: 'hours-sunset-strip', name: 'Sunset Strip', colors: ['#1c0f2e', '#ff5e57', '#ffb347', '#9b3b8f', '#ffe08a'] },
    { id: 'hours-dusk', name: 'Dusk', colors: ['#1e2340', '#8a6fb0', '#f0b7a4', '#4f5b8f', '#e8d8f0'] },
    { id: 'hours-twilight-traffic', name: 'Twilight Traffic', colors: ['#0e1424', '#ff4f6d', '#ffd166', '#3a86ff', '#f5f5f5'] },
    { id: 'hours-midnight-blue', name: 'Midnight Blue', colors: ['#050a1a', '#1f3b73', '#9fc1ff', '#3d5fa8', '#e6f0ff'] },
    { id: 'hours-moonlight', name: 'Moonlight', colors: ['#0b0e14', '#2e3440', '#e5e9f0', '#88a0bf', '#5e6f87'] },
    { id: 'hours-four-am', name: 'Four A.M.', colors: ['#120e1a', '#3b3350', '#b9a9d9', '#6b5a8e', '#ff8f6b'] },
    { id: 'hours-starlight', name: 'Starlight', colors: ['#04060d', '#6b7cff', '#ffffff', '#fff2b0', '#3a4b99'] },
  ] },
  { id: 'weather', name: 'Weather', note: 'Atmospheres: rain, heat, autumn, fog, thunderheads, monsoon, drought, snow, aurora, dust, after-rain and dry lightning.', palettes: [
    { id: 'weather-spring-rain', name: 'Spring Rain', colors: ['#e7efe8', '#9cc9b4', '#2f4f4a', '#c9e27a', '#6f8fb8'] },
    { id: 'weather-heatwave', name: 'Heatwave', colors: ['#fff1d6', '#ff6b35', '#7a1f10', '#ffb627', '#ffe066'] },
    { id: 'weather-autumn-leaves', name: 'Autumn Leaves', colors: ['#2a1a12', '#d2691e', '#f4c95d', '#8b2f1c', '#e9e1c6'] },
    { id: 'weather-fog-bank', name: 'Fog Bank', colors: ['#cfd5da', '#a2acb4', '#2f3a44', '#6f7c88', '#ffffff'] },
    { id: 'weather-thunderhead', name: 'Thunderhead', colors: ['#1f2430', '#8e9aaf', '#f4f1de', '#4a5568', '#ffd23f'] },
    { id: 'weather-monsoon', name: 'Monsoon', colors: ['#0f2a2e', '#2a9d8f', '#d8f3dc', '#1f5f5b', '#95d5b2'] },
    { id: 'weather-drought', name: 'Drought', colors: ['#f2e3c6', '#d9a05b', '#5c3d2e', '#b86f3c', '#8a9a5b'] },
    { id: 'weather-snowfall', name: 'Snowfall', colors: ['#f4f8fb', '#bdd0df', '#2c4057', '#8aa7c0', '#5f7f9e'] },
    { id: 'weather-aurora', name: 'Aurora', colors: ['#050d1a', '#2dffb3', '#b388ff', '#1b6f6a', '#7df9ff'] },
    { id: 'weather-sandstorm', name: 'Sandstorm', colors: ['#bf9a5c', '#e8c98f', '#4a3222', '#8c6239', '#f6e7c8'] },
    { id: 'weather-after-the-rain', name: 'After the Rain', colors: ['#1a2233', '#ff6b6b', '#ffe66d', '#4ecdc4', '#a78bfa'] },
    { id: 'weather-dry-lightning', name: 'Dry Lightning', colors: ['#140c1f', '#ff9f1c', '#e0e7ff', '#5b2a86', '#ffd6a5'] },
  ] },
  { id: 'cinema', name: 'Cinema', note: 'Film-grading looks by description (no brands): noir, three-strip, bleach bypass, teal & orange, cross-process, sepia, slide film, day-for-night, neon noir, faded print, acid western and VHS night.', palettes: [
    { id: 'cinema-noir', name: 'Noir', colors: ['#0c0c0c', '#3a3a3a', '#e8e8e8', '#8c8c8c', '#636363'] },
    { id: 'cinema-three-strip', name: 'Three-Strip', colors: ['#f3e9d2', '#d7263d', '#1b4965', '#f4a259', '#2a9d8f'] },
    { id: 'cinema-bleach-bypass', name: 'Bleach Bypass', colors: ['#1e2124', '#6b7178', '#d8d4c8', '#a39b8b', '#42494f'] },
    { id: 'cinema-teal-orange', name: 'Teal & Orange', colors: ['#0b2530', '#1f7a8c', '#ffa552', '#f26b38', '#bfe8ef'] },
    { id: 'cinema-cross-process', name: 'Cross-Process', colors: ['#f4f1bb', '#9bc1bc', '#5d576b', '#ed6a5a', '#2aa7b8'] },
    { id: 'cinema-sepia', name: 'Sepia', colors: ['#f3e6cc', '#b08a5f', '#3a2616', '#7a5a3c', '#d8bd92'] },
    { id: 'cinema-slide-film', name: 'Slide Film', colors: ['#1d3557', '#e63946', '#f1faee', '#457b9d', '#ffb703'] },
    { id: 'cinema-day-for-night', name: 'Day for Night', colors: ['#0a1a2f', '#2f5d8a', '#a8c5e6', '#6a8fb8', '#ffffff'] },
    { id: 'cinema-neon-noir', name: 'Neon Noir', colors: ['#0a0612', '#ff2e88', '#7df9ff', '#3d1a5b', '#f5f3ff'] },
    { id: 'cinema-faded-print', name: 'Faded Print', colors: ['#e9dfd0', '#d3a6a0', '#3d5a6c', '#8fb3b0', '#c97b63'] },
    { id: 'cinema-acid-western', name: 'Acid Western', colors: ['#f2c14e', '#f78154', '#1f2041', '#4d9078', '#b4436c'] },
    { id: 'cinema-vhs-night', name: 'VHS Night', colors: ['#120a1f', '#00e5ff', '#ff4ecd', '#3a2b6b', '#fdf5a6'] },
  ] },
  { id: 'genre', name: 'Genre', note: 'Music scenes: outrun, lo-fi, grunge, disco, jazz club, gospel morning, punk, dream pop, techno, folk, heavy metal, island sound, hip-hop and ambient.', palettes: [
    { id: 'genre-outrun-grid', name: 'Outrun Grid', colors: ['#0d0221', '#0abdc6', '#ea00d9', '#133e7c', '#711c91'] },
    { id: 'genre-lofi-study', name: 'Lo-fi Study', colors: ['#2d2a32', '#7e6b8f', '#f2d7b6', '#d0888c', '#9fb8ad'] },
    { id: 'genre-grunge', name: 'Grunge', colors: ['#262420', '#8a6e4c', '#d9c7a0', '#4d5b3a', '#a8322a'] },
    { id: 'genre-disco', name: 'Disco', colors: ['#1c0b19', '#ff9f1c', '#ffe8a3', '#c200fb', '#ec0868'] },
    { id: 'genre-jazz-club', name: 'Jazz Club', colors: ['#121a26', '#b5651d', '#e8c07d', '#6b2d3a', '#4f7ca8'] },
    { id: 'genre-gospel-morning', name: 'Gospel Morning', colors: ['#fff8ea', '#f4b942', '#4b2e83', '#e76f51', '#9d8df1'] },
    { id: 'genre-punk', name: 'Punk', colors: ['#f5f5f0', '#ff1f5a', '#0b0b0b', '#ffd400', '#00a8e8'] },
    { id: 'genre-dream-pop', name: 'Dream Pop', colors: ['#f3e8ff', '#c3aed6', '#5c4d7d', '#f58fa8', '#a0e7e5'] },
    { id: 'genre-techno', name: 'Techno', colors: ['#0a0a0a', '#39ff14', '#d9d9d9', '#3a3a3a', '#ff2d55'] },
    { id: 'genre-folk', name: 'Folk', colors: ['#efe6d2', '#a3b18a', '#3a4a3f', '#b5754b', '#588157'] },
    { id: 'genre-heavy-metal', name: 'Heavy Metal', colors: ['#0b0b0d', '#8b0000', '#c0c0c0', '#3b3b44', '#ff4500'] },
    { id: 'genre-island-sound', name: 'Island Sound', colors: ['#0f3d2e', '#f6c90e', '#fdfdfd', '#e63946', '#2a9d8f'] },
    { id: 'genre-hiphop-gold', name: 'Hip-Hop Gold', colors: ['#111111', '#d4af37', '#f5f5f5', '#6a0dad', '#ff7f11'] },
    { id: 'genre-ambient-drift', name: 'Ambient Drift', colors: ['#dfe7ec', '#a7bcc9', '#34495e', '#e0c6a8', '#7fa39b'] },
  ] },
] as const satisfies readonly { id: string; name: string; note: string; palettes: readonly { id: string; name: string; colors: FiveColors }[] }[];
export const curatedPalettes = curatedCollections.flatMap(collection => collection.palettes.map(palette => ({ ...palette, colors: [...palette.colors] as FiveColors, collection: collection.id })));
