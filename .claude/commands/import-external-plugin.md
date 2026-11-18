# Importing an external plugin repo with history preserved

Procedure used to pull `grafana/clock-panel` into this monorepo at
`packages/@plugins/grafana-clock-panel/`, preserving full upstream git history.

Method: `git filter-repo` (rewrite history into subdir, then merge with
`--allow-unrelated-histories`) rather than `git subtree add`. Chosen because it
produces clean per-commit path rewriting without subtree's merge-commit noise,
and doesn't couple us to `git subtree` for future maintenance.

## Prerequisites

```bash
brew install git-filter-repo
```

**Confirm the actual git repo root before picking the subdirectory prefix —
do not assume it equals your current working directory:**

```bash
git rev-parse --show-toplevel
```

This repo's cwd during dev is often `.../dataViz/plugins`, but the git repo
root is `.../dataViz` one level up. The `--to-subdirectory-filter` path must
be relative to the true repo root (e.g. `plugins/packages/@plugins/<name>`),
not relative to cwd. Getting this wrong silently lands the imported package
one directory too shallow (e.g. `./packages/@plugins/<name>` at the repo
root instead of `./plugins/packages/@plugins/<name>`) — caught by comparing
against an existing sibling package's real path, not by any error.

## Steps

1. Clone the source repo into a scratch location (outside this repo):
   ```bash
   git clone https://github.com/grafana/clock-panel /tmp/clock-panel
   ```

2. Rewrite all history in the clone so every path lives under the target
   subdirectory:
   ```bash
   cd /tmp/clock-panel
   git filter-repo --to-subdirectory-filter packages/@plugins/grafana-clock-panel
   ```

3. Back in this repo, add the rewritten clone as a temporary remote and fetch:
   ```bash
   git remote add clock-panel-src /tmp/clock-panel
   git fetch clock-panel-src
   ```

4. Merge histories without committing yet, so the result can be inspected:
   ```bash
   git merge --allow-unrelated-histories clock-panel-src/main --no-commit
   ```

