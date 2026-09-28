# Developing Dithr

Start with the [local setup](USAGE.md#run-locally) and [contribution guide](../CONTRIBUTING.md).

## Architecture

| Path | Responsibility |
| --- | --- |
| `src/seedbank/` | Portable renderer, shader graphs, recipes and validation |
| `src/workbench/` | Palette library, exploration, sharing, history and code export |
| `app/` | Studio and in-context gallery |
| `examples/consumer/` | Independent renderer integration |
| `catalog/` | Versioned recipes and catalog metadata |
| `scripts/` | Build, rendering and verification tools |

The renderer accepts explicit time and seed inputs and owns its GPU resources.
The caller owns animation scheduling, visibility, pause and reduced motion.
Recipes store actual colors and must reopen independently of future catalog
changes. The 100 active families are in `presets`; the 15 legacy families remain
in `allPresets` for saved recipes and imports.

Keep crisp pixels, persistent forms and active transport when developing effects.
Changing only names or palettes does not create a distinct effect. Palette sizes
of 2–5 must work in both backends without changing original three-color output.
Generator 1.9.0 is required by studies 61–100; additional palette sizes require
1.8.0 or later. Preserve validation of older recipes.

## Studio changes

Keep neutral-gray chrome, palette-derived accents, palette rails and Doto for
headings/display text. Recipes belong in the URL fragment for sharing; output
preferences are separate from recipe validation. Each renderer needs a fresh
canvas when switching backends. Palette-count changes rebuild the graph;
same-count color edits update uniforms without resetting simulation state.

## Checks

```sh
npm run verify
npm run privacy:check -- --staged
```

`verify` checks types, recipes and the consumer, export and viewer builds. Also run:

| Change | Check |
| --- | --- |
| Exported integration or licenses | `npm run test:code-export` |
| Static hosting | `npm run build:static` |
| Palette library | `npm test` |
| Pigment mapping | `npm run test:palette-sizes` with a preserved baseline bundle |
| Studio UI | `node scripts/check-studio.mjs` against a running viewer |

For the studio check, set `SEEDBANK_URL` to the viewer origin and
`STUDIO_EVIDENCE_DIR` to a new ignored evidence directory. Set `CHROME_BIN` if
Chromium is not at the default executable path. The check covers roll/undo,
locks, sharing, saved recipes, image/video/code exports and mobile layout.

Use bounded render batches for effect changes:

```sh
npm run batch -- --limit 3 --backend webgl2 --out artifacts/review-webgl2
npm run batch -- --limit 3 --backend webgpu --out artifacts/review-webgpu
```

For the kit families, start the render lab with `npm run lab` and use
`node scripts/lab/render.mjs <family> <fresh-dir> --palettes --params-sweep --handoff`.
Kit graphs must forget within the 128-frame priming window. CPU values sent to
the GPU must remain bounded at late times.

Some older scripts target previous viewer controls or compare against local
historical evidence. They are research tools, not the current studio test suite;
use the commands above for a fresh checkout.

## Render evidence

Use new directories under ignored `artifacts/`; never overwrite accepted batches.
Record backend, browser, adapter, resolution and timing methodology. Inspect
native pixels, enlarged crops and motion. Technical checks do not establish
human aesthetic acceptance. Software-rendered measurements are not hardware
performance claims, and CPU submission timings are not GPU execution timings.

## Repository hygiene

Keep credentials, local hosting/service settings, assistant sessions, reference
captures, raw render evidence and machine paths out of Git. `.env*`, `.dev.vars*`,
`.local/`, `artifacts/` and generated output are ignored. Public references and
required license notices belong in the repository; external reference projects
remain read-only.

The privacy checker scans tracked content and, without `--staged`, reachable
history. It reports locations/categories without printing secret values. A clean
scan is heuristic evidence, not a guarantee. Prefer GitHub noreply attribution.

Run `npm audit` when changing dependencies. The scoped `image-size` override
patches vinext's pinned dependency; reassess it when upgrading vinext. Keep
Three.js changes separately reviewable because they can change rendering.

[Cloudflare deployment](CLOUDFLARE.md) describes hosting. Contributors do not need
hosting credentials.
