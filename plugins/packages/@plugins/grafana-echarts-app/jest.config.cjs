// Package-local Jest config for the ECharts canvas-snapshot suites only.
//
// The bulk of the test suite runs on Vitest (see vitest.config.mts). The two
// `*.canvas.test.tsx` suites stay on Jest because they depend on the
// pnpm-patched `jest-canvas-mock` (recording 2D context) and the
// `jest-canvas-mock-compare` `toMatchCanvasSnapshot` matcher, whose committed
// `.snap` baselines were generated in exactly this environment. Keeping them on
// Jest preserves those baselines without re-recording under a different mock.
//
// This is the documented tooling-migration fallback, scoped to two files. See
// plugins/docs/tooling-migration.md.

// Force UTC so snapshots are timezone-independent.
process.env.TZ = 'UTC';

// ECharts is imported via its modular ESM subpaths (echarts/core, /charts, …)
// which, together with zrender/tslib and the Grafana ESM packages, must be
// transformed for Jest.
const grafanaESModules = [
  '.pnpm', // Support pnpm symlinked packages
  '@grafana/schema',
  '@grafana/i18n',
  '@wojtekmaj/date-utils',
  'd3',
  'd3-color',
  'd3-force',
  'd3-interpolate',
  'd3-scale-chromatic',
  'get-user-locale',
  'marked',
  'memoize',
  'mimic-function',
  'ol',
  'react-calendar',
  'react-colorful',
  'rxjs',
  'uuid',
  'echarts',
  'zrender',
  'tslib',
];

const nodeModulesToTransform = (moduleNames) => `node_modules/(?!.*(${moduleNames.join('|')})/.*)`;

module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.cjs'],
  // Resolve bare specifiers (e.g. `test/canvas`, `lib/echarts/echarts`) against
  // `src`, mirroring the webpack `resolve.modules` / tsconfig `baseUrl`.
  modulePaths: ['<rootDir>/src'],
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.canvas.test.{ts,tsx}'],
  moduleNameMapper: {
    '\\.(css|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        sourceMaps: 'inline',
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: false,
            dynamicImport: true,
          },
          transform: {
            // Use the automatic JSX runtime (React 17+) so components don't need
            // an explicit `import React`. This matches the Vitest runner
            // (@vitejs/plugin-react) and Biome's `noUnusedImports`, which assumes
            // the automatic runtime and strips unused React imports.
            react: {
              runtime: 'automatic',
            },
            hidden: {
              jest: true,
            },
          },
        },
        module: {
          type: 'commonjs',
        },
      },
    ],
  },
  transformIgnorePatterns: [nodeModulesToTransform(grafanaESModules)],
  watchPathIgnorePatterns: ['<rootDir>/node_modules', '<rootDir>/dist'],
};
