# `.config-reference` — create-plugin update target

This is **not** a shipped plugin and is **not** part of the pnpm workspace, Turbo
pipeline, or Biome lint set. It is a pristine `@grafana/create-plugin` scaffold
whose only job is to be a target for `create-plugin update`, so the monorepo can
absorb upstream `.config` changes without running the updater against every
package.

`@grafana/create-plugin` has no monorepo support, so instead of running `update`
per package we:

1. Run `create-plugin update` **here** to refresh this directory's `.config/`,
   `package.json`, and related files to the latest create-plugin release.
2. Run `pnpm sync:config` (see `plugins/scripts/sync-config.mjs`) to copy the
   compat-sensitive subset (`webpack/`, `bundler/`, `types/`, `tsconfig.json`,
   `.cprc.json`) from `.config-reference/.config/` into the vendored
   `plugins/.config/`.
3. Review the printed diff, then run `pnpm build` / `pnpm type-check` across the
   workspace before committing.

From `plugins/`:

```bash
pnpm update:config   # runs create-plugin update inside this directory
pnpm sync:config     # copies the reviewed subset into plugins/.config
```

## Why the whole `.config/` lives here but only a subset is vendored

The monorepo deliberately vendors only the parts of create-plugin's `.config`
that are compat-sensitive and frequently updated (webpack + tsconfig + type
shims + the bundler helpers they import). Biome, Vitest, and Turbo are
monorepo-native, so create-plugin's ESLint/Prettier/Jest/Dockerfile/rspack files
are kept **only** here as a faithful update target and are never synced into
`plugins/.config`.

## Version

The pinned create-plugin version lives in [`.config/.cprc.json`](.config/.cprc.json).
Bump it intentionally via `pnpm update:config` so updates stay deterministic.
