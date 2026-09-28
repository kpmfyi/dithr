# Palettes

Dithr includes **1000 palettes in 25 collections**. Every palette has five roles:

| Role | Purpose |
| --- | --- |
| Ground | Background field |
| Accent | Motion memory and afterimages |
| Ink | Primary forms |
| Body | Secondary forms |
| Trace | Secondary afterimages |

Every study supports 2–5 active colors. Reductions keep the first N roles and the
renderer folds the remaining roles into them. Original three-color recipes retain
their original rendering path. Recipes store actual hex colors, so saved designs
and exports do not depend on later changes to the palette library.

## Choosing colors

The palette drawer filters by collection, name/hex search and computed vibes:
light/mid/dark, muted/balanced/vivid, and warm/cool/neutral. Choices within a vibe
group are alternatives; different groups intersect. The matching palettes also
define the palette roll pool.

You can edit hex colors, lock individual slots, rotate hue or shuffle roles.
Growing a custom palette adds colors related to its existing hue families while
seeking perceptual separation. Locks survive rolls; manual edits override them.

## Library structure

The library combines 12 signature palettes, 44 OKLCH structures across 18 hue
anchors, and 196 hand-authored palettes. Structures define all five roles using
hue offsets, perceptual lightness and gamut-limited chroma. Hand-authored
collections include Mood, Hours, Weather, Cinema, Genre, Machines, Movements,
Materials, Now, Glitch, Circuits, Signage and Cartography.

## Validation

The library tests require unique IDs, names and unordered color sets; at least
5:1 luminance range for five-color palettes; and pairwise OKLab ΔE of at least
0.085. Original signature triplets have a 3:1 luminance-range gate. These checks
separate shader pigments; they do not certify text accessibility or guarantee
that every palette suits every composition.

Run `npm test` after changing the library. Changes to pigment mapping also need
`npm run test:palette-sizes` with a preserved baseline bundle.

## Source

- `src/workbench/palettes.ts`: structures, signatures, completion, vibes and filters.
- `src/workbench/oklab.ts`: color conversion, gamut limits and perceptual distance.
- `src/workbench/mood-palettes.ts`, `curated-palettes.ts`, `studio-palettes.ts` and
  `logic-palettes.ts`: hand-authored collections.
