import { type PanelModel } from '@grafana/data';
import { statPanelChangeHandler } from './panelChange';

const panel = (): PanelModel => ({
  id: 1,
  type: 'grafana-echartsstat-panel',
  options: { keep: true },
  fieldConfig: { defaults: {}, overrides: [] },
});

describe('statPanelChangeHandler', () => {
  it('keeps the core Stat options and overrides', () => {
    const target = panel();
    const state = target.fieldConfig;
    const prevOptions = {
      reduceOptions: { values: false, calcs: ['mean'], fields: '' },
      orientation: 'vertical',
      colorMode: 'background',
      graphMode: 'none',
      text: { valueSize: 40 },
    };
    const overrides = [{ matcher: { id: 'byName', options: 'cpu' }, properties: [{ id: 'decimals', value: 2 }] }];
    const options = statPanelChangeHandler(target, 'stat', prevOptions, {
      defaults: { unit: 'short', thresholds: undefined },
      overrides,
    });
    expect(options).toEqual(prevOptions);
    // Scenes keeps its own field config object, so the handler changes it in place.
    expect(target.fieldConfig).toBe(state);
    expect(target.fieldConfig.defaults).toEqual({ unit: 'short' });
    expect(target.fieldConfig.overrides).toEqual(overrides);
  });

  it('adds no range to a percent unit: Grafana ran the migration of core Stat when it loaded the panel', () => {
    const target = panel();
    statPanelChangeHandler(target, 'stat', {}, { defaults: { unit: 'percent' }, overrides: [] });
    expect(target.fieldConfig.defaults).toEqual({ unit: 'percent' });
  });

  it('keeps the reduction of the data and the orientation of another panel type, and no other option', () => {
    const target = panel();
    const reduceOptions = { values: false, calcs: ['mean'], fields: '' };
    const options = statPanelChangeHandler(
      target,
      'gauge',
      { reduceOptions, orientation: 'vertical', showThresholdLabels: true },
      { defaults: { unit: 'percent', min: 0 }, overrides: [] }
    );
    expect(options).toEqual({ reduceOptions, orientation: 'vertical' });
    // Grafana keeps the standard field options in a type change. The handler does not write them.
    expect(target.fieldConfig).toEqual({ defaults: {}, overrides: [] });
  });

  it('changes nothing for another panel type with no such option', () => {
    const target = panel();
    const options = statPanelChangeHandler(target, 'timeseries', { legend: {} }, { defaults: {}, overrides: [] });
    expect(options).toEqual({});
    expect(target.fieldConfig).toEqual({ defaults: {}, overrides: [] });
  });
});
