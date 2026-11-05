# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

Git root is this directory (`dataViz/`), **one level above** `plugins/`. All pnpm/turbo/docker commands run from `plugins/`, not the repo root — don't confuse `cd`-relative paths between the two.

```
dataViz/                    # git root
├── .claude/commands/        # import-external-plugin.md, resign-imported-history.md
├── .github/workflows/       # CI — the ONLY place GitHub Actions discovers workflows
└── plugins/                 # pnpm workspace root — run all commands from here
    ├── .shared/              # shared tsconfig/webpack config
    ├── packages/
    │   ├── @shared/core/               # @shared/core — shared utilities package
    │   └── @plugins/
    │       ├── grafana-workspace-panel/  # template/example panel plugin (this monorepo's build system)
    │       └── grafana-clock-panel/      # imported from grafana/clock-panel (own toolchain, see below)
    ├── provisioning/         # Grafana datasource/dashboard provisioning for docker dev stack
    ├── docker-compose.yaml           # plugin build/watch stack
    └── docker-compose.grafana.yaml   # Grafana instance stack (attaches to the build)
```

This monorepo is scoped to **panel and app plugins only** — no Go backend plugin tooling.

## Commands (run from `plugins/`)

```bash
pnpm install

pnpm build          # turbo build (production, all packages)
pnpm build:dev      # turbo build:dev
pnpm dev            # turbo dev (watch mode)
pnpm test           # turbo test
pnpm test:ci        # turbo test:ci
pnpm lint           # turbo lint (biome)
pnpm lint:fix
pnpm format         # biome format check
pnpm format:fix
pnpm type-check     # turbo type-check (tsc --build, project references)
pnpm check          # format + test:ci + lint + type-check — run before considering work done
```

Single package: `cd packages/@plugins/<name> && pnpm test` (watch) / `pnpm test:ci`, or from `plugins/` use `pnpm --filter <pkg> run test:ci`.

**Every package uses Jest.** There is no Vitest in this repo — each package has its own `jest.config.js` (`@swc/jest` transform, jsdom for the panel plugins, node for `@shared/core`). Panel plugin configs must set `jsc.transform.react.runtime: 'automatic'` to match webpack; source files import React as a type only, so the classic runtime fails at test time with `React is not defined`.

### Local dev stack (Docker, two terminals)

```bash
pnpm run plugin   # terminal 1: docker compose up — builds/watches all plugins into shared dist volumes
pnpm run server   # terminal 2: docker compose -f docker-compose.grafana.yaml up — Grafana on :3001
```

`pnpm run plugin` must be running and have completed its initial build before starting `pnpm run server`. Multiple Grafana instances can attach to the same shared plugin build on different ports/versions simultaneously:

```bash
GRAFANA_VERSION=13.1.0 GRAFANA_PORT=3002 pnpm run server
```

Each invocation is its own Docker Compose project (namespaced by `GRAFANA_CONTAINER_NAME`, derived from `GRAFANA_PORT`), so instances don't clobber each other's data volumes.

## Architecture

- **Ejected build system** — no `@grafana/create-plugin` abstraction. Webpack, TypeScript project references, and Turborepo task graph are all hand-maintained under `plugins/.shared/` and per-package `webpack.config.mjs`/`tsconfig.json`.
- **Turborepo** orchestrates tasks (`build`, `test`, `lint`, `type-check`, etc.) across packages per `plugins/turbo.json`; `build` and `build-types` depend on upstream packages' same task (`^build`).
- **pnpm workspace** covers `packages/*`, `packages/@shared/*`, `packages/@plugins/*` (see `plugins/pnpm-workspace.yaml`).
- **Cross-package imports** use workspace aliases, e.g. `import { something } from '@shared/core'` — backed by `workspace:*` deps plus TS path aliases and webpack aliases in `.shared/webpack-shared.mjs`.
- **Panel plugin entry point** convention (see `grafana-workspace-panel`): `src/module.ts` exports the `PanelPlugin` + options builder, `src/components/<Name>.tsx` is the main render component (`PanelProps`, `useTheme2`), `src/types.ts` holds panel options, `src/plugin.json` holds metadata (`type: panel`).
- **Biome** (not ESLint/Prettier) lints and formats packages built on this monorepo's own toolchain: tabs, single quotes, semicolons, 120 col width, `noExplicitAny`/`noUnusedImports`/`useHookAtTopLevel` etc. as errors. Config at `plugins/biome.json`.

