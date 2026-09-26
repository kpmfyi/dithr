import { patternFamilies, rasterFamilies, matterFamilies, isPattern, isRaster, mechanismFamilies, synthesisFamilies, isMechanism, isSynthesis, intricacyFamilies, isIntricacy, entropyFamilies, isEntropy, damageFamilies, pixelSorterFamilies, departureFamilies, families, presets, allPresets, validateRecipe, type Family, type Parameters, type Recipe } from '../seedbank/recipes.ts';

export type UsageDemo = {
  family: Family; title: string; context: string; category: string;
  purpose: string; placement: string; tuning: string; motion: string;
  animate: boolean; recipe: Recipe;
};

function demo(family: Family, copy: Omit<UsageDemo, 'family' | 'recipe'>, parameters: Parameters, palette?: Recipe['palette']): UsageDemo {
  const original = allPresets.find(item => item.family === family)!;
  return { family, ...copy, recipe: validateRecipe({ ...original, id: `context-${family}`, name: copy.title,
    parameters, palette: palette || original.palette, review: 'candidate', tags: [...original.tags, 'usage demo'] }) };
}

// Presentation recipes are separate from the catalog originals and accepted render batches.
// Physical materials and printed compositions start frozen; digital atmospheres move gently.
export const allDemos: UsageDemo[] = [
  demo('caustics', {
    title: 'The tidal bathhouse', context: 'Hospitality / water feature', category: 'Atmosphere', animate: true,
    purpose: 'Suggest a quiet pool before a visitor reads a word. Caustics give a hospitality identity a recognizable sense of water without needing a video.',
    placement: 'Confine the light to the pool panel. Keep navigation and long copy on the solid, warm deck beside it.',
    tuning: 'Broader folds, a deep teal palette, and slower movement keep the highlights soft enough for a restful arrival.',
    motion: 'Slow ambient motion. Pause when the panel leaves the viewport; use a frozen frame for reduced motion.',
  }, { scale: 3.1, speed: 0.18, intensity: 0.95, detail: 0.56 }, ['#082d32', '#267e7a', '#cfebbb']),
  demo('phosphor', {
    title: 'A signal you can feel', context: 'Music / instrument display', category: 'Interface', animate: true,
    purpose: 'Bring an electronic instrument or audio identity to life with a glowing trace and the feel of a small CRT.',
    placement: 'Inset the shader inside the instrument screen. Keep values and control labels in crisp HTML outside the phosphor field.',
    tuning: 'A dense grille and concentrated green highlight suit a compact display. The trace is procedural, not an audio waveform.',
    motion: 'A continuous signal works here. In an audio product, actual metering should come from audio data in a separate layer.',
  }, { scale: 3.8, speed: 0.55, intensity: 1.05, detail: 0.76 }),
  demo('halftone', {
    title: 'Form & frequency', context: 'Culture / festival poster', category: 'Identity', animate: false,
    purpose: 'Give a culture poster the imperfect energy of overprinted ink. Large type and a cropped pattern carry the identity at a distance.',
    placement: 'Use the texture as a single graphic block. Set dates and essential information on unpatterned paper.',
    tuning: 'A coarser screen, vermilion ink, and warm stock preserve visible dots at poster scale. Freeze a frame before exporting for print.',
    motion: 'Frozen for the printed identity. Play the source study to explore a motion version for a digital event announcement.',
  }, { scale: 3.4, speed: 0.15, intensity: 1.15, detail: 0.4 }, ['#eee0ba', '#d95532', '#262820']),
  demo('ink', {
    title: 'Where water remembers', context: 'Publishing / poetry cover', category: 'Editorial', animate: false,
    purpose: 'Let a single pigment bloom act as a visual metaphor for memory. A restrained editorial composition gives its delicate edges space.',
    placement: 'Place the bloom on the cover, with the title in a clear margin. Match the shader’s paper color to its surrounding stock.',
    tuning: 'Blue-black pigment, a pale paper base, and soft diffusion make the study read as an illustration rather than a full-page backdrop.',
    motion: 'Frozen for a book jacket. A very slow bloom can accompany a digital reading or cover reveal.',
  }, { scale: 3.2, speed: 0.12, intensity: 1.08, detail: 0.72 }, ['#eee8d8', '#829dab', '#1c3c55']),
  demo('iridescence', {
    title: 'An uncommon membership', context: 'Product / digital membership card', category: 'Interface', animate: true,
    purpose: 'Make a small, valuable object feel special. Pearlescent color gives a digital pass a tactile foil finish.',
    placement: 'Clip the shader to the card face. Put the membership number on an opaque strip so its contrast never depends on the moving color.',
    tuning: 'Broad pearl bands, lilac shadows, and warm highlights create a foil impression with little visual noise.',
    motion: 'A slow sheen suits a card reveal. This demo uses time-driven light; pointer-driven tilt can be a separate presentation layer.',
  }, { scale: 2.4, speed: 0.16, intensity: 1.05, detail: 0.48 }, ['#363354', '#c7a6d0', '#f0d5af']),
  demo('shafts', {
    title: 'Room for light', context: 'Arts / exhibition introduction', category: 'Atmosphere', animate: true,
    purpose: 'Build a sense of space around a light-art exhibition. Haze and slanting illumination make a spare title feel architectural.',
    placement: 'Frame the shader with dark columns and reserve a shaded portion for the title. The light is the exhibit, not a texture over body copy.',
    tuning: 'A reduced scale and slow drift let broad beams cross a cool, dark interior without competing with the typography.',
    motion: 'Barely moving haze works for an introductory screen or an ambient installation backdrop.',
  }, { scale: 2.8, speed: 0.15, intensity: 1.3, detail: 0.7 }),
  demo('aurora', {
    title: 'Stay up for the sky', context: 'Travel / northern expedition', category: 'Atmosphere', animate: true,
    purpose: 'Give a northern travel story an unmistakable night-sky moment. A simple horizon turns an abstract light curtain into a destination.',
    placement: 'Layer a dark landscape silhouette over the lower edge. Keep the heading above the brightest curtain and supporting copy on the dark ground.',
    tuning: 'Mint light against deep midnight, with fewer broad folds, makes the curtain the scene’s focal point.',
    motion: 'Use a slow curtain for a travel introduction. A still preserves the same composition for reduced motion.',
  }, { scale: 3.1, speed: 0.2, intensity: 1.2, detail: 0.62 }, ['#080f22', '#4b4675', '#9defc6']),
  demo('moire', {
    title: 'Phase shift / side A', context: 'Music / record artwork', category: 'Identity', animate: false,
    purpose: 'Turn interference into a music identity. Circular cropping makes overlapping screens feel like a physical record with an optical sleeve.',
    placement: 'Keep the line field on the disc and separate artist, title, and track details onto a solid sleeve.',
    tuning: 'Cream and near-black screens use a lower frequency so the pattern remains legible at this size. Inspect the final export at its display size.',
    motion: 'Frozen as record artwork. Optional slow movement gives a digital release a kinetic counterpart; avoid rapid high-contrast motion.',
  }, { scale: 2.1, speed: 0.1, intensity: 1.05, detail: 0.46 }, ['#e5dbc0', '#898568', '#242d27']),
  demo('contours', {
    title: 'Take the long way', context: 'Outdoors / route story', category: 'Interface', animate: false,
    purpose: 'Create a topographic mood for an outdoor route card. Elevation lines provide a useful visual vocabulary for an illustrated journey.',
    placement: 'Draw the route and its markers as a separate SVG layer. Put route statistics on a solid side panel.',
    tuning: 'Muted greens and moderately spaced isolines leave the cream route easy to follow. This is illustrative terrain, not geographic data.',
    motion: 'Keep the map still while reading a route. Animate only for an abstract outdoor identity or transition.',
  }, { scale: 3.2, speed: 0.12, intensity: 0.95, detail: 0.42 }, ['#233e38', '#788664', '#c8c59a']),
  demo('weave', {
    title: 'The fabric of quiet', context: 'Commerce / textile swatch', category: 'Material', animate: false,
    purpose: 'Present warp and weft as a material, close enough to appreciate the crossing threads. A large swatch makes the pattern useful for a textile story.',
    placement: 'Clip the texture to a hanging sample, with a sewn edge and a plain label. Keep product details beside the cloth.',
    tuning: 'Clay, flax, and dark brown replace the original luminous colors. A tighter weave reads as fabric instead of a graphic grid.',
    motion: 'Frozen for a physical textile. Animate the source only when exploring a speculative, luminous fabric.',
  }, { scale: 6.2, speed: 0.12, intensity: 0.95, detail: 0.67 }, ['#463b31', '#a37761', '#dfc79e']),
  demo('dunes', {
    title: 'Elsewhere starts here', context: 'Travel / magazine opening', category: 'Editorial', animate: true,
    purpose: 'Use flowing sand as the opening image of a desert travel story. The abstract landscape supports an editorial mood without pretending to be a destination photograph.',
    placement: 'Treat the shader as an oversized image on the right page. Keep the headline and reading copy on clean, warm paper.',
    tuning: 'Wide crests, fine ripples, and a muted terracotta palette give the spread a sun-warmed sense of scale.',
    motion: 'Very slow drift suits a digital feature. Freeze at the recipe time for a printed spread.',
  }, { scale: 2.6, speed: 0.1, intensity: 1.05, detail: 0.68 }, ['#48362c', '#ba8158', '#ebc799']),
  demo('ripples', {
    title: 'A little less noise', context: 'Wellbeing / visual pause', category: 'Interface', animate: true,
    purpose: 'Give a visual pause a single gentle focal point. Circular waves feel at home inside a lens rather than behind a busy dashboard.',
    placement: 'Mask the water to a circle and leave breathing room around it. Keep session information outside the moving surface.',
    tuning: 'A lower wave sharpness and quieter blue palette reduce the intensity of overlapping rings.',
    motion: 'Slow continuous ripples are the experience. The scene is a visual concept; it does not play audio or prescribe a breathing rhythm.',
  }, { scale: 3.5, speed: 0.22, intensity: 0.95, detail: 0.4 }, ['#102f42', '#427a88', '#adcfcb']),
  demo('starfield', {
    title: 'Somewhere, beyond', context: 'Storytelling / space title screen', category: 'Atmosphere', animate: true,
    purpose: 'Establish depth and scale for a space narrative. Small points of light become meaningful when placed behind a planet horizon and a quiet title.',
    placement: 'Use the starfield as the farthest layer, with the planet and mission annotation above it. Keep important text in the darkest sky.',
    tuning: 'A restrained glow and slow parallax support a cinematic opening without turning the sky into visual noise.',
    motion: 'Subtle drift and twinkle suit a title screen. The horizon and interface stay still so the shader supplies the depth.',
  }, { scale: 4.2, speed: 0.12, intensity: 1.05, detail: 0.4 }, ['#080d1b', '#343954', '#bfd9eb']),
  demo('marble', {
    title: 'Stone, softened', context: 'Commerce / furniture finish', category: 'Material', animate: false,
    purpose: 'Show a mineral pattern on the object it belongs to. A tabletop silhouette communicates scale, edge, and surface much better than a rectangular swatch.',
    placement: 'Clip the shader into an elliptical top, then add a fixed edge, pedestal, and shadow with CSS. Keep the material view separate from dimensions.',
    tuning: 'Pale stone with sage veins and lower contrast gives the surface a convincing furniture finish. This is a flat material mockup, not a 3D render.',
    motion: 'Frozen for stone. The optional animation is useful for exploring vein compositions before choosing a still.',
  }, { scale: 3.1, speed: 0.1, intensity: 0.95, detail: 0.52 }, ['#e7e4d4', '#91a38c', '#495c50']),
  demo('glass', {
    title: 'Light, beautifully divided', context: 'Architecture / decorative window', category: 'Material', animate: false,
    purpose: 'Give the colored cells an architectural role. An arched frame, mullions, and a shaded wall make the pattern read as decorative glass.',
    placement: 'Mask the canvas to the window opening. Frame it with real DOM geometry and keep the studio description on the solid wall.',
    tuning: 'Larger panes, strong seams, and amber-green colors suit a backlit window. CSS supplies the room and cast light around the procedural glass.',
    motion: 'Frozen for an architectural material. Animate only for an imaginative digital installation where moving panes are intentional.',
  }, { scale: 2.7, speed: 0.12, intensity: 1.08, detail: 0.62 }, ['#233e35', '#78936b', '#efd18d']),
  demo('broken-lcd', {
    title: 'Signal / afterimage', context: 'Culture / digital event poster', category: 'Identity', animate: true,
    purpose: 'Give a digital poster the unstable texture of a damaged display. Rapid scanlines sit beneath torn color shapes and dithered afterimages.',
    placement: 'Run the shader across the poster. Set event information in opaque HTML blocks so it remains readable through the flicker.',
    tuning: 'Pale LCD stock, electric blue, and lime define the color zones. Signal detail adjusts the scanline count and contour complexity; intensity adjusts blue afterimages.',
    motion: 'The scanlines flicker quickly while the dithered shapes leave a lingering afterimage. Freeze the recipe for print or reduced motion; keep essential text on opaque blocks.',
  }, { scale: 2.4, speed: 1.4, intensity: 1.1, detail: 0.68 }, ['#f6f8f5', '#0066ff', '#a5ff32']),
  ...pixelSorterFamilies.map(family => {
    const preset = allPresets.find(item => item.family === family)!;
    return demo(family, {
      title: families[family].name + ' / afterimage', context: 'Culture / moving image edition', category: 'Identity', animate: true,
      purpose: families[family].description,
      placement: 'Use the whole surface as a moving print. Keep edition details on opaque blocks above the scanlines.',
      tuning: 'Scale changes the size of contour islands; signal detail changes their complexity; intensity controls dither coverage. The three colors map to paper, afterimage, and signal.',
      motion: 'Persistent pixel transport with irregular local replenishment. A fast scanline carrier sits below coherent afterimages. Pause to select a print frame.',
    }, { ...preset.parameters });
  }),
  ...[...patternFamilies, ...rasterFamilies, ...matterFamilies].map(family => {
    const preset = allPresets.find(item => item.family === family)!;
    return demo(family, {
      title: families[family].name + ' / motion study', context: isPattern(family) ? 'Identity / patterned surface' : isRaster(family) ? 'Music / screen graphics' : 'Editorial / natural motion', category: isPattern(family) ? 'Pattern' : isRaster(family) ? 'Moving image' : 'Atmosphere', animate: true,
      purpose: families[family].description,
      placement: isPattern(family) ? 'Treat the pattern as a surface: packaging, a banner or a section background. Keep text on solid panels in one of its palette colors.' : 'Give the animation a full frame or a generous inset. A compact opaque caption keeps the title readable over the motion.',
      tuning: `Scale sets the size of forms; ${families[family].detail.toLowerCase()} changes their structure; intensity changes accent and afterimage coverage. Every palette role from two to five colors is used.`,
      motion: 'Hard pixels at a fixed simulation rate with events addressed by absolute time. Pause to choose a frame, or export the exact recipe.',
    }, { ...preset.parameters });
  }),
  ...[...departureFamilies, ...damageFamilies, ...entropyFamilies, ...intricacyFamilies, ...synthesisFamilies, ...mechanismFamilies].map(family => {
    const preset = allPresets.find(item => item.family === family)!;
    return demo(family, {
      title: families[family].name + ' / motion study', context: 'Art / kinetic edition', category: 'Moving image', animate: true,
      purpose: families[family].description,
      placement: 'Give the animation a full frame. A compact opaque caption leaves the composition open and keeps the title readable.',
      tuning: isEntropy(family) ? `Scale changes the size of forms; ${families[family].detail.toLowerCase()} adjusts their structure; intensity changes pigment and trace coverage. All three colors remain editable.` : 'Scale changes the spacing of forms; structure changes their density or edge width; intensity changes the coverage of persistent traces. All three colors remain editable.',
      motion: isMechanism(family) ? 'Gapped sorts, automata, crystal growth, datamosh and interlaced fields vary the accumulation process. Fresh events continue along an absolute timeline.' : isSynthesis(family) ? 'Pixel currents and persistent traces affect each other. New local arrivals keep the composition changing. Pause to inspect a frame or export its recipe.' : isIntricacy(family) ? 'Dense incisions, persistent pixel transport and locally interrupted scanlines. Fresh events continue along an absolute timeline without a designed animation loop.' : isEntropy(family) ? 'No scanline carrier. Local births, erasures and changing currents are addressed by absolute time; playback continues beyond one hour without wrapping. Freeze any moment to reproduce it.' : 'Fast continuous movement and persistent image memory, with independently evolving fields. Pause to inspect a frame or export its exact recipe.',
    }, { ...preset.parameters });
  }),
];

export const demos = presets.map(recipe => allDemos.find(demo => demo.family === recipe.family)!);
export const findDemo = (family: string | null) => allDemos.find(item => item.family === family);
