# Grafana dataViz Plugins - Ejected Monorepo

A Grafana **frontend** plugin monorepo using the "ejected" approach. It provides full control over the build system, dependencies, and tooling, and is scoped to **panel and app plugins only** (no Go backend plugins).

## Structure

```
plugins/
├── .shared/                    # Shared build configurations
│   ├── tsconfig.base.json     # Base TypeScript config (strict)
│   ├── tsconfig.json          # Shared packages TS config
│   └── webpack-shared.mjs     # Shared webpack config
├── packages/
│   ├── @shared/               # Shared libraries
│   │   └── core/              # Core utilities (@shared/core)
│   │       ├── src/
│   │       ├── package.json
│   │       └── tsconfig.json
│   └── @plugins/              # Grafana plugins
│       └── grafana-workspace-panel/   # Example panel plugin
│           ├── src/
│           │   ├── components/
│           │   ├── img/
│           │   ├── module.ts          # PanelPlugin entry
│           │   ├── plugin.json
│           │   └── types.ts
│           ├── package.json
│           ├── tsconfig.json
│           └── webpack.config.mjs
├── provisioning/              # Grafana provisioning (TestData datasource + demo dashboard)
├── docker-compose.yaml        # Plugin build/watch stack
├── docker-compose.grafana.yaml # Grafana instance stack
├── Dockerfile                 # Node + pnpm build image
├── package.json               # Root workspace
├── pnpm-workspace.yaml        # pnpm workspace config
├── turbo.json                 # Turborepo config
├── tsconfig.json              # Root TS project references
└── biome.json                 # Biome linting/formatting
```

## Tech Stack

- **Package Manager**: pnpm with workspaces
- **Build System**: Turborepo for orchestration, Webpack for bundling
- **TypeScript**: Strict mode with composite builds
- **Testing**: Jest (via `@swc/jest`)
- **Linting/Formatting**: Biome.js

## Getting Started

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm 10+
- Docker (for the local development environment)

### Installation

```bash
pnpm install
```

### Development with Docker Compose (Recommended)

Development uses two Docker Compose stacks: one that builds the plugins once
(shared), and one for each Grafana instance that attaches to that shared build.

**1. Start the plugin build (run once, keep it running):**

```bash
# Builds the plugins and watches for changes, writing to the shared dist volumes
pnpm run plugin
```

Wait for the initial build to finish before starting Grafana.

**2. Start a Grafana instance attached to that build:**

```bash
# Start Grafana (defaults to port 3001)
pnpm run server

# Access Grafana at http://localhost:3001
```

To run on a different port, set the `GRAFANA_PORT` environment variable:

```bash
GRAFANA_PORT=4000 pnpm run server
```

#### Running multiple instances / different Grafana versions

Because the plugin build is shared, you can attach several Grafana containers to
it — each on its own port/version — without rebuilding the plugins. The `server`
script supports these environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `GRAFANA_PORT` | `3001` | Host port to expose Grafana on. |
| `GRAFANA_VERSION` | `latest` | `grafana/grafana` image tag to run. |
| `GRAFANA_CONTAINER_NAME` | `grafana-dataviz-<port>` | Container name for the Grafana instance. |

Each invocation runs in its own Docker Compose project (namespaced by
`GRAFANA_CONTAINER_NAME`) with its own Grafana data volume, so instances don't
clobber each other, while all of them share the single plugin build:

```bash
# Plugin build must already be running (pnpm run plugin):
pnpm run plugin

# Grafana 13.1.0 on http://localhost:3002
GRAFANA_VERSION=13.1.0 GRAFANA_PORT=3002 pnpm run server

# Grafana 12.4.5 on http://localhost:3003
GRAFANA_VERSION=12.4.5 GRAFANA_PORT=3003 pnpm run server
```

