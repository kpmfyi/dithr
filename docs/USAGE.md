# Using Dithr

## Features

- Browse studies and see them in example compositions.
- Adjust geometry, motion, detail, intensity, and user-adjustable 2–5-color palettes (1000 five-color sets, including the hand-authored Mood, Hours, Weather, Cinema and Genre collections).
- Reroll selected settings, lock others, and undo or redo edits.
- Save recipes locally, import/export JSON, and export a frozen PNG.
- Scrub time, step frames and choose composition/output dimensions.
- Export runnable HTML/JavaScript, a React component, TypeScript integration and editable shader sources together.
- Render the same recipe independently of React or the viewer.
- Use WebGPU when available, with an explicit WebGL2 fallback.

Time and seed are explicit inputs. The newer effect families generate ongoing events instead of replaying a fixed animation; supported time ranges are finite. Reproducibility applies within the same rendering environment, not across every browser or GPU.

## Run locally

Requires Node.js 24+ and npm.

```sh
npm ci
npm run build:consumer
npm run build:export
npm run dev
```

Open **http://127.0.0.1:5187/**.

- `/demos` — example compositions and editable recipes
- `/studies/index.html` — static catalog
- `/consumer/index.html` — standalone integration example

No account, API key, or database is needed. Saved presets use browser-local storage. The viewer optionally loads fonts from Google Fonts and falls back to system fonts.

For a production build:

```sh
npm run build
npm start
```

The default production listener is `127.0.0.1:9466`. Deployment configuration is optional and stays local; see [Cloudflare deployment](CLOUDFLARE.md).

## Use the renderer

Copy `src/seedbank` into a compatible TypeScript project and install `three@0.185.1`, or import it from this checkout:

```ts
import { createSeedbank, presets } from './src/seedbank';

const study = await createSeedbank(canvas, presets[0], 'auto');
study.resize(960, 640);
study.render(3.25); // explicit time in seconds

study.setRecipe(presets[1]);
const png = await study.capture(); // recipe's frozen time
study.dispose();
```

The consumer owns animation scheduling, visibility, pause, and reduced-motion behavior. The renderer owns its GPU resources and validates recipes before use. Runtime code has no dependency on React, viewer state, or browser storage.

`presets` exports the active catalog; `allPresets` also includes archived effects. Recipes store the family, generator version, seed, parameters, palette, and frozen time. See [the standalone example](../examples/consumer) and [studio controls](#studio-controls).

## Validate and render

```sh
npm run verify
npm run batch -- --limit 3 --backend webgl2 --out artifacts/review-webgl2
npm run batch -- --limit 3 --backend webgpu --out artifacts/review-webgpu
```

`verify` checks types, recipe tests, and both builds. Browser checks require a running viewer and Chromium. Set `CHROME_BIN` to its executable and `SEEDBANK_URL` to the viewer origin if needed.

Batches are bounded and resumable. They record recipes, frames, source hashes, rendering environment, and timing methodology in the ignored `artifacts/` directory. Existing `ACCEPTED` entries are protected. Historical evidence is intentionally not distributed; scripts that compare against it require locally generated evidence. See [development checks](DEVELOPMENT.md#checks).

Software rendering is useful for correctness checks, not hardware performance claims. CPU submission timings do not measure GPU execution. Visual acceptance is separate from technical validation.

## Studio controls

Roll changes the study, palette, shape and seed selected by its scope chips.
The Studies and Palettes drawer filters define the corresponding roll pools.
Locks preserve individual values, and undo/redo restores edits and rolls.

Shape controls tune scale, motion, intensity and each study's detail parameter.
Color controls edit and lock 2–5 colors. Frame controls set the aspect ratio,
preview resolution, backend and frozen time.

Sharing copies the full recipe in the URL fragment. Save keeps recipes in this
browser; JSON import/export transfers them between devices. A shared recipe
contains its seed, settings, colors and frozen moment.

Image export uses the frozen moment, with integer pixel scaling up to 8192 px per
side. Video records real-time playback using the browser's supported format.
Code export includes a runnable page, JavaScript/TypeScript/React integrations,
the complete runtime and scheduler, exact recipe, editable sources and licenses.
Feedback studies need that runtime; a fragment shader alone cannot reproduce them.

| Key | Action |
| --- | --- |
| Space or R | Roll selected scopes |
| Left / Right | Previous / next study |
| K | Play / pause |
| F | Full screen |
| Ctrl/Cmd Z | Undo |
| Ctrl/Cmd S | Save |

See [palettes](PALETTES.md) for color selection.

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/seedbank/` | Portable renderer, validation, and shader graphs |
| `app/` | Viewer and controls |
| `examples/consumer/` | Independent HTML/TypeScript integration |
| `catalog/` | Versioned recipes and catalog metadata |
| `public/` | Project-generated shader previews and context images |
| `scripts/` | Rendering and verification tools |
| `docs/` | Usage, development, palette and deployment guides |

Machine configuration, secrets, generated builds, and local research captures are excluded from Git. See [repository hygiene](DEVELOPMENT.md#repository-hygiene) before publishing new material.

Original project code is [MIT licensed](../LICENSE). Dependencies retain their upstream licenses.
