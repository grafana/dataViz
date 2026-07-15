# `plugins/.config` — vendored from `@grafana/create-plugin`

> ⚠️ **Generated verbatim from `@grafana/create-plugin`. Do not edit these files directly.**
>
> To pull upstream changes, run `pnpm update:config` followed by `pnpm sync:config`
> (see `plugins/README.md`), then review the resulting diff before committing.

This directory holds the **compat-sensitive base layer** of the monorepo build config,
copied byte-for-byte from the output of `@grafana/create-plugin`. Keeping it verbatim
lets us cheaply absorb upstream webpack / tsconfig / Grafana-compatibility and security
updates without hand-maintaining a fork.

## What is vendored (and what is not)

Vendored verbatim (do not edit):

- `webpack/` — `webpack.config.ts`, `BuildModeWebpackPlugin.ts`
- `bundler/` — `constants.ts`, `utils.ts`, `externals.ts`, `copyFiles.ts` (imported by the webpack config)
- `tsconfig.json` — the create-plugin TypeScript base
- `types/` — ambient type shims (`*.d.ts`)
- `.cprc.json` — records the create-plugin version this base was generated from

**Intentionally not vendored:** create-plugin's `eslint.config.mjs`, `.prettierrc.js`,
`jest.config.js`/`jest/`, `rspack/`, `Dockerfile`, `supervisord/`, and docker-compose
files. The monorepo uses Biome, Vitest, and Turbo natively instead, and provides its own
Docker harness — so those are deliberately kept out of this base.

## How this base is layered

1. **Layer 1 (this directory):** verbatim create-plugin base — never edited by hand.
2. **Layer 2 (`plugins/.shared/`):** monorepo-wide overrides that extend this base.
3. **Layer 3 (per package):** each plugin's own thin webpack/tsconfig on top.

Because these files are generated, they are excluded from Biome linting/formatting
(see `plugins/biome.json`).
