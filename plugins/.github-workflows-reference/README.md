# create-plugin workflow reference (do not edit)

Read-only snapshot of `@grafana/create-plugin`'s GitHub workflow **templates**,
pinned by `manifest.json` (`repo` + `ref`). It exists only so we can review what
upstream CI does and, in particular, track `grafana/plugin-actions/*` version
bumps.

These files are Handlebars templates (`{{ ... }}`) and assume a single plugin at
the repo root, so they are **not** used verbatim. The real, monorepo-adapted
workflows live in the repository-root `.github/workflows/`.

## Refreshing

```bash
# From plugins/: re-fetch the snapshot at the pinned ref and print a drift report
pnpm sync:workflows
```

To track a newer create-plugin release, bump `ref` in `manifest.json` and re-run
`pnpm sync:workflows`, then port any meaningful change (especially action-pin
bumps) into `.github/workflows/*`.

This flow is intentionally **separate** from `update:config` / `sync:config`
(which refresh the vendored `.config/` build base). Workflows and `.config`
track upstream on independent cadences.
