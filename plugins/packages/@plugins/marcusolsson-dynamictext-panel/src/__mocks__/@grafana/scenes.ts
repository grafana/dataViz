/**
 * Manual mock for @grafana/scenes.
 *
 * Vitest manual mocks live in a `__mocks__` folder and export the stubbed
 * module (unlike the Jest version, which called `jest.mock` at module scope).
 * Tests that need it opt in with `vi.mock('@grafana/scenes')`; most tests mock
 * `sceneGraph` inline instead. Keeping the stub avoids the real module's
 * `IntersectionObserver` access at import time.
 */
export const sceneGraph = {};
