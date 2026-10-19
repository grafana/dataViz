# Grafana dataViz Plugin Monorepo

A template for building Grafana **frontend** plugins (panel and app plugins) in a monorepo structure. It provides a fully ejected build system with complete control over configuration, ideal for teams building multiple related visualization plugins or plugins with shared code.

> Scope: this monorepo targets **panel and app plugins only**. It intentionally does not include Go backend plugin tooling.

## Features

- **Monorepo Architecture** - Multiple plugins and shared packages in one repository
- **Full Build Control** - Ejected webpack and build configurations, no hidden abstractions
- **Modern Toolchain** - Turborepo, pnpm workspaces, SWC, TypeScript, Biome.js (imported plugins keep their own ESLint + Prettier)
- **Panel Example** - Ready-to-copy `PanelPlugin` template (app plugins are supported too)
- **Type Safety** - Strict TypeScript with composite builds and project references
- **Fast Development** - Docker Compose setup with hot reload
- **Testing Ready** - Jest configured for all packages
- **Production Ready** - Optimized builds with caching via Turborepo

## Quick Start

1. Clone this repository:
   ```bash
   git clone <your-repo-url>
   cd dataViz
   ```

2. Install dependencies:
   ```bash
   cd plugins
   pnpm install
   ```

3. Start the development environment:
   ```bash
   # In one terminal: build the plugins once (shared across Grafana instances)
   pnpm run plugin

   # In another terminal: start a Grafana instance attached to that build
   pnpm run server
   ```

   `pnpm run server` starts Grafana on port `3001` by default. To use a
   different port/version, set `GRAFANA_PORT` / `GRAFANA_VERSION` — e.g.
   `GRAFANA_VERSION=13.1.0 GRAFANA_PORT=3002 pnpm run server`. Because the
   plugin build is shared, you can run multiple `pnpm run server` instances on
   different ports/versions at once.

4. Access Grafana at http://localhost:3001
   - A demo dashboard (**Workspace Panel Demo**) renders the panel with TestData
   - The panel plugin is also available in any dashboard's panel picker as **Workspace Panel**

## Docker Ports

Default host ports for every Docker stack in the repo. Commands run from the directory in the **Run from** column. Ports marked with a variable can be overridden (e.g. `GRAFANA_PORT=3005 pnpm run server`).

| Package | Stack | Run from | Service | Host port | Override |
|---|---|---|---|---|---|
| monorepo | plugin build/watch | `plugins/` — `pnpm run plugin` | live reload | `35729` | — |
| monorepo | Grafana (all plugins) | `plugins/` — `pnpm run server` | Grafana | `3001` | `GRAFANA_PORT` |
| `grafana-clock-panel` | standalone | package — `pnpm run server` | Grafana | `3000` | — |
| `grafana-echarts` | standalone | package — `pnpm run server` | Grafana | `3020` | `GRAFANA_PORT` |
| `grafana-echarts` | relations build | package — `pnpm run server:relations` | Grafana | `4001` | `GRAFANA_PORT` |
| `grafana-echarts` | relations build, nightly | package — `pnpm run server:e2e:nightly` | Grafana | `4002` | `GRAFANA_PORT` |
| `grafana-echarts` | LGTM | package — `pnpm run server:lgtm` | Grafana | `3010` | `GRAFANA_PORT` |
| | | | Loki | `3100` | `LOKI_PORT` |
| | | | Tempo HTTP | `3200` | `TEMPO_PORT` |
| | | | Tempo OTLP gRPC / HTTP | `4317` / `4318` | `TEMPO_OTLP_GRPC_PORT` / `TEMPO_OTLP_HTTP_PORT` |
| | | | Prometheus | `9090` | `PROMETHEUS_PORT` |
| | | | Alloy | `12345` | `ALLOY_PORT` |

## Prerequisites

- **Node.js** 24 (see `plugins/.nvmrc`)
- **pnpm** 10 or later
- **Docker** (for the local development environment)

## Repository Structure

```
dataViz/                              # git root
├── .github/                          # CI: workflows, actions, scripts, local tests
└── plugins/                          # pnpm workspace root (run commands from here)
    ├── .shared/                      # Shared build configurations
    │   ├── tsconfig.base.json       # Base TypeScript config
    │   ├── tsconfig.json            # Shared packages config
    │   └── webpack-shared.mjs       # Shared webpack config
    ├── packages/
    │   ├── @shared/                 # Shared libraries
    │   │   └── core/                # Core utilities package
    │   └── @plugins/                # Grafana plugins
    │       ├── grafana-workspace-panel/  # Example panel plugin (template)
    │       ├── grafana-clock-panel/      # Clock panel, imported with its own toolchain
    │       └── grafana-echarts/          # ECharts app plugin; also publishes grafana-relations-panel
    ├── provisioning/                # Grafana provisioning
    ├── docker-compose.yaml          # Plugin build/watch stack
    ├── docker-compose.grafana.yaml  # Grafana instance stack
    ├── package.json                 # Root workspace
    ├── pnpm-workspace.yaml          # pnpm workspace config
    ├── turbo.json                   # Turborepo orchestration
    └── biome.json                   # Linting/formatting config
```

