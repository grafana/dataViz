import { initPluginTranslations } from '@grafana/i18n';

jest.mock('@grafana/i18n', () => ({
  initPluginTranslations: jest.fn(),
  t: (_key: string, text: string) => text,
}));

describe('Gauge plugin module', () => {
  it('initializes translations with the webpack-selected plugin ID', async () => {
    (globalThis as typeof globalThis & { __PLUGIN_ID__?: string }).__PLUGIN_ID__ = 'grafana-echarts-app';

    await import('./module');

    expect(initPluginTranslations).toHaveBeenCalledWith('grafana-echarts-app');
  });
});
