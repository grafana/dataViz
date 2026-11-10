import constants from '@grafana/viz-contract/registry/constants.json';
import type * as RendererApi from '@grafana/viz-contract/renderer-api';
import * as renderer from './index';

describe('Renderer module', () => {
  // contract-rule: renderer.1
  it('matches the shape of renderer-api.d.ts of the contract', () => {
    // A type check: tsc fails here if an export is missing or has another type.
    const api: typeof RendererApi = renderer;
    expect(Object.keys(api).sort()).toEqual(['render', 'specVersions', 'version']);
  });

  // contract-rule: delivery.2
  it('has the package version as its version', () => {
    expect(renderer.version).toBe(require('../../package.json').version);
  });

  it('supports the specVersion of the contract', () => {
    expect(renderer.specVersions).toContain(constants.specVersion.value);
  });

  // contract-rule: renderer.3
  it('throws only when el is not an HTMLElement', () => {
    expect(() => renderer.render({} as HTMLElement, {})).toThrow(TypeError);
    expect(() => renderer.render(document.createElement('div'), 'not a spec')).not.toThrow();
  });
});
