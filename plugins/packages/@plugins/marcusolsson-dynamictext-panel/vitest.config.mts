import { createVitestConfig } from '../../../vitest.config.base.mts';

// Start from the shared base (jsdom, @grafana SSR handling, path aliases, the
// repo-wide setup) and append this plugin's own setup for jest-dom matchers and
// the fetch/ResizeObserver shims the Business Text tests rely on.
const config = createVitestConfig();

const localSetup = new URL('./vitest.setup.ts', import.meta.url).pathname;
const existingSetup = config.test?.setupFiles;
const baseSetup = Array.isArray(existingSetup) ? existingSetup : existingSetup ? [existingSetup] : [];

config.test = {
  ...config.test,
  setupFiles: [...baseSetup, localSetup],
};

export default config;