## Customizing for Your Plugins

### Add a new plugin

Copy one of the example plugins (the panel template is the usual starting point for a visualization):

```bash
cd plugins
cp -r packages/@plugins/grafana-workspace-panel packages/@plugins/your-new-plugin
```

Then update:
- `package.json` - the `name` field
- `src/plugin.json` - `id`, `name`, and other metadata
- `webpack.config.mjs` - the `PLUGIN_ID` and the `uniqueName` argument
- `tsconfig.json` - the `paths` alias
- root `tsconfig.json` - add a project reference
- `jest.config.js` - copy from the template; add a `moduleNameMapper` entry if it imports a workspace package
- Docker files - add a `dist` volume / mount and allow the id as unsigned if you want it loaded by the Docker Grafana stack

CI picks the new package up automatically; no workflow needs editing. Add a `plugin-ci.json` only when the
defaults don't fit, e.g. the package publishes more than one plugin, or its e2e Grafana isn't on port 3000.
e2e runs only for packages with both an `e2e` script and a `playwright.config.ts`. See `CLAUDE.md`.

### Add a shared package

Create shared code that multiple plugins can use:

```bash
mkdir -p packages/@shared/your-package-name
```

Add a `package.json` and `tsconfig.json`, then import it in your plugins:

```typescript
import { something } from '@shared/your-package-name';
```

## Development Workflow

See [plugins/README.md](./plugins/README.md) for the full workflow, including the
two-stack Docker model and all available commands. Common commands:

```bash
cd plugins

pnpm build          # Production build of all packages
pnpm dev            # Watch mode
pnpm test           # Run tests
pnpm type-check     # TypeScript checking
pnpm lint           # Lint
pnpm format:fix     # Fix formatting
pnpm check          # format + test:ci + lint + type-check
```

## Technology Stack

### Build & Package Management
- **pnpm** - Fast, disk-efficient package manager with workspace support
- **Turborepo** - High-performance build system with intelligent caching
- **Webpack 5** - Module bundler configured for Grafana plugins

### Languages & Frameworks
- **TypeScript** - Strict mode with composite builds
- **React 18** - UI framework (provided by Grafana)

### Development Tools
- **SWC** - Fast TypeScript/JSX compiler
- **Biome.js** - Fast linting and formatting for packages on this repo's toolchain. `grafana-clock-panel` and `grafana-echarts` were imported with their own ESLint + Prettier setup and still use it
- **Jest** - Unit testing (via `@swc/jest`)
- **Docker Compose** - Local development environment

### Grafana Integration
- **@grafana/data** - Data manipulation utilities and plugin base classes
- **@grafana/runtime** - Runtime services
- **@grafana/ui** - UI components

## Key Differences from @grafana/create-plugin

This template uses an "ejected" approach that differs from the standard `@grafana/create-plugin`:

### Advantages
- Full control over webpack, TypeScript, and build configurations
- Monorepo support with shared packages
- Custom build pipeline optimized for your needs
- Modern tooling (Turborepo, SWC, Biome.js)
- Ability to build multiple plugins that share code

### Trade-offs
- More manual configuration required
- No automatic updates from @grafana/create-plugin
- Need to maintain build configuration yourself

## Continuous Integration

No workflow names a plugin. Each one asks `.github/actions/discover-plugins` which packages exist and what they publish, so a new package gets CI without workflow changes.

On a pull request:

- **`ci.yml`** - format, lint, type-check and unit tests for every package, then a build of each plugin the packages publish, checking that the right plugin ended up in `dist/`
- **`plugin-ci.yml`** - for the packages the PR touches:
  - a Grafana API compatibility check (levitate). It is non-blocking: a possible incompatibility shows as a warning and a PR comment.
  - Playwright e2e against every Grafana version the plugin supports
- **`plugin-bundle-stats.yml`** - a bundle-size comparison against `main`, as a PR comment per plugin

A change outside the plugin packages (the lockfile, `plugins/.shared/`) runs everything for every package, and a change to one of these workflows re-runs that workflow for every package. Per-package settings live in an optional `plugin-ci.json`. To test CI changes locally before pushing, run `node --test --test-concurrency=1 '.github/tests/*.test.ts'` from the repo root. Both are described in `CLAUDE.md`.

## License

UNLICENSED - Update this in `plugins/package.json` for your use case

## Support

For Grafana plugin development:
- [Grafana Plugin Tools](https://grafana.com/developers/plugin-tools/)
- [Grafana Plugin Examples](https://github.com/grafana/grafana-plugin-examples)
- [Grafana Community](https://community.grafana.com/)