The Docker Compose setup:
- Builds the frontend (webpack) for every plugin
- Watch mode auto-rebuilds on source changes
- Mounts each plugin's dist folder into Grafana
- Enables anonymous access (no login required)
- Provisions a TestData DB datasource and a demo dashboard; the panel is available in the panel picker

### Local Development

If you prefer to develop locally without Docker:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build in development mode
pnpm build:dev

# Watch mode for development
pnpm dev

# Run tests
pnpm test

# Lint
pnpm lint

# Format code
pnpm format:fix

# Type check
pnpm type-check
```

Then link a plugin's `dist` folder (e.g. `packages/@plugins/grafana-workspace-panel/dist`) into your Grafana plugins directory.

### Project Commands

All commands use Turborepo to orchestrate tasks across packages:

- `pnpm build` - Production build of all packages
- `pnpm build:dev` - Development build
- `pnpm dev` - Watch mode for development
- `pnpm test` - Run tests
- `pnpm test:ci` - Run tests in CI mode
- `pnpm lint` - Lint all packages
- `pnpm format` - Check formatting
- `pnpm format:fix` - Fix formatting
- `pnpm type-check` - TypeScript type checking
- `pnpm clean` - Clean build artifacts
- `pnpm check` - Run all checks (format, test, lint, type-check)

## Plugin Structure (Frontend / React + TypeScript)

### Panel plugin (`grafana-workspace-panel`)

- **Entry Point**: `src/module.ts` - Exports the `PanelPlugin` and its options builder
- **Main Component**: `src/components/WorkspacePanel.tsx` - Renders using `PanelProps` and `useTheme2`
- **Options**: `src/types.ts` - Panel options interface
- **Plugin Metadata**: `src/plugin.json` (`type: panel`)

The plugin uses `@shared/core` for shared utilities. App plugins (`type: app`)
are also supported — copy this package and change `plugin.json` accordingly.

### Build System

- **Webpack**: Bundles each plugin as an AMD module for Grafana
- **SWC**: Fast TypeScript/JSX compilation
- **TypeScript**: Project references for cross-package types
- **Turbo**: Parallel builds with caching

## Adding New Packages

### Shared Package

1. Create `packages/@shared/<name>/`
2. Add `package.json` with exports
3. Add `tsconfig.json` extending `.shared/tsconfig.json`
4. Update root `tsconfig.json` references
5. Update aliases in `.shared/webpack-shared.mjs`

### Plugin Package

1. Copy an existing plugin, e.g. the panel template:
   ```bash
   cp -r packages/@plugins/grafana-workspace-panel packages/@plugins/your-new-plugin
   ```
2. Update `package.json` `name`
3. Update `src/plugin.json` `id`, `name`, and metadata
4. Update `webpack.config.mjs` (`PLUGIN_ID` and the `uniqueName` argument)
5. Update `tsconfig.json` `paths` alias
6. Add the package to root `tsconfig.json` references, and copy `jest.config.js` / `jest-setup.js` / `types/jest-dom.d.ts` from the template (add a `moduleNameMapper` entry for any workspace package it imports)
7. If you want it loaded by the Docker Grafana stack, add a `dist` volume in `docker-compose.yaml`, mount it in `docker-compose.grafana.yaml`, and add its id to `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS`

## Key Features

- **Monorepo**: Multiple plugins with shared code
- **Full Control**: No abstraction over build tools
- **Type Safety**: Strict TypeScript with project references
- **Fast Builds**: Turborepo caching + SWC compilation
- **Modern Tools**: Biome.js for linting/formatting

## Differences from @grafana/create-plugin

This "ejected" approach differs from the standard `@grafana/create-plugin`:

- ✅ Full control over webpack configuration
- ✅ Monorepo support with shared packages
- ✅ Custom build pipeline with Turborepo
- ✅ Strict TypeScript configuration
- ✅ Modern tooling (Biome.js, SWC)
- ❌ More manual configuration required
- ❌ No automatic updates from @grafana/create-plugin

## License

Apache License 2.0, see [`LICENSE`](../LICENSE).
