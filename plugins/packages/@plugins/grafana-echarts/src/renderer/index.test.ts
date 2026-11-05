import type * as RendererApi from './contract/renderer-api';
import * as renderer from './index';
import constants from './contract/registry/constants.json';

describe('Renderer module', () => {
  // contract-rule: renderer.1
  it('matches the shape of contract/renderer-api.d.ts', () => {
    // A type check: tsc fails here if an export is missing or has another type.
    const api: typeof RendererApi = renderer;
    expect(Object.keys(api).sort()).toEqual(['render', 'specVersions', 'version']);
  });

  // contract-rule: delivery.2
  it('has the package version as its version', () => {
    expect(renderer.version).toBe(require('../../package.json').version);
  });

  // contract-rule: delivery.3
  it('supports the specVersion of the contract', () => {
    expect(renderer.specVersions).toContain(constants.specVersion.value);
  });

  // contract-rule: renderer.3
  it('throws only when el is not an HTMLElement', () => {
    expect(() => renderer.render({} as HTMLElement, {})).toThrow(TypeError);
    expect(() => renderer.render(document.createElement('div'), 'not a spec')).not.toThrow();
  });
});