### `grafana-clock-panel` is a special case

Imported wholesale from `grafana/clock-panel` via `git filter-repo` (procedure in
`.claude/commands/import-external-plugin.md`) with upstream git history preserved. It still runs its
**original, separate toolchain** rather than this monorepo's conventions:

- ESLint + Prettier (not Biome) — `pnpm lint`, `pnpm format`
- Its own webpack config under `.config/webpack/`, own `tsconfig.json` extending `@grafana/tsconfig`
- Playwright e2e tests (`pnpm e2e` / `pnpm playwright:test`)
- MIT license (vs. Apache-2.0 for the rest of this repo, from the root `LICENSE`)

Do not assume `biome.json` / `.shared/` conventions apply inside this package unless it has been explicitly migrated onto them. (Jest is *not* a difference — the whole repo uses Jest.)

**Deliberately NOT wired into the root `plugins/tsconfig.json` references**, despite "Adding a new plugin package" saying to: TS project references require `composite: true` on the referenced project. clock-panel's config resolves to `composite` unset and `declaration: false`, and the file that would have to change (`.config/tsconfig.json`) is scaffolded by `@grafana/create-plugin` and marked do-not-edit. Root `tsconfig.json` only exists to help VSCode intellisense, so it isn't worth forcing declaration emit for.

**It keeps a `packageManager` field even though the workspace root has one.** A nested `packageManager` is normally inert — only the root's governs corepack — so it reads as dead weight. It isn't: Grafana's shared plugin CD workflow (`grafana/plugin-ci-workflows/.github/workflows/cd.yml`) supports monorepos via a `plugin-directory` input, and its setup action passes `package_json_file: <plugin-directory>/package.json` to `pnpm/action-setup`, which hard-errors with `No pnpm version is specified` if the field is missing. Keep it in sync with `plugins/package.json`.

**Its scripts are wired to this repo's turbo task names** (`type-check`, not `typecheck`; `format` checks, `format:fix` writes). Turbo matches tasks to scripts **by exact name and silently skips misses** — a renamed script means the package stops being checked, with a green build and no warning.

`src/external/**` (vendored) and `src/locales/**` (Crowdin-generated) are excluded from Prettier via `.prettierignore`, matching eslint's existing `src/external/**` ignore.

### `grafana-echarts` is a special case too

Imported wholesale from `gtk-grafana/grafana-echarts` via the same `git filter-repo` procedure, full
upstream history preserved. Like clock-panel it keeps its **own toolchain** (ESLint + Prettier, own
`webpack.config.ts` at the package root, own `tsconfig.json` extending `.config/tsconfig.json`,
Playwright e2e) and is **not** wired into root `plugins/tsconfig.json` references — its
`.config/tsconfig.json` is create-plugin-scaffolded with `declaration: false` and no `composite`,
same blocker as clock-panel.

Differences worth knowing:

- **It is an `app` plugin** (`type: app`, id `grafana-echarts-app`), not a panel. Grafana requires the
  plugin directory name to equal the plugin id, so the dev-stack mount is
  `echarts-app-dist:/var/lib/grafana/plugins/grafana-echarts-app` even though the package directory is
  `grafana-echarts`.
- **Apache-2.0 licensed**, like the rest of the repo, but with its own `LICENSE` (clock-panel is MIT).
- **Its `jest-canvas-mock` patch lives at the workspace root.** pnpm reads `patchedDependencies` only
  from `plugins/pnpm-workspace.yaml`, never from a package's `pnpm` field, so the patch was moved there
  with a root-relative path while the `.patch` file stayed in the package. Its canvas snapshot tests
  depend on it; if it goes missing they fail as snapshot diffs, not as a missing-patch error.
- **Scripts renamed onto this repo's turbo task names** (`typecheck` → `type-check`,
  `prettier:check`/`prettier:fix` → `format`/`format:fix`), plus a `build:dev` added.
