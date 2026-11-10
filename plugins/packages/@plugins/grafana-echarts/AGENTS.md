## Project knowledge

This repository contains a **Grafana plugin**. You must Read @./.config/AGENTS/instructions.md before doing changes.

## Project goals

- Simple, clean, and maintainable code is the top priority.
- The current goal of this project is to support the Apache ECharts library as a panel plugin in Grafana
- This plugins should provide a simple user experience that aligns with core Grafana panels
- Grafana and EChart APIs should be isolated from each other whenever possible, preferably in different directories
- Any usage of Grafana or EChart APIs should contain links to the relevant documentation

## Critical rules

- Push back on the prompter when scope of work conflicts with project goals.
- Ask for permission and clarity whenever ambiguities arise.
- Keep plans small and focused to the task at hand, do not make changes that were not explicitly requested
- Keep one React component in each file.
- Add comments to code, but keep them as concise as possible
- Adhere to data plane frame specifications: https://grafana.com/developers/dataplane/
- Create provisioned dashboards for all new panel functionality, prompt the user to check existing dashboards that can
  be impacted by a change
- Always use eCharts types instead of creating local definitions of the eCharts API.
  See https://echarts.apache.org/handbook/en/basics/import/#creating-an-option-type-in-typescript
- Assume data frames are square (all fields have the same number of values) and the frame length matches the value
  length.
- Don't update the jest snapshots in `*.canvas.test.*` tests!
- One kind of test per file, by name. `*.canvas.test.*`: **only** jest-canvas-mock
  baselines — every test asserts `toMatchCanvasSnapshot` and nothing else belongs there
  (`src/test/suiteShape.test.ts` fails the build otherwise). `*.integration.test.*`:
  renders that assert drawn primitives or compare two renders, no baseline. `*.test.ts`:
  unit tests, no infix. Splitting a claim out of a canvas suite is never scope creep.
- Stay on task & document out of scope context as an issue in https://github.com/grafana/dataViz/issues
- Comments describe the current state, never a superseded one.
- Docs and code comments are written with ASD-STE100 style

## Silent failures in tests and dashboards

- If a `*.canvas.test.*` assertion calls `toMatchCanvasSnapshot`, pass the events through `normalizeCanvasEvents`
  from `src/test/canvas.ts` first. Raw coordinates differ in the last digit between Node versions, so the snapshot
  passes locally and fails in CI.
- If a provisioned relations panel sets an Advanced option, set `"editorMode": "advanced"` in the same panel JSON.
  Without it, `applyEditorModeDefaults` resets every Advanced option, and the panel draws as if the option is not set.
- Do not let a query return columns named both `source` and `target` when the dashboard has its own transformations.
  The relations plugin converts that frame before the dashboard transformations run, and the panel shows "No data"
  with no error. Name the columns `src` and `dst` in the query, and rename them in an `organize` transformation.

## Development environment

The [Docker Ports table in the monorepo README](../../../../README.md#docker-ports) is the single source of truth for
the port of each Docker stack. The user runs their own containers on those ports. Do not stop or reuse them.

1. In a new worktree, run `pnpm i && pnpm run build` to make the `dist` directory.
2. Start a Grafana container that belongs only to your worktree:
   `GRAFANA_PORT=<port> GRAFANA_CONTAINER_NAME=echarts-<task>-<port> pnpm run server`. Use a free port that the Docker
   Ports table does not list.
3. Run `pnpm run build` immediately before each test in a browser. Grafana serves the last build in `dist`, not the
   source files, so a stale build makes a working change look broken.
4. Before each test in a browser, run
   `docker inspect <container> --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}'`. Make sure that the `dist` path
   is in your worktree. Another agent can replace a container with the same name during your session.
5. Run `.canvas` tests with the environment variable `GEN_CANVAS_OUTPUT_ON_PASS=1`. The output gives a link to the
   `jest-canvas-mock-compare-viewer` tool, which shows the snapshots.

Do not set only `GRAFANA_PORT`. The container name then comes from the port, so two worktrees that pick the same port
share one container, and it serves the `dist` of the worktree that started it.

Do not delete the `dist` directory while a container uses it. On macOS, the container keeps the deleted directory and
every plugin file returns 404. If you deleted it, run `docker compose up -d --force-recreate --no-deps grafana` with the
same `GRAFANA_PORT` and `GRAFANA_CONTAINER_NAME`.

## Live dashboard debugging

- Treat a local Grafana URL from the user as an already running instance. Do not start, stop, or restart it unless the
  user asks.
- Local Grafana stacks enable anonymous access by default. Open the dashboard directly. Add a login step only if Grafana
  redirects to `/login`. admin:admin is default user:pass
- Use a real browser to inspect dashboards. `curl` won't work.
- Use the available browser tool first. Otherwise, use the installed Playwright Chromium. A macOS sandbox can fail with
  `MachPortRendezvousServer ... Permission denied`; rerun the browser command with elevated permission.
- A sandboxed command can return `ECONNREFUSED` for a live loopback port. Check the port with `lsof`. If it listens,
  rerun the network or browser command with elevated permission. Use `127.0.0.1` if `localhost` resolves to IPv6.
- Do not wait for `networkidle`; Grafana can keep requests open. Wait for the panel DOM, allow five seconds for queries,
  and scroll each panel into view because Grafana renders panels lazily.
- Capture the dashboard or panel as a PNG and inspect the PNG with an image tool. Also collect browser console errors,
  page errors, and HTTP responses with status 400 or higher.

## Canvas test coverage

    Which relations options a rendered test pins, where the suites live, and what a
    baseline costs: [docs/relations-canvas-coverage.md](docs/relations-canvas-coverage.md)

## Reviewing canvas snapshot changes

    Verify canvas output as images, and show them to the user when reviewing the task — never by reading draw-call JSON.
    1. `npx jest-canvas-mock-compare-viewer`, from this package directory (viewer on :5173, any port-5173 instance works — it takes an absolute `--root`, so one instance serves every worktree)
    2. `node scripts/canvas-shots.mjs --failing` writes one PNG per changed snapshot to `.jest-canvas-mock-compare/shots/` (gitignored). Omit `--failing` for all of them; drop `--root <dir>` in if the payloads are in another worktree.
    3. Read each PNG — a changed snapshot renders Expected | Actual | Diff in one image, so it is the before/after to hand the user. Include the paths in the summary.
    Run it from a checkout with node_modules installed (needs `@playwright/test` + `npx playwright install chromium`).
