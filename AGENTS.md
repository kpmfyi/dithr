# Dithr

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [development guidance](docs/DEVELOPMENT.md)
before making changes. Dithr has 100 active crisp-pixel studies and 1000 palettes.

- Runtime code belongs in `src/seedbank`; it must not depend on React, the viewer,
  browser storage or the hosting framework.
- Recipes are untrusted input. Validate versions, families, finite numeric ranges,
  IDs and colors before rendering or storing. Keep saved recipes and imports
  compatible, including the 15 legacy families. `presets` is the active catalog;
  `allPresets` is the compatibility registry.
- Time and seed are explicit inputs. Avoid wall-clock randomness in effects.
- Preserve individually visible pixels: nearest-neighbor feedback, discrete tones
  and stationary coverage dithering. Keep persistent detail and ongoing variation.
  A recolored graph is not a new shader.
- Preserve 2–5-color support and the original three-color rendering path. Kit
  graphs must forget within the 128-frame priming window; late-frame CPU values
  sent to the GPU must remain bounded.
- Keep the studio's neutral-gray chrome, Doto display type and palette rails.
  Output preferences are separate from validated recipes. Code exports include
  the scheduler, feedback runtime, exact recipe, editable source and both licenses.
- Run the checks appropriate to the change in `docs/DEVELOPMENT.md`. Technical
  results do not establish aesthetic acceptance. Software rendering is not
  hardware performance evidence. Never overwrite accepted render batches.
- Keep external reference projects read-only. Keep credentials, machine paths,
  hosting configuration and local evidence out of Git. Run the privacy check
  before committing. Do not take over ports used by other projects.

If local maintainer notes are present under `.local/maintainer-notes/`, consult
those before revising existing effects. They preserve design feedback and research
history; a fresh clone does not need them to build or contribute.
