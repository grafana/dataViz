# Plugin metadata checklist when bringing a plugin into this monorepo

Applies to **both** ways a plugin arrives here:

- imported from an external repo (see `import-external-plugin.md` for the git
  mechanics), or
- extracted out of `grafana/grafana` core.

`src/plugin.json` ships inside the published artifact. Its values are
user-facing in two separate surfaces — the grafana.com catalog page **and**
Grafana's own in-app plugin details page (`PluginDetailsPanel.tsx`). Nearly
every mistake here fails **silently**: the plugin still builds, still publishes,
and simply shows fewer links than intended.

## 1. Link names are matched, not declared

`info.links[].name` has five reserved values:

`documentation`, `repository`, `license`, `raise issue`, `sponsorship`

(Schema: `docs/sources/developers/plugins/plugin.schema.json` in
`grafana/grafana`.)

**The mapping happens server-side at grafana.com during publishing, not in
Grafana.** Grafana's frontend just reads `repositoryUrl` / `licenseUrl` /
`documentationUrl` / `raiseAnIssueUrl` / `sponsorshipUrl` off the *remote*
grafana.com API response. So you cannot tell from Grafana's source whether a
name will match.

Matching is **case-insensitive and substring-based**, which means a plausible
name can quietly map to nothing. Observed 2026-08-15:

| plugin | link names | fields grafana.com produced |
|---|---|---|
| `business-text` | `Documentation`, `Repository` | `documentationUrl`, `repositoryUrl` |
| `grafana-clock-panel` | `Project site`, `MIT License` | `licenseUrl` only — **no repository** |
| `grafana-polystat-panel` | `Project site`, `Apache-2.0` | **neither** |

`MIT License` matched because it contains "license". `Apache-2.0` and
`Project site` matched nothing, so both those plugins ship with missing links
on their details page. **Use the exact reserved names** rather than relying on
substring luck.

Verify what is actually published — do not assume:

```bash
curl -s https://grafana.com/api/plugins/<plugin-id> \
  | jq '{url, repositoryUrl, licenseUrl, documentationUrl, raiseAnIssueUrl}'
```

(A separate top-level `url` field is populated from the publishing repo,
independent of `links` — so `url` looking right does **not** mean
`repositoryUrl` is set.)

## 2. Where `documentation` should point

Three different answers depending on the plugin's origin. Pick deliberately.

### a. Extracted from `grafana/grafana` core

Its docs live in the core docs site and **stay there** — they do not move with
the code:

```text
https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/<slug>/
```

Consistent across every core panel checked (canvas, geomap, barchart, piechart,
state-timeline, candlestick, heatmap). Canvas's entire link set in core is:

```json
"links": [
  { "name": "Raise issue",   "url": "https://github.com/grafana/grafana/issues/new" },
  { "name": "Documentation", "url": "https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/canvas/" }
]
```

**Two traps when extracting a core panel:**

1. **The plugin directory name is often not the docs slug.** Copy the URL from
   the panel's existing core `plugin.json`; do not build it from the directory
   name.

   | plugin dir | docs slug |
   |---|---|
   | `barchart` | `bar-chart` |
   | `piechart` | `pie-chart` |
   | `canvas` | `canvas` |

   (Docs source lives at
   `docs/sources/visualizations/panels-visualizations/visualizations/<slug>/index.md`
   in `grafana/grafana` — note the doubled `visualizations` segment.)

2. **Core panels carry no `repository` or `license` link**, because they live in
   `grafana/grafana`. Extraction means *adding* those, not repointing them.

### b. The repo publishes its own docs via Grafana's plugin CD

`grafana/plugin-ci-workflows/.github/workflows/cd.yml` takes a
`docs-source-directory` input (default `docs/sources`) and a `docs-only` flag.
Its `docs/publish` action clones `grafana/website` and opens an automated PR
placing content at:

```text
content/docs/plugins/<plugin-id>/latest  ->  https://grafana.com/docs/plugins/<plugin-id>/latest/
```

Only applies if the repo actually has a `docs/sources/` tree. A flat `docs/*.md`
(as in `grafana-polystat-panel`) does **not** qualify — that URL 404s.

### c. Neither — the catalog page renders the packaged README

This is `grafana-clock-panel`'s case. Point `documentation` at:

```text
https://grafana.com/grafana/plugins/<plugin-id>/
```

This is **not** circular with the catalog, a mistake worth not repeating: these
links render in Grafana's *in-app* plugin details page, a different surface from
grafana.com. `grafana/business-text` does exactly this.

Confirm the target has real content before using it — a 200 only proves the
page exists:

```bash
curl -s https://grafana.com/api/plugins/<plugin-id> | jq -r '.readme | length'
```

## 3. What does *not* need changing

`screenshots[].path` and `logos.*` are **relative to the packaged `dist/`**, not
URLs. Webpack copies `src/img/` into `dist/img/`, so the zip is self-contained
and a monorepo move does not affect them. Confirmed against the schema, against
`polystat` and `business-text`, and against what grafana.com serves.

Do not "fix" these into absolute URLs. Verify instead:

```bash
python3 -c "
import json,os
d=json.load(open('src/plugin.json'))
for s in d['info']['screenshots']:
    print(('OK ' if os.path.exists(os.path.join('dist',s['path'])) else 'MISSING'), s['path'])
"
```

## 4. No comments in plugin.json

The schema sets `additionalProperties: false` at **both** the root and `info`,
so a `"//"`-style comment key fails metadata validation. Track TODOs in
`DEVELOPING.md` or a command doc instead.

## 5. Validate before publishing

```bash
# from the plugin package, after a build
rm -rf /tmp/pv && mkdir -p /tmp/pv && cp -r dist /tmp/pv/<plugin-id>
(cd /tmp/pv && zip -qr archive.zip <plugin-id>)
docker run --rm -v /tmp/pv/archive.zip:/archive.zip \
  grafana/plugin-validator-cli -analyzer=metadatavalid /archive.zip
```

Exit 0 with no output means valid. This is the same analyzer the stock publish
workflow runs.

## 6. Repo-specific gotchas

- **`grafana/dataViz` is internal**, so every `github.com/grafana/dataViz` URL
  404s for end users until the repo is made public. That has to land before a
  plugin is next published. Check with an unauthenticated
  `curl -s -o /dev/null -w '%{http_code}' -L <url>` — a logged-in browser will
  mislead you.
- **Do not make published artifacts depend on a repo being archived.** An
  archived repo stays readable today but may later be removed or made private;
  host the LICENSE and other linked assets here instead.
- **Keep the plugin's own `packageManager` field.** It looks redundant with the
  workspace root, but Grafana's shared CD workflow reads it from the *plugin's*
  `package.json` — see `DEVELOPING.md`.
