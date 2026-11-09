# clock-panel takeover / cutover runbook

Status as of 2026-08-15. `grafana/dataViz` is taking over `grafana/clock-panel`.
**Upstream will be archived**, with its workflows disabled first so this repo
can take over cleanly. There is no long-term coexistence.

(An earlier plan had upstream staying live indefinitely as a failsafe. That was
superseded — but note the distinction it turned on: archiving kills the *repo*
upstream, **not** the *tooling* upstream. `@grafana/create-plugin` still ships
`.config/` scaffolding updates independently, so `create-plugin update` keeps
working regardless.)

## The one hard rule

**Exactly one repo may write to a given external service at a time.** Both
Crowdin project 36 and the Grafana plugin catalog can only have one writer.
Enabling here before disabling upstream means two writers, which silently
diverges both copies — the failure is invisible until translations or published
metadata are already wrong.

## What is currently dormant, and why

Everything under
`plugins/packages/@plugins/grafana-clock-panel/.github/workflows/` is **inert** —
GitHub Actions only discovers workflows at the repo root, and `paths:` filters
cannot change that (they only scope an already-discovered root workflow).

| workflow | state | blocker |
|---|---|---|
| `i18n-verify.yml` | **revived** at `.github/workflows/clock-panel-i18n-verify.yml` | none — no secrets, no external writes |
| `i18n-crowdin-upload.yml` | dormant | Vault secret + upstream must disable first |
| `i18n-crowdin-download.yml` | dormant | as above. **Most dangerous to double-enable** — both repos would take translation PRs and drift apart |
| `i18n-crowdin-create-tasks.yml` | dormant | as above (lower risk: only mutates Crowdin task state) |
| `publish.yml` | dormant | Vault/OIDC + `plugin-directory` wiring |

The three Crowdin workflows are bound to the *source repo's* identity, not the
plugin's code, so they cannot be mechanically ported:

- **Vault path is repo-namespaced**: `ci/repo/grafana/clock-panel/grafana-frontend-crowdin-token`.
  Auth is OIDC, so the token's subject includes the repo — copying the path is
  not enough, dataViz's identity must be explicitly authorized. The *value* is
  per-repo too: same secret name everywhere, different Crowdin token in each,
  each scoped to only that repo's project. See cutover step 1.
- **Crowdin project id 36** and **GitHub project board id 76** are upstream's.
- `grafana-pr-automation` GitHub App must be installed on dataViz, and
  `runs-on: ubuntu-x64` is a self-hosted runner label this repo may not have.

## Cutover order

1. **Start now — has human lead time.** Provision Vault secret
   `ci/repo/grafana/dataViz/grafana-clock-panel-crowdin-token` and authorize
   dataViz's OIDC identity. See `grafana-engineering:vault-add-secret`.

   **Only Frontend Platform can do this — ask in `#grafana-frontend-platform`.**
   It is not clock-panel's token moved or copied. Following Frontend
   Platform's internal plugin i18n doc, every repo gets its own Crowdin token,
   named `<repository-name>-github-actions`, granted Languages: Read +
   Projects: Read and write, and scoped by granular access to that repo's
   project only. The shared name
   `grafana-frontend-crowdin-token` is a convention across ~20 single-plugin
   repos, not a shared value — so `get-vault-secrets`' `common_secrets` input
   (`ci/data/common/<path>`) is the wrong mechanism here; `repo_secrets` is
   correct.

   **This repo does not use that convention name**, because it cannot: the name
   identifies the bot account's owning team, so it cannot distinguish one
   package's project from another's in a monorepo. The `discover` action
   derives `<plugin id>-crowdin-token` per package instead, and refuses to run
   if two packages resolve to the same path. So clock-panel's is
   `grafana-clock-panel-crowdin-token`, and each future import gets its own.

   So the ask is a token named `dataViz-github-actions` scoped to the
   **existing** project 36. The doc's procedure assumes a brand-new Crowdin
   project, which this is not — do not create a second project. Clock-panel's
   own token keeps working until step 3 and should be revoked after it, not
   before, or upstream's workflows break while they are still the source of
   truth.

   The path is written two ways and both are right: you type
   `repo/grafana/dataViz/grafana-clock-panel-crowdin-token` into the `ci`
   secrets engine in the Vault UI, and KV v2 injects `/data/`, giving the
   `ci/data/repo/...` form that `get-vault-secrets` resolves at run time.

   Because tokens are scoped per project, a second i18n package here with a
   different Crowdin project needs its own secret rather than sharing this one.
   That needs no workflow change: the path is derived from the plugin id, and
   `x_dataviz.vault_secret_path` / `vault_secret_key` override it per package.
2. **Make `grafana/dataViz` public.** Every `github.com/grafana/dataViz` URL in
   `src/plugin.json` (`repository`, `license`, `raise issue`) 404s until then.
   Must land before the plugin is next published.
3. **Upstream disables its three Crowdin workflows and `publish.yml`.**
4. **Enable them here** — copy to the repo root, path-scope to
   `plugins/packages/@plugins/grafana-clock-panel/**`, and swap `npm ci` for
   pnpm (`pnpm install --frozen-lockfile` + `pnpm --filter <pkg> run <script>`).
   Keep the real logic in the package's own `package.json` scripts so only thin
   plumbing lives at root — that also minimizes what has to be rebuilt if the
   package is ever ejected back out.
5. **Archive upstream.**

Note `paths:` filters only work for `push`/`pull_request`. The download and
create-tasks workflows are `schedule`-triggered, so they cannot be path-scoped —
what scopes them is `crowdin.yml`'s file mapping, whose paths are
package-relative and will need adjusting for the monorepo layout.

## Publishing

Grafana's shared `plugin-ci-workflows/.github/workflows/cd.yml` **does support
monorepos** — it takes a `plugin-directory` input, and pnpm is a supported
package manager (there is a `simple-frontend-pnpm` fixture in that repo).

Verified blocker already fixed: its setup action passes
`package_json_file: <plugin-directory>/package.json` to `pnpm/action-setup`,
which hard-errors with `No pnpm version is specified` if the plugin's own
`package.json` lacks a `packageManager` field. That field was restored for this
reason — see `CLAUDE.md`.

**Unverified:** whether `pm-detect --working-dir <plugin-directory>` walks up to
find `plugins/pnpm-lock.yaml`. Only a real publish run will confirm.

## Open TODOs

- [ ] `src/plugin.json`'s `documentation` link points at the grafana.com catalog
      page as a **placeholder**. It renders the packaged README (~6.9KB of real
      content, so it is not a stub), but swap it for proper docs when they
      exist. The TODO cannot live in `plugin.json` — the schema sets
      `additionalProperties: false`. See `plugin-metadata.md`.
- [ ] Two stock workflows at the repo root (`cp-update.yml`, `release.yml`)
      are untracked and carry zizmor findings (unpinned actions). Invisible to
      CI while untracked; they will fail the moment they are committed. Both
      assume a plugin at the repo root, so neither works here as-is. (The other
      two stock files, `bundle-stats.yml` and `is-compatible.yml`, were deleted:
      `plugin-bundle-stats.yml` and `plugin-ci.yml` cover them.)
- [ ] Decide whether to eject clock-panel's `.config/` scaffolding onto
      `.shared/`. The archive decision unblocked this — see `CLAUDE.md` for
      what `.config/` still drives.
