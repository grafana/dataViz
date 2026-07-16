/// <reference types="vitest" />

import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

function relativePath(path: string) {
  return new URL(path, import.meta.url).pathname;
}

export interface VitestConfigOptions {
  /**
   * Extra globs appended to the shared `test.exclude` list. Use for suites a
   * package runs on a different runner (e.g. the echarts canvas-snapshot suites
   * kept on Jest).
   */
  testExclude?: string[];
  /**
   * Extra `resolve.alias` entries merged over the shared aliases. Use for
   * packages whose sources (and, crucially, their *test* files) rely on
   * `baseUrl`-rooted bare imports (e.g. echarts' `lib/…`, `editor/…`): Vitest's
   * `vite-tsconfig-paths` only remaps files the package tsconfig owns, and test
   * files are excluded from that tsconfig (type-check stays scoped to
   * production), so their bare imports need an explicit alias here.
   */
  alias?: Record<string, string>;
}

export function createVitestConfig(options: VitestConfigOptions = {}) {
  return defineConfig({
    plugins: [tsconfigPaths(), react()],
    ssr: {
      noExternal: ['@grafana/ui', '@grafana/data', '@grafana/runtime', '@grafana/schema', '@grafana/i18n'],
    },
    resolve: {
      alias: {
        '@grafana-workspace-panel': relativePath('./packages/@plugins/grafana-workspace-panel/src/'),
        '@grafana-echarts-app': relativePath('./packages/@plugins/grafana-echarts-app/src/'),
        '@shared/core': relativePath('./packages/@shared/core/src/'),
        ...(options.alias ?? {}),
      },
    },
    test: {
      include: ['src/**/*.test.{js,jsx,ts,tsx}'],
      exclude: ['**/e2e/**/*', ...(options.testExclude ?? [])],
      passWithNoTests: true,
      globals: true,
      environment: 'jsdom',
      setupFiles: [relativePath('./vitest.setup.ts')],
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
      server: {
        deps: {
          // echarts is imported via modular ESM subpaths (echarts/core, /charts,
          // …) plus zrender/tslib; inline them (like uplot) so Vitest transforms
          // the untranspiled ESM instead of failing on `import` in node_modules.
          inline: ['uplot', 'echarts', 'zrender', 'tslib'],
        },
      },
    },
  });
}