5. Inspect staged result (`git status`, `git diff --cached`), resolve any
   conflicts, adjust the imported package to fit this repo's conventions
   (package.json name, tsconfig references, webpack config, wiring into root
   tsconfig / jest moduleNameMapper / docker-compose — see `DEVELOPING.md` "Adding a new
   plugin package").

   Work through "What comes along with an import" below — a standalone repo
   carries far more of its own identity than just source code, and almost
   none of it fails loudly when it stops working.

   Then work through `plugin-metadata.md` for `src/plugin.json` itself. Its
   `info.links` encode the *old* repo's location and are user-facing in the
   published plugin, and the link names are matched server-side by grafana.com
   rather than declared — so a wrong name silently produces no link at all.

6. Once satisfied, commit the merge and remove the temporary remote:

   ```bash
   git commit
   git remote remove clock-panel-src
   ```

## What comes along with an import

A standalone repo bakes its own identity into a surprising number of files.
**Almost none of these fail loudly** when they stop working after an import —
they go silently inert, which is worse than an error. Survey all of them
during step 5 rather than discovering them one CI failure at a time.

### Dead weight — only the repo root's copy is ever read

| File | Why it's dead |
|---|---|
| `package-lock.json` / `yarn.lock` | pnpm workspaces use exactly one lockfile, at the workspace root. Delete. |
| `.npmrc` | Merged from the workspace root anyway; a nested copy repeating the same settings is redundant. |
| `renovate.json`, `.github/renovate.json` | Renovate reads exactly one config per repo (root). Nested configs are never discovered or merged. |
| `.github/workflows/*.yml` | GitHub Actions only discovers workflows at the **repo root**. Nested workflow files never trigger — and `paths:` filters can't change that, they only scope an already-discovered root workflow. |

For renovate specifically: if the imported config differs meaningfully
(different grouping, cooldowns, path exclusions), fold the relevant parts into
the root config as scoped `packageRules`
(`matchFileNames: ["plugins/packages/@plugins/<name>/**"]`) rather than
keeping the nested file.

Don't revive a nested CI, e2e, levitate (is-compatible) or bundle-size
workflow: the generic root workflows (`ci.yml`, `plugin-ci.yml`,
`plugin-e2e.yml`, `plugin-bundle-stats.yml`) already run those for every
package they discover. An imported package gets them by matching the
conventions (a `build` script, and for e2e an `e2e` script plus
`playwright.config.ts`), or by adding a `plugin-ci.json` where it doesn't, as
echarts does. See the "Plugin CI" section of `.github/actions/README.md`.

To revive any other nested workflow, copy it to the repo root, add a `paths:`
filter scoping it to the package, and swap `npm ci` for pnpm
(`pnpm install --frozen-lockfile` + `pnpm --filter <pkg> run <script>`). Keep
the real logic in the package's own `package.json` script so only thin
plumbing lives at root — that also minimizes what has to be rebuilt if the
package is ever ejected back out.

### Silently inert — needs porting to a monorepo-native form

- **`packageManager` field** — only the workspace root's value governs corepack.
  A nested one is inert and misleading. Remove it.
- **`overrides` (npm) / `resolutions` (yarn)** — pnpm reads *neither*, and does
  not support per-package overrides at all. Check whether the pin is still
  load-bearing (`git log -S '"overrides"'` to find why it was added), then port
  it to the workspace root's `pnpm-workspace.yaml` using a **parent-scoped
  selector** so its effect stays scoped to the package:
  ```yaml
  overrides:
    <pkg-name>>somedep: 1.2.3
  ```
  Note pnpm 11+ no longer reads the top-level `pnpm` field in `package.json` —
  workspace settings (`overrides`, `allowBuilds`, …) live in
  `pnpm-workspace.yaml`.
- **`engines.node` / `.nvmrc`** — an imported package can force a workspace-wide
  Node bump. Reconcile the root `.nvmrc` and any `Dockerfile` base images.

### Silently skipped — script name and semantics mismatches

Turborepo matches tasks to `package.json` scripts **by exact name**. A package
whose script is named differently simply gets skipped, with no warning and a
green build:

- `typecheck` vs this repo's `type-check` → the package is never type-checked.
- Verify semantics too, not just names: an imported `format` script may be
  `prettier --write` (mutates) where this repo's convention is a **check**,
  with mutation living in `format:fix`. A mutating script in CI silently
  rewrites files instead of failing on drift.

Cross-check every task name in `turbo.json` against each imported script.

### Repo-identity-bound — cannot be mechanically ported

These are tied to the *source repo's* identity, not the plugin's code, and
need real infrastructure decisions (and usually someone with Vault/admin
access). Leave them dead until there's an explicit cutover plan:

- **Vault secret paths** — namespaced per repo
  (`ci/repo/<org>/<repo>/<secret>`). Auth is OIDC, so the subject includes the
  repo; copying the path is not enough, the new repo's identity must be
  authorized. See `grafana-engineering:vault-add-secret`.
- **External service project IDs** — Crowdin project ids, GitHub project board
  ids, etc. Enabling these in the new repo while the old one is still live
  gives the external service **two writers**, which silently diverges both
  copies.
- **GitHub App installations** (e.g. `grafana-pr-automation`) and
  **self-hosted runner labels** (e.g. `runs-on: ubuntu-x64`) — must exist for
  the new repo.

### Branch protection: signed commits

If the target repo requires verified signatures, the imported history will be
unsigned and `git push` is rejected outright. See
`resign-imported-history.md` — plain `git rebase` does **not** work for this.

## Optional: preserving other upstream branches

`git fetch clock-panel-src` also pulls in every other branch from the source
repo (rewritten to the same subdirectory prefix) as remote-tracking refs
(`refs/remotes/clock-panel-src/*`) — not just `main`. Only `main` gets merged
in step 4. Removing the temp remote in step 6 deletes all those tracking
refs; any commits only reachable from them become unreachable and eventually
garbage-collected. They remain on the original upstream repo regardless —
this only affects what's kept locally/in this repo.

**Before removing the temp remote, prompt the user whether they want these
other branches preserved as local branches.** If yes:

```bash
for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/clock-panel-src | grep -v HEAD); do
  name=${b#clock-panel-src/}
  git branch "clock-panel/$name" "$b"
done
```

(Prefixed `clock-panel/` to avoid collisions with existing branch names.)
Do this only on explicit confirmation — default is to let them be deleted
with the temp remote.

## Status

- [x] Confirmed target location: `packages/@plugins/grafana-clock-panel/`
- [x] Confirmed method: `git filter-repo`
- [x] Confirmed `git-filter-repo` installed (`/usr/local/bin/git-filter-repo`)
- [ ] Clone source repo
- [ ] Rewrite history to subdirectory
- [ ] Fetch + merge (no commit)
- [ ] Inspect + adapt to repo conventions
- [ ] Commit merge, clean up temp remote
