import { initPluginTranslations } from '@grafana/i18n';

jest.mock('@grafana/i18n', () => ({
  initPluginTranslations: jest.fn(),
  t: (key: string) => key,
}));

describe('Stat plugin module', () => {
  it('initializes translations with the webpack-selected plugin ID', async () => {
    (globalThis as typeof globalThis & { __PLUGIN_ID__?: string }).__PLUGIN_ID__ = 'grafana-echarts-app';

    await import('./module');

    expect(initPluginTranslations).toHaveBeenCalledWith('grafana-echarts-app');
  });

  it('has no panel padding, as core Stat', async () => {
    const { plugin } = await import('./module');

    expect(plugin.noPadding).toBe(true);
  });
});
