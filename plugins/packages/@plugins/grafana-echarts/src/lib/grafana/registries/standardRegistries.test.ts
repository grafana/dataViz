import { standardEditorsRegistry, standardFieldConfigEditorRegistry } from '@grafana/data';
import { fillStandardRegistries } from './standardRegistries';

describe('fillStandardRegistries', () => {
  it('keeps the items of a host that called setInit, and adds only the missing ids', () => {
    const hostEditor = () => null;
    const hostUnit = { id: 'unit', name: 'host unit', process: (value: unknown) => value, shouldApply: () => true };
    standardEditorsRegistry.setInit(() => [{ id: 'select', name: 'host select', editor: hostEditor }]);
    standardFieldConfigEditorRegistry.setInit(() => [hostUnit as never]);

    fillStandardRegistries();
    // A second call, as the Renderer and a test setup can both make, adds nothing and does not throw.
    fillStandardRegistries();

    expect(standardEditorsRegistry.get('select').editor).toBe(hostEditor);
    expect(standardEditorsRegistry.get('radio')).toBeDefined();
    expect(standardFieldConfigEditorRegistry.get('unit')).toBe(hostUnit);
    expect(standardFieldConfigEditorRegistry.get('decimals')).toBeDefined();
  });
});
