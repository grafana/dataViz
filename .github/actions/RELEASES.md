# Plugin releases

**Status: implemented, not yet run.** `release-please.yml` runs on pushes to `main`; it needs the
prerequisites at the end of this file before its first real run. Only `grafana-relations-panel` is
configured so far.

A release is a **GitHub release** with the signed plugin zip attached. Releasing does **not** publish to the
grafana.com catalog; that stays a separate, later step. The first plugin to release this way is
`grafana-relations-panel`.

## How a release happens

1. A PR with a conventional title (`feat(relations): …`, `fix(relations): …`) is squash-merged to `main`.
2. `release-please.yml` opens or updates that plugin's **release PR**, e.g.
   `chore(main): release grafana-relations-panel 0.2.0`, with the version bump and the new CHANGELOG
   entries.
3. Approving and merging the release PR creates the tag `grafana-relations-panel/v0.2.0` and a **draft**
   GitHub release, with that CHANGELOG section as its notes.
4. The same workflow builds the plugin from the tag, signs it, packages
   `grafana-relations-panel-0.2.0.zip` with checksums, validates it, attests its provenance, and attaches the
   files to the draft.
5. A maintainer checks the draft and publishes it.

**One plugin or all of them:** every plugin gets its own release PR. Merge one to release that plugin;
merge several, or all of the open ones, to release them together. A plugin with no releasable changes can
be forced with a `Release-As: x.y.z` footer on a commit that touches its directory.

Only `feat` and `fix` commits (and breaking changes) open a release PR. `chore`, `ci`, `docs` and similar
open none on their own, but are listed in the next release's notes when they touch the plugin's directory.

## Versions and tags

Each plugin's version is the `version` in **its own `package.json`**, which its build writes into
`plugin.json` (`%VERSION%`), the usual plugin convention. Tags are `<plugin-id>/v<version>`, the same
`<name>/v<version>` form `grafana/plugin-ci-workflows` uses for its own releases.

`grafana-echarts` publishes two plugins, so the relations panel has a `package.json` of its own in
`src/modules/relations/`, next to its own `CHANGELOG.md`. It is not a workspace package; it only carries
the panel's version. The app keeps the echarts package's `package.json`.

**Shared code caveat:** release-please decides which plugin a change belongs to by the files it touches,
using the most specific directory. A change only in echarts' shared `src/lib`, which the relations panel
also compiles, counts toward the app, not relations. When such a change should ship in relations, the PR
also adds a line to the relations CHANGELOG, or uses a `Release-As:` footer.

## What it reuses

As much as possible comes from `grafana/plugin-ci-workflows`, which uses release-please for its own
releases and recommends it to plugin repos. Where its pieces assume one plugin per repo, they are copied
into local actions with the same interface plus only what the monorepo needs, so they can be upstreamed:

| local action | from plugin-ci-workflows | adds |
|---|---|---|
| `release-please` | `actions/plugins/release-please` | inputs for the GitHub App and config files; all of release-please's outputs as one JSON output; no checkout |
| `plugin-package` | `actions/internal/plugins/package` (sign + zip) | universal zip only (no backends here); `@grafana/sign-plugin` pinned |
| `plugin-validator` | the validator step in `ci.yml` | packaged as an action, with the same image, arguments and default config |

It also reuses this repo's `discover-plugins`, `setup-workspace` and `scripts/build-target.sh`, which checks
that the built `plugin.json` carries the tagged version. `scripts/release-matrix.sh` matches each released
package to its build target: a package's `component` in `release-please-config.json` is its plugin id. The
draft release and its notes come from release-please. Attaching the zip uses `softprops/action-gh-release`,
as `cd.yml`'s GitHub release job does; it keeps release-please's notes and the draft state.

**Adding a plugin:** a package entry in `release-please-config.json` (`release-type: node`, `component` = the
plugin id), its current version in `.release-please-manifest.json`, and a `CHANGELOG.md` next to its
`package.json`.

## Design rules

- **The job that writes to the release builds nothing.** Building and signing run in a job that can only
  read the repo. A separate job holding `contents: write` only downloads that job's artifact and attaches
  it, the same split as the PR-comment jobs in Plugin CI.
- **The signing token comes from Vault**, the same secret `plugin-ci-workflows` uses
  (`plugins/sign-plugin-access-policy-token`), never from a repo secret.
- **Release PRs and tags are made with a GitHub App token** (`grafana-plugins-platform-bot`, permission set
  `release-please`, as upstream's action uses), so they trigger CI
  and their commits are signed, which the repo requires on every branch.

## Before it can run

- **Squash merge**, with the PR title as the commit message, so each PR is one changelog entry.
- **A GitHub App grant** for `grafana-plugins-platform-bot` on `release-please.yml`, permission set
  `release-please` (contents, pull-requests and issues write), in deployment_tools
  `terraform/repositories/dataViz/github-app-configs/config.yaml`. dataViz has no grants there yet, so no
  App token works in this repo today.
- **Vault access** for this repo to the signing token, which other plugin repos already read.