- **`lefthook` was dropped** (config + dep + `prepare` script). A nested hook manager installs hooks
  into the repo-root `.git`, so it would have gated commits for the whole monorepo on one package's
  checks.
- **Its nested `.github/` was removed; CI lives at root** in the generic `plugin-ci.yml` (levitate
  is-compatible per build target, Playwright e2e matrix via `plugin-e2e.yml`) and `plugin-bundle-stats.yml`,
  which run for every package. echarts only differs through its `plugin-ci.json`. The
  `grafana-enterprise@nightly` e2e job is `continue-on-error` (non-blocking); don't make it required. The
  bundle-stats workflow does **not** `uses:` `grafana/plugin-actions/bundle-size` — that action runs
  `pnpm install` at the repo root, which has no `package.json` — so it inlines the action's steps and
  calls its `index.js` report script from a pinned checkout. Bump both pins together. It reports the
  relations panel and the app separately, one comment each. The upstream
  `release.yml` (tag-triggered sign + validate of the standalone Relations build) was replaced by the
  root `release-please.yml` (see `.github/actions/RELEASES.md`), and `cp-update.yml` (create-plugin
  update, which only works on a repo-root plugin) was not ported.
- **It keeps its own `.nvmrc` and `packageManager`**, both synced to the workspace root. Same reason as
  clock-panel's `packageManager`: `grafana/plugin-ci-workflows` `ci.yml` reads
  `<plugin-directory>/.nvmrc` for the Node version (falling back to its own default if absent).
- **Its standalone dev stack (`pnpm run server` inside the package) defaults to port 3020**, not
  upstream's 3001, so it can run alongside the monorepo stack (`pnpm run server` from `plugins/`, on
  3001). `docker-compose.yaml` and the `parity.md` live links assume 3020 (`playwright.config.ts` defaults to the 4001 relations stack, like CI) — change
  them together. Its LGTM stack stays on 3010, standalone Relations on 4001. CI e2e uses the standalone
  Relations stack: `plugin-ci.json` `e2e.url` is 4001, with `e2e.compose` set to `docker-compose-relations.yaml`.
- **Two `plugin.json`s ship on their own:** `src/plugin.json` (the app) and
  `src/modules/relations/plugin.json` (`build:relations` publishes it standalone as
  `grafana-relations-panel`). The standalone panel is versioned on its own: its `%VERSION%` comes from
  `src/modules/relations/package.json` (not a workspace package; release-please bumps it) and it ships
  `src/modules/relations/CHANGELOG.md`. The app keeps the package's own `package.json` and CHANGELOG.
  That `package.json` is also the plugin directory `plugin-publish.yml` hands to plugin-ci-workflows'
  `cd.yml`: its `lint`/`typecheck`/`test:ci`/`build` scripts delegate to the echarts package, and its
  `packageManager` and the `.nvmrc` beside it must stay synced to the workspace root, like clock-panel's. Both use the reserved link names from `plugin-metadata.md`. The other
  `src/modules/*/plugin.json` ship only inside the app.
- **CI builds two plugins from it.** Its `plugin-ci.json` lists `grafana-relations-panel` (`build:relations`)
  and the app, `grafana-echarts-app` (`build`), so root CI, compatibility and bundle stats cover both. The
  two build one after another because both write `dist/`. e2e tests the plugin that ships, the standalone
  relations panel (`e2e.target: grafana-relations-panel`), so its Grafana versions come from
  `src/modules/relations/plugin.json`. Adding another
  standalone module needs a `build:<module>` script **and** webpack support (`--env standalone=<module>`
  currently accepts only `relations`), plus a target entry.
- **It is not yet in i18n CI, and when it opts in it gets ONE Crowdin project, not one per published
  plugin.** A package opts in by having a `crowdin.yml`; echarts has none, no locales, and no
  `i18n-extract:ci` script, so `.github/actions/discover-i18n-packages` ignores it. It does already
  call `initPluginTranslations` and use `t()`, so the runtime half is wired. When it does opt in:
  `files[]` needs one namespace entry per published plugin, because `initPluginTranslations` resolves
  translations by plugin id at run time and each plugin's dist must carry its own
  `<plugin-id>.json` — but all of it belongs to a single project, because 19 of its 21 `t()` calls are
  in `src/lib`, which compiles into every build. Crowdin links identical source strings only *within*
  a project, so splitting by plugin would re-translate every shared string per plugin per locale.
  Full reasoning and both config shapes are in the discover action's header.
