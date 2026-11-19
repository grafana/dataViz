// The adapter of the core Stat panel.
import { PanelOptionsEditorBuilder, type StandardEditorContext } from '@grafana/data';

// Fills the registries that Grafana fills before it loads a plugin. It must load before the stat module.
import 'test/standardRegistries';
import { plugin as stat } from 'modules/stat/module';
import { type PanelOptions } from 'types';
import { statAdapter, statCapability } from './stat';
import type { CorePanel } from './types';

const translate = (panel: Partial<CorePanel>) => statAdapter.translate({ ...panel, type: 'stat' });

/** A panel of this Grafana that sets each setting that the adapter reads. */
const fullPanel: Partial<CorePanel> = {
  pluginVersion: '13.3.0',
  options: {
    reduceOptions: { values: false, calcs: ['mean'], fields: '' },
    orientation: 'horizontal',
    textMode: 'value_and_name',
    wideLayout: false,
    colorMode: 'background',
    graphMode: 'none',
    justifyMode: 'center',
    showPercentChange: true,
    percentChangeColorMode: 'inverted',
    text: { titleSize: 20, valueSize: 40, percentSize: 16 },
  },
  fieldConfig: {
    defaults: {
      color: { mode: 'thresholds' },
      decimals: 1,
      displayName: 'Load',
      links: [{ title: 'Docs', url: '/docs' }],
      mappings: [],
      max: 200,
      min: 10,
      noValue: 'none',
      thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] },
      unit: 'percent',
    },
    overrides: [
      {
        matcher: { id: 'byName', options: 'cpu' },
        properties: [
          { id: 'color', value: { mode: 'fixed', fixedColor: 'red' } },
          { id: 'unit', value: 'short' },
        ],
      },
    ],
  },
};

describe('statAdapter.translate', () => {
  it('gives the type of the stat panel', () => {
    expect(translate({}).type).toBe('grafana-echartsstat-panel');
  });

  it('gives no option and no field setting for a panel with none, so the panel defaults apply', () => {
    expect(translate({ pluginVersion: '13.3.0' })).toMatchObject({
      options: {},
      fieldConfig: { defaults: {}, overrides: [] },
    });
  });

  it('keeps each option of core Stat with its path and its value', () => {
    expect(translate(fullPanel).options).toEqual(fullPanel.options);
  });

  it('keeps each standard field setting and each standard override property', () => {
    expect(translate(fullPanel).fieldConfig).toEqual(fullPanel.fieldConfig);
  });

  it('leaves out an option that core Stat does not have', () => {
    expect(translate({ pluginVersion: '13.3.0', options: { legend: { showLegend: true } } }).options).toEqual({});
  });

  it('leaves out a custom field setting, and an override with only custom properties', () => {
    const { fieldConfig } = translate({
      pluginVersion: '13.3.0',
      fieldConfig: {
        defaults: { unit: 'short', custom: { lineWidth: 2 } },
        overrides: [
          { matcher: { id: 'byName', options: 'a' }, properties: [{ id: 'custom.lineWidth', value: 3 }] },
          {
            matcher: { id: 'byName', options: 'b' },
            properties: [
              { id: 'custom.lineWidth', value: 3 },
              { id: 'decimals', value: 2 },
            ],
          },
        ],
      },
    });
    expect(fieldConfig.defaults).toEqual({ unit: 'short' });
    expect(fieldConfig.overrides).toEqual([
      { matcher: { id: 'byName', options: 'b' }, properties: [{ id: 'decimals', value: 2 }] },
    ]);
  });

  it('gives no reference to a value of the core panel', () => {
    const target = translate(fullPanel);
    expect(target.options.reduceOptions).not.toBe(fullPanel.options?.reduceOptions);
    expect(target.fieldConfig.overrides[0].matcher).not.toBe(fullPanel.fieldConfig?.overrides?.[0].matcher);
  });

  // The stat panel ignores an option or a field config id that it does not register.
  it('writes only options and field config ids that the stat panel registers', () => {
    const target = translate(fullPanel);
    const registered = stat.fieldConfigRegistry.list().map((item) => item.id);
    const ids = [
      ...Object.keys(target.fieldConfig.defaults),
      ...target.fieldConfig.overrides.flatMap((override) => override.properties.map((property) => property.id)),
    ];
    expect(registered).toEqual(expect.arrayContaining(ids));

    // https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/panel/PanelPlugin.ts
    const builder = new PanelOptionsEditorBuilder<PanelOptions>();
    stat.getPanelOptionsSupplier()(builder, { data: [] } as StandardEditorContext<PanelOptions>);
    const paths = builder.getItems().map((item) => item.path.split('.')[0]);
    expect(paths).toEqual(expect.arrayContaining(Object.keys(target.options)));
  });
});

describe('the Stat change of a panel that Grafana saved before 8.0', () => {
  const defaultsOf = (pluginVersion: string | undefined, defaults: Record<string, unknown>) =>
    translate({ pluginVersion, fieldConfig: { defaults, overrides: [] } }).fieldConfig.defaults;

  it.each([
    ['percent', 100],
    ['percentunit', 1],
  ])('gives the unit %s the range 0 to %s', (unit, max) => {
    expect(defaultsOf('7.5.11', { unit })).toEqual({ unit, min: 0, max });
  });

  it('gives the range to a panel with no plugin version, which core reads as 6.1', () => {
    expect(defaultsOf(undefined, { unit: 'percent' })).toEqual({ unit: 'percent', min: 0, max: 100 });
  });

  it('keeps a min or a max that is a number', () => {
    expect(defaultsOf('7.5.11', { unit: 'percent', min: 20 })).toEqual({ unit: 'percent', min: 20, max: 100 });
    expect(defaultsOf('7.5.11', { unit: 'percent', max: 50 })).toEqual({ unit: 'percent', min: 0, max: 50 });
  });

  it('gives no range to a panel of Grafana 8.0 or later', () => {
    expect(defaultsOf('8.0.0', { unit: 'percent' })).toEqual({ unit: 'percent' });
    expect(defaultsOf('13.3.0', { unit: 'percentunit' })).toEqual({ unit: 'percentunit' });
  });

  it('gives no range to a unit that is not a percent unit', () => {
    expect(defaultsOf('7.5.11', { unit: 'short' })).toEqual({ unit: 'short' });
    expect(defaultsOf(undefined, {})).toEqual({});
  });
});

describe('statCapability', () => {
  it('names core Stat and the stat panel', () => {
    expect(statCapability).toMatchObject({ source: 'stat', target: 'grafana-echartsstat-panel' });
  });

  it('gives an entry to each setting that the adapter writes to the stat panel', () => {
    const target = translate(fullPanel);
    expect(Object.keys(statCapability.options)).toEqual(expect.arrayContaining(Object.keys(target.options)));
    expect(Object.keys(statCapability.fieldConfig)).toEqual(
      expect.arrayContaining(Object.keys(target.fieldConfig.defaults))
    );
  });

  it('has no entry for a setting that the adapter does not write', () => {
    const target = translate(fullPanel);
    expect(Object.keys(target.options)).toEqual(expect.arrayContaining(Object.keys(statCapability.options)));
    // `fieldMinMax` and `filterable` are not in the full panel: they are standard settings that the adapter keeps.
    const written = [...Object.keys(target.fieldConfig.defaults), 'fieldMinMax', 'filterable'];
    expect(written).toEqual(expect.arrayContaining(Object.keys(statCapability.fieldConfig)));
  });
});
