# Grafana dataViz Plugin Monorepo

A template for building Grafana **frontend** plugins (panel and app plugins) in a monorepo structure. It provides a fully ejected build system with complete control over configuration, ideal for teams building multiple related visualization plugins or plugins with shared code.

> Scope: this monorepo targets **panel and app plugins only**. It intentionally does not include Go backend plugin tooling.

## Features

- **Monorepo Architecture** - Multiple plugins and shared packages in one repository
- **Full Build Control** - Ejected webpack and build configurations, no hidden abstractions
- **Modern Toolchain** - Turborepo, pnpm workspaces, SWC, TypeScript, Biome.js
- **Panel Example** - Ready-to-copy `PanelPlugin` template (app plugins are supported too)
- **Type Safety** - Strict TypeScript with composite builds and project references
- **Fast Development** - Docker Compose setup with hot reload
- **Testing Ready** - Vitest configured for all packages
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

## Prerequisites

- **Node.js** 22 (see `plugins/.nvmrc`)
- **pnpm** 10 or later
- **Docker** (for the local development environment)

## Repository Structure

```
dataViz/
└── plugins/                          # Main workspace directory
    ├── .shared/                      # Shared build configurations
    │   ├── tsconfig.base.json       # Base TypeScript config
    │   ├── tsconfig.json            # Shared packages config
    │   └── webpack-shared.mjs       # Shared webpack config
    ├── packages/
    │   ├── @shared/                 # Shared libraries
    │   │   └── core/                # Core utilities package
    │   └── @plugins/                # Grafana plugins
    │       └── grafana-workspace-panel/  # Example panel plugin
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
- `vitest.config.base.mts` - add an alias if tests import the package
- Docker files - add a `dist` volume / mount and allow the id as unsigned if you want it loaded by the Docker Grafana stack

If the plugin you are importing already uses Jest, ESLint, or Prettier, see the
[Tooling Migration Guide](./plugins/docs/tooling-migration.md) for how to migrate
it to the repo's Biome + Vitest standard (or keep its existing tooling if you
can't migrate yet).

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
- **Biome.js** - Fast linting and formatting
- **Vitest** - Fast unit testing
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

The build system is designed to work well with CI/CD:

```yaml
# Example GitHub Actions
- run: cd plugins && pnpm install
- run: cd plugins && pnpm check  # Runs format, test, lint, type-check
- run: cd plugins && pnpm build
```

Turborepo's caching works in CI with remote cache configuration.

## License

UNLICENSED - Update this in `plugins/package.json` for your use case

## Support

For Grafana plugin development:
- [Grafana Plugin Tools](https://grafana.com/developers/plugin-tools/)
- [Grafana Plugin Examples](https://github.com/grafana/grafana-plugin-examples)
- [Grafana Community](https://community.grafana.com/)