- Its `AGENTS.md` / `CLAUDE.md` / `.config/AGENTS/` carry package-local agent rules (canvas snapshot
  workflow, one-kind-of-test-per-file naming enforced by `src/test/suiteShape.test.ts`). They apply
  inside the package.

## Adding a new plugin package

1. Copy the template: `cp -r packages/@plugins/grafana-workspace-panel packages/@plugins/<new-name>`
2. Update: `package.json` `name`; `src/plugin.json` `id`/`name`/metadata; `webpack.config.mjs` `PLUGIN_ID` and `uniqueName`; `tsconfig.json` `paths` alias
3. Add a reference in root `plugins/tsconfig.json`
4. Copy `jest.config.js`, `jest-setup.js`, `jest/mocks/`, and `types/jest-dom.d.ts` from the template. If the plugin imports a workspace package, add it to `moduleNameMapper` (see how `@shared/core` is mapped) — Jest does not read the webpack/TS path aliases.
5. To load it in the Docker Grafana dev stack: add a `dist` volume in `docker-compose.yaml`, mount it in `docker-compose.grafana.yaml`, and add its id to `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS`

## Adding a new shared package

1. `mkdir -p packages/@shared/<name>`, add `package.json` (with `exports`) and `tsconfig.json` extending `.shared/tsconfig.json`
2. Add a reference in root `plugins/tsconfig.json`
3. Add an alias in `.shared/webpack-shared.mjs` if plugins will import it via webpack

## Per-package CI config (`plugin-ci.json`)

CI finds plugin packages on its own; an optional `plugin-ci.json` at a package root only overrides the
defaults (which plugins it publishes, the e2e Grafana URL). What it can contain, what CI runs per package
and how to read a failure are in the "Plugin CI" section of `.github/actions/README.md`. Two rules to keep
in mind when editing one:

- **Listing `targets` replaces the default** (`src/plugin.json` built by `build`). List the default too to
  keep building it.
- A package's targets build one at a time, because they all write `dist/`.

## GitHub Actions workflows

Grafana's org-wide `zizmor` CI check requires every `uses:` action reference in
`.github/workflows/*.yml` to be pinned to a commit hash, not a mutable tag
(`@v6` etc.) — tags can be silently repointed by a compromised upstream. Check
before pushing workflow changes:

```bash
zizmor .github/workflows/
actionlint   # from the repo root; reads .github/actionlint.yaml
```

(`brew install zizmor actionlint shellcheck` if not already installed.) The `actionlint` workflow runs
the same check in CI. It is a separate workflow because a workflow file that is not valid YAML never
starts, and neither does any workflow that calls it, with no failed check to show it. Get a tag's current commit
hash with:

```bash
gh api repos/<owner>/<repo>/commits/<tag> --jq '.sha'
```

and pin as `uses: <owner>/<repo>@<sha> # <tag>`. Don't use `git/refs/tags/<tag> --jq '.object.sha'`:
for an **annotated** tag that returns the tag *object's* SHA, not the commit, and zizmor flags it as an
impostor commit (this is how `pnpm/action-setup@f520ece…` got pinned; its `v6` commit is `0977fd9…`).

**One exception: `plugin-publish.yml` pins `plugin-ci-workflows`' `cd.yml` to a tag**
(`@ci-cd-workflows/vX.Y.Z # zizmor: ignore[unpinned-uses]`). `cd.yml` hard-fails a hash-pinned caller, and
the GCP workload identity it publishes with trusts it only at `main` or a semver tag, so a hash can't work.
Only that repo's release bot can create or move its tags. `.github/tests/workflows.test.ts` allows exactly
that line.

Workflows set up pnpm, Node and `pnpm install` through `.github/actions/setup-workspace`, so the
`pnpm/action-setup` and `actions/setup-node` pins live in one place (i18n workflows aside).

