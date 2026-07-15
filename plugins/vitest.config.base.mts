/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

function relativePath(path: string) {
  return new URL(path, import.meta.url).pathname;
}

export function createVitestConfig() {
  return defineConfig({
    plugins: [tsconfigPaths(), react()],
    ssr: {
      noExternal: ['@grafana/ui', '@grafana/data', '@grafana/runtime'],
    },
    resolve: {
      alias: {
        '@grafana-workspace-panel': relativePath('./packages/@plugins/grafana-workspace-panel/src/'),
        '@grafana-canvas-panel': relativePath('./packages/@plugins/grafana-canvas-panel/src/'),
        '@shared/core': relativePath('./packages/@shared/core/src/'),
      },
    },
    test: {
      include: ['src/**/*.test.{js,jsx,ts,tsx}'],
      exclude: ['**/e2e/**/*'],
      passWithNoTests: true,
      globals: true,
      environment: 'jsdom',
      setupFiles: [relativePath('./vitest.setup.ts')],
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
      server: {
        deps: {
          inline: ['uplot'],
        },
      },
    },
  });
}
