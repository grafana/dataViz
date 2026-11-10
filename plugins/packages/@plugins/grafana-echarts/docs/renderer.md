# Renderer

The Renderer is one ES module that draws a viz spec with the panels of this package. A viz spec is a JSON document that holds one panel and the data of its queries. The App of [grafana/mcp-grafana](https://github.com/grafana/mcp-grafana) loads the Renderer in an MCP Apps sandbox iframe. That iframe has no network and no Grafana server.

The rules come from the viz contract 1.2.0, the `@grafana/viz-contract` npm package from [grafana/viz-contract](https://github.com/grafana/viz-contract). The package is a dependency in `package.json`, so `pnpm install` gets it. This repository has no copy of the contract. The source code is in `src/renderer/`.

## The module

The module has three exports. Their types are in `renderer-api.d.ts` of the contract package (`@grafana/viz-contract/renderer-api`).

| Export                      | Value                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `version`                   | The semver of the Renderer. It is the `version` of the package `package.json`.           |
| `specVersions`              | The viz spec versions that the Renderer supports, from `src/renderer/specVersions.json`. |
| `render(el, spec, options)` | Draws `spec` into `el` and returns a handle at once.                                     |

`render` throws only if `el` is not an `HTMLElement`. A spec that is not correct gives the `error` state. The handle has `update(spec)`, `setRefreshed(ok, error)` and `destroy()`. The App gives two callbacks in `options`:

- `onState` receives each new final state: `ready`, `no-data` or `error`, with the notices. The same state is in the `data-viz-state` and `data-viz-error` attributes of `el`.
- `onRefresh` receives a request when the user clicks Refresh or selects a time range. The Renderer shows Refresh and the time picker only when the App gives `onRefresh`.

## Peers

The Renderer does not bundle React or the Grafana UI packages. The App gives them, and the bundle imports them with bare specifiers:

- `react` and `react-dom`
- `@grafana/ui`
- `@grafana/data`
- `@emotion/css`

The build writes a `package.json` next to the bundle. Its `peerDependencies` list these packages, with caret ranges of the versions in the package `package.json`. All other code is in the bundle, for example ECharts, rxjs and `@grafana/i18n`. Four small modules of `@grafana/runtime` are in the bundle too, and no Renderer code calls them.

## Build

Run these commands in `plugins/packages/@plugins/grafana-echarts`. Install the workspace first with `pnpm install` in `plugins/`.

1. Run `pnpm run build:renderer`. Webpack writes `dist-renderer/renderer.js`, then `scripts/renderer-manifest.mjs` writes `renderer.manifest.json` and `package.json` next to it.
2. Run `pnpm run check:renderer`. The script builds the bundle again with webpack stats, and then makes sure that the bundle and the manifest obey the contract.

The bundle is one file with no chunks, because the sandbox iframe cannot load a second file. `webpack.renderer.config.ts` is the webpack configuration. It does not extend `.config/webpack`, because that configuration makes an AMD plugin bundle.

The manifest has `version`, `sha256` (the hash of `renderer.js`), `contractVersion` and `specVersions`. `check:renderer` makes sure of these facts:

- The `sha256` of the manifest is the hash of the bundle.
- The fields of the manifest have the values of their sources.
- Each bare import is a peer, and the bundle has no copy of a peer.
- The bundle has no `eval` and no dynamic `import()`.
- The bundle has only the four known `@grafana/runtime` modules.

The script also reports the gzip size of the bundle. The contract constant `maxBundleGzipBytes` has no value yet, so the size does not fail the check. If the constant gets a value, the check fails when the bundle is larger. Use `node scripts/check-renderer-bundle.mjs --no-build` to check the files that are in `dist-renderer/` now. That mode skips the two checks that need the webpack stats.

## Tests

The Jest tests are in `src/renderer/`, and `pnpm run test:ci` runs them. They read the fixture sets from the installed contract package. A Renderer set is a fixture set that has a `state.json`. `conformance.integration.test.tsx` draws each Renderer set. It makes sure that the last `onState` value is equal to the `state.json` of the set.

The sandbox test is in `tests-renderer/`. It draws the Renderer in `<iframe sandbox="allow-scripts">` with the default content security policy of MCP Apps, and Playwright blocks all network requests. The test App in `scripts/renderer-harness/app.mjs` bundles the peers with the built Renderer, as the App of mcp-grafana does. Run it with `pnpm run test:renderer-sandbox`. It needs Playwright Chromium (`pnpm exec playwright install chromium`) and no Grafana server.

`pnpm run renderer:shots` writes a PNG of each fixture set to `.renderer-shots/`. Use it to look at the charts. It is not a test.

The `Renderer` workflow (`.github/workflows/renderer.yml`) runs `check:contract-rules`, `check:renderer` and the sandbox test when a change touches this package. `ci.yml` runs the Jest tests.

## Rule coverage

Each contract rule that the Renderer owns has a test or a check. The test or the check names the rule in a comment, for example `// contract-rule: renderer.7`. `src/renderer/contractRules.json` lists all rule ids of the contract. It puts each id in one of three lists:

- `renderer`: the Renderer owns the rule, and a test or a check names it.
- `notRenderer`: the Source or the App owns the rule, or the rule does not apply to the Renderer.
- `pending`: the Renderer owns the rule, but it does not obey the rule yet. Differences from the contract gives each one.

`contractCoverage.test.ts` fails in these cases:

- A rule in `renderer` has no `contract-rule` comment.
- A comment names a rule that is not in `renderer`. When a pending rule gets a test, move it to `renderer`.
- An id is in two lists, or two times in one list.
- `contractVersion` is not the version of the installed contract package.

The test reads the Jest tests, `tests-renderer/` and each `scripts/*.mjs` file. If you add a test for a rule, add the comment.

The contract package has no contract chapters, so it does not give the rule ids. `pnpm run check:contract-rules` (`scripts/check-contract-rules.mjs`) reads the chapters from the tag of the package version in grafana/viz-contract. It fails if `contractRules.json` does not list each rule id of the chapters, or lists an id that the chapters do not have. It needs network access. It needs no token, but it sends `GITHUB_TOKEN` if it is set, because the GitHub API limits calls with no token to 60 an hour for each IP address. The `Renderer` workflow sets it.

`fixtures.11` is in `notRenderer`: this repository copies no fixture set, so the rule does not apply to it.

## Update the contract

1. Change the version of `@grafana/viz-contract` in `package.json`, then run `pnpm install` in `plugins/`.
2. Set `contractVersion` in `src/renderer/contractRules.json` to the new version.
3. Run `pnpm run check:contract-rules`. Put each new rule id in `renderer`, `notRenderer` or `pending`, and remove each id that it reports as not a rule. Give each pending rule an entry in Differences from the contract.
4. Run `pnpm run test:ci` and `pnpm run test:renderer-sandbox`.

## Differences from the contract

The Renderer does not obey all of the contract yet.

The rules in `pending` of `contractRules.json` came with contract 1.2.0. The Renderer does none of them yet, and no test covers them:

- Title (`renderer.17`): the Renderer does not show `panel.title`. The `title` fixture set draws, and its state equals its `state.json`, but there is no title above the chart.
- Icons (`delivery.8`, `delivery.9`, `delivery.11`, [#162](https://github.com/grafana/dataViz/issues/162)): the build does not write `icons.json` next to the manifest. So no CI check fills the icon cache from it and draws the fixtures with no icon request, and no check reports its gzip size. The App rules `renderer.15` and `renderer.16` use this file.

Each of these differences has a test that fails when the difference is fixed:

- `series-truncated` (`state.10`): The contract draws the series with the largest peak values. The Renderer draws the first 50 series, in the order of the frames and fields. It does this only for the `cartesian` and `stream` families. Its message is "`<omitted>` series are not shown. The first `<maxSeries>` series are drawn." The registry message is not used, because it names the peak values. The constant is `SERIES_TRUNCATED_PATTERN` in `src/renderer/notices.ts`.
- Icons (`renderer.7`, [grafana/viz-contract#1](https://github.com/grafana/viz-contract/issues/1)): `@grafana/ui` `Icon` gets each SVG file from the network. The sandbox blocks the request, so the icons are blank. Grafana core fills the icon cache of `react-inlinesvg` when it starts. Contract 1.2.0 makes the App do the same for its copy of `@grafana/ui` (`renderer.15`), from the `icons.json` of the Renderer build (`delivery.9`, pending). The sandbox test "the icons load with no network request" is marked `test.fail` until the sandbox test fills the icon cache from `icons.json` (`delivery.8`, pending).
- Radar and parallel ([#148](https://github.com/grafana/dataViz/issues/148)): the multivariate panel reads each row as one axis, but the contract reads each number field as one axis. `smoke-radar` gives `panel-error`, and `smoke-parallel` draws its axes transposed. `KNOWN_MISMATCHES` in `conformance.integration.test.tsx` records both.