### Testing CI changes locally

Iterate on CI logic locally, and push only to confirm what needs GitHub itself (PR comments, artifacts,
matrix/reusable-workflow fan-out, token scope). Run from the repo root:

```bash
node --test --test-concurrency=1 '.github/tests/*.test.ts'     # run (one file at a time, so output order is stable)
plugins/node_modules/.bin/tsc -p .github/tests   # type-check (after `pnpm install` in plugins/)
```

TypeScript run directly by Node 24, which strips the types, so: erasable syntax only (no `enum`,
`namespace`, parameter properties), `.ts` extensions in imports, and Node does not type-check, so `tsc`
does. A glob, not a directory: Node 24's `--test` doesn't take directories. Local only, not run in CI, no
dependencies. It covers `discover-plugins` (targets, e2e, every validation error, `changed-only` against
temp git repos), the scripts in `.github/scripts/` (with a fake `pnpm` on `PATH`, so no real builds), and
security invariants over every **tracked** workflow and composite action: SHA-pinned third-party
`uses:`, no `${{ }}` inside `run:`, top-level `permissions: {}`, per-job `permissions:`, and no job holding
`pull-requests: write` checks out this repo or runs package or repo code. It also fails if a cached task
in `plugins/turbo.json` narrows its `inputs` without `$TURBO_DEFAULT$`, or if `test`/`test:ci` stop
depending on `^transit` (Jest reads workspace packages such as `@shared/core` from source, so their files
must be in the test hash), or if `build-types` stops declaring its `.cache/tsbuild/**` outputs (a cache hit
restores only declared outputs, and a dependent type-check needs those declarations), since root CI's
persisted turbo cache would then replay stale or missing results.

That's why non-trivial step logic lives in `.github/scripts/*.sh` rather than inline `run:` blocks: a
script can be tested; the workflow keeps only the `env:` wiring. zizmor audits YAML only, so keep those
scripts small. They sit under `.github/`, and the same reviewers apply.

**Jobs that hold a PR write token run no PR code.** `plugin-ci.yml` and `plugin-bundle-stats.yml` each
split into a read-only job that installs, builds and analyzes (PR code, plus unpinned levitate from
npm), and a report job with `pull-requests: write` that checks out nothing from the PR and only turns
the first job's artifact into a comment. Keep that split when adding comment-posting steps.

## Bringing a plugin into this monorepo

Four command docs cover this, in the order you'll need them:

| doc | covers |
|---|---|
| `.claude/commands/import-external-plugin.md` | the `git filter-repo` procedure, and **what comes along with an import** |
| `.claude/commands/resign-imported-history.md` | re-signing unsigned history when branch protection requires verified signatures |
| `.claude/commands/plugin-metadata.md` | `plugin.json` links, docs locations, screenshots, validation |
| `.claude/commands/clock-panel-cutover.md` | the clock-panel takeover runbook + current open TODOs |

**Importing an external repo:** follow `import-external-plugin.md` exactly — it uses `git filter-repo`, not `git subtree`, and notes that the git repo root is one level above `plugins/`, so `--to-subdirectory-filter` paths must be `plugins/packages/@plugins/<name>`, not `packages/@plugins/<name>`.

Its "What comes along with an import" section is the important part — a standalone repo bakes its identity into many files (lockfile, `packageManager`, `.npmrc`, renovate config, nested `.github/workflows`, `overrides`/`resolutions`, Vault paths, external project ids), and **almost none of them fail loudly** when they stop working.

**Either way — external import or extraction from `grafana/grafana` core — read `plugin-metadata.md` before touching `src/plugin.json`.** That file ships in the published artifact and is user-facing in both the grafana.com catalog and Grafana's in-app plugin details page. Its failure mode is silent: `info.links` names are matched *server-side at grafana.com*, case-insensitively by substring, so a plausible-looking name like `Project site` or `Apache-2.0` maps to nothing and the link simply never appears. Where `documentation` should point differs by origin — a panel extracted from core keeps its docs in the core docs site, and the plugin directory name is often **not** the docs slug (`barchart` → `bar-chart`).
