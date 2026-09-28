# Contributing to Dithr

Use Node.js 24+ and `npm ci`, then follow the local setup in [README.md](README.md).
Open a pull request against `main` with the problem, resulting behavior and checks
you ran. Do not include credentials, machine paths, deployment configuration or
local render evidence. Run `npm run privacy:check -- --staged` before committing.

Run `npm run verify` for code changes. Changes to exported integrations also need
`npm run test:code-export`; studio changes need the browser check described in
[DEVELOPMENT.md](docs/DEVELOPMENT.md). Chromium is required for browser checks.

Runtime code belongs in `src/seedbank` and must remain independent of React and
browser storage. Preserve saved-recipe compatibility, explicit time and seed
inputs, and both rendering backends. Read [AGENTS.md](AGENTS.md) and [development guidance](docs/DEVELOPMENT.md) before changing effects. Keep technical validation separate from
human aesthetic review, and keep external reference projects read-only.

GitHub Actions validates pull requests without deployment credentials. Merges to
`main` deploy to Cloudflare; contributors do not need hosting access.

Use a GitHub noreply email for public contributions if you do not want to publish
your personal email. Do not include assistant conversation links in commit
messages or pull requests.
