import { PanelOptionsEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';

import { type PanelOptions } from 'types';

jest.mock('@grafana/i18n', () => ({
  initPluginTranslations: jest.fn(),
  t: (_key: string, defaultValue: string) => defaultValue,
}));

/** See `labels.test.ts` for why `standardEditorsRegistry` has to be stubbed under jest. */
const noEditor = (): null => null;
standardEditorsRegistry.setInit(() =>
  ['boolean', 'select', 'radio', 'number', 'slider', 'text', 'color', 'unit', 'stats-picker'].map((id) => ({
    id,
    name: id,
    editor: noEditor,
  }))
);

const loadPlugin = async () => {
  (globalThis as typeof globalThis & { __PLUGIN_ID__?: string }).__PLUGIN_ID__ = 'grafana-relations-panel';
  return (await import('./module')).plugin;
};

describe('Relations plugin module', () => {
  it('initializes translations with the webpack-selected plugin ID', async () => {
    await loadPlugin();

    expect(initPluginTranslations).toHaveBeenCalledWith('grafana-relations-panel');
  });

  /** Grafana Assistant documents the panel by running these suppliers with no data; it sees only these strings. */
  it('describes every panel option when built without data', async () => {
    const plugin = await loadPlugin();
    const builder = new PanelOptionsEditorBuilder<PanelOptions>();
    // Assistant's call: panelCatalog.ts in grafana-assistant-app.
    plugin.getPanelOptionsSupplier()(builder, { data: [], options: plugin.defaults as PanelOptions });
    const undescribed = builder
      .getItems()
      .filter((item) => !item.description?.trim())
      .map((item) => item.path);

    expect(undescribed).toEqual([]);
  });

  it('describes every field config option when built without data', async () => {
    const plugin = await loadPlugin();
    const undescribed = plugin.fieldConfigRegistry
      .list()
      .filter((item) => !item.description?.trim())
      .map((item) => item.path);

    expect(undescribed).toEqual([]);
  });
});
