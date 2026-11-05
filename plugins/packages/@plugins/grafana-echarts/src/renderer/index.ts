// The Renderer of the viz contract: an ES module that draws a viz spec into an element (`renderer.1`).
// The contract is in `contract/` (see its README). The API shape is `contract/renderer-api.d.ts`.
import { type RenderHandle, type RenderOptions } from './contract/renderer-api';
import { mount } from './mount';
import { SUPPORTED_SPEC_VERSIONS } from './parseSpec';
import { LOG_PREFIX } from './log';

declare const __RENDERER_VERSION__: string;

/** The semver of the Renderer: the package version (decision 1 of the plan). */
export const version: string = __RENDERER_VERSION__;

/** The viz spec versions that the Renderer supports (`delivery.2`, `delivery.3`). */
export const specVersions: readonly number[] = SUPPORTED_SPEC_VERSIONS;

/**
 * Draws `spec` into `el` and returns at once (`renderer.2`). A spec that is not correct gives the error state, and
 * `render` does not throw for it. It throws only if `el` is not an `HTMLElement` (`renderer.3`).
 */
export function render(el: HTMLElement, spec: unknown, options?: RenderOptions): RenderHandle {
  if (!(el instanceof HTMLElement)) {
    throw new TypeError(`${LOG_PREFIX} render needs an HTMLElement`);
  }
  // Phase 4 of the plan adds `update`, refresh and the size observer.
  const unmount = mount(el, spec, options);
  return {
    update: () => {},
    setRefreshed: () => {},
    destroy: unmount,
  };
}
