# Releasing plugins

This monorepo ships multiple plugins that version and release **independently**,
so releases are driven by **per-plugin scoped git tags** rather than a single
repo-wide `v*` tag. Pushing a matching tag triggers
[`release.yml`](../../.github/workflows/release.yml), which builds that one
plugin and opens a **draft** GitHub release.

## Tag convention

```
<plugin-id>-v<semver>
```

- `<plugin-id>` is the plugin's `id` from its `src/plugin.json`
  (e.g. `grafana-workspace-panel`).
- `<semver>` is a plain `MAJOR.MINOR.PATCH` version (no leading `v`), which
  **must equal** the `version` field in that plugin's `package.json`.

Examples:

| Tag                              | Plugin                    | Version |
|----------------------------------|---------------------------|---------|
| `grafana-workspace-panel-v1.2.3` | `grafana-workspace-panel` | `1.2.3` |
| `grafana-workspace-app-v0.4.0`   | `grafana-workspace-app`   | `0.4.0` |

The release trigger only matches numeric three-part versions
(`*-v[0-9]+.[0-9]+.[0-9]+`), so pre-release/build-metadata tags
(`-v1.2.3-rc.1`) are intentionally ignored — adjust the trigger in
`release.yml` if you need them.

## Why scoped tags (and not `grafana/plugin-actions/build-plugin`)

create-plugin's `release.yml` uses `grafana/plugin-actions/build-plugin`, but that
action (and its `package-plugin`) has **no working-directory input** and enforces
`tag == v<package.version>` at the repo root. That only works for a single plugin
at the repo root. In this monorepo we instead:

1. Resolve the plugin directory from the tag's `<plugin-id>`.
2. Build just that plugin via Turbo.
3. Verify the tag version matches both `package.json` and the built
   `dist/plugin.json`.
4. Create the draft release with the **same pinned action** build-plugin uses
   internally (`softprops/action-gh-release`).

## Cutting a release

1. **Bump the version** in the plugin's `package.json` (this is what webpack
   substitutes into `plugin.json`'s `%VERSION%`):

   ```bash
   cd packages/@plugins/grafana-workspace-panel
   # edit "version" in package.json, e.g. 1.2.2 -> 1.2.3
   ```

2. **Commit** the bump (and any changelog) to your default branch via the normal
   PR flow.

3. **Tag and push** from the merge commit:

   ```bash
   git tag grafana-workspace-panel-v1.2.3
   git push origin grafana-workspace-panel-v1.2.3
   ```

4. **Watch the release workflow.** It builds, validates, packages
   (`<plugin-id>-<version>.zip` + `.sha1`), runs the plugin validator, and
   creates a **draft** GitHub release with those assets attached.

5. **Publish.** Edit the draft release notes and click **Publish release**. To
   submit to the Grafana plugin catalog, follow the
   [publishing guide](https://grafana.com/developers/plugin-tools/publish-a-plugin/publish-or-update-a-plugin)
   using the attached `.zip` and `.sha1` asset links.

### Version mismatch failures

The workflow fails fast if the tag version does not match. Fix by aligning the
tag with `package.json`:

- `Tag version vX does not match .../package.json version Y` → the tag and
  `package.json` disagree; re-tag or bump `package.json`.
- `Built dist/plugin.json version Z does not match tag version X` → the build did
  not pick up the new version (stale build/cache); rebuild and re-tag.

## Signing (optional)

Releases are **unsigned** by default. See
the [signing guide](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin).

## Related

- [CI / GitHub workflows](../README.md#ci--github-workflows) — how CI is layered
  and how workflow templates are tracked from create-plugin.
