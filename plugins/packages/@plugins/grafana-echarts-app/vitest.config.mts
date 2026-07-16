import { fileURLToPath } from 'node:url';
import { createVitestConfig } from '../../../vitest.config.base.mts';

// The plugin's sources and tests use `baseUrl: ./src`-rooted bare imports
// (`lib/…`, `editor/…`, `test/…`, `types`, `development`, `modules/…`). Vitest
// resolves those via vite-tsconfig-paths for production files, but not for the
// *test* files, which the package tsconfig excludes (type-check stays scoped to
// production). Alias each source root explicitly so the test files resolve too.
const src = (segment: string) => fileURLToPath(new URL(`./src/${segment}`, import.meta.url));

// The `*.canvas.test.tsx` snapshot suites stay on Jest (see jest.config.cjs):
// they depend on jest-canvas-mock (pnpm-patched) + the jest-canvas-mock-compare
// `toMatchCanvasSnapshot` matcher and their committed `.snap` baselines. Vitest
// runs every other suite.
export default createVitestConfig({
  testExclude: ['**/*.canvas.test.tsx'],
  alias: {
    lib: src('lib'),
    editor: src('editor'),
    modules: src('modules'),
    test: src('test'),
    types: src('types'),
    development: src('development'),
  },
});
