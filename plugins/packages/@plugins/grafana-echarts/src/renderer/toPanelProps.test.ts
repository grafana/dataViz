import { FieldColorModeId, FieldType, getFieldDisplayName } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';
import {
  changeSeriesColorConfig,
  getHiddenSeriesNames,
  type LegendOverrides,
  mergeLegendOverrides,
  setMarkPositionsConfig,
  toggleSeriesVisibilityConfig,
} from 'lib/grafana/fields/seriesConfig';
import { fixtureSets, fixtureSpec, fixtureState } from 'test/rendererFixtures';
import { PANELS } from './panels';
import { parseSpec } from './parseSpec';
import { withoutCallOuts } from './callOuts';
import { preparePanel, type SpecPanelProps, themeOf, toPanelProps } from './toPanelProps';
import { type VizSpec } from './vizSpec';

const parse = (input: unknown): VizSpec => {
  const result = parseSpec(input);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.spec;
};

const withFieldConfig = (fieldConfig: unknown) => {
  const spec = fixtureSpec('smoke-timeseries');
  (spec.panel as Record<string, unknown>).fieldConfig = fieldConfig;
  return parse(spec);
};

const cartesian = PANELS['grafana-echartscartesian-panel'];
const numberFields = (spec: VizSpec) =>
  toPanelProps(spec, cartesian).data.series.flatMap((f) => f.fields.filter((field) => field.type === FieldType.number));

describe('toPanelProps', () => {
  // contract-rule: spec.10
  it('gives the plugin defaults to the options', () => {
    const props = toPanelProps(parse(fixtureSpec('smoke-timeseries')), cartesian);
    expect(props.options).toMatchObject({
      seriesType: 'line',
      legend: expect.any(Object),
      tooltip: expect.any(Object),
    });
    expect(props.family).toBe('cartesian');
  });

  it('applies the field config to the frames: unit, and display', () => {
    const fields = numberFields(withFieldConfig({ defaults: { unit: 'reqps' } }));
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.config.unit).toBe('reqps');
      expect(field.display!(1234).suffix).toContain('req/s');
    }
  });

  it('applies an override by name', () => {
    const name = numberFields(parse(fixtureSpec('smoke-timeseries')))[0].name;
    const fields = numberFields(
      withFieldConfig({
        defaults: {},
        overrides: [{ matcher: { id: 'byName', options: name }, properties: [{ id: 'unit', value: 'bytes' }] }],
      })
    );
    expect(fields.find((field) => field.name === name)?.config.unit).toBe('bytes');
  });

  // contract-rule: renderer.12
  it('gives no data links and no actions, in the defaults and in the overrides', () => {
    const link = [{ title: 't', url: 'https://example.com' }];
    const spec = withFieldConfig({
      defaults: { links: link, actions: [{ title: 'a' }], unit: 'short' },
      overrides: [
        {
          matcher: { id: 'byType', options: 'number' },
          properties: [
            { id: 'links', value: link },
            { id: 'unit', value: 'bytes' },
          ],
        },
      ],
    });
    const props = toPanelProps(spec, cartesian);
    expect(props.fieldConfig.defaults).not.toHaveProperty('links');
    expect(props.fieldConfig.defaults).not.toHaveProperty('actions');
    expect(props.fieldConfig.overrides[0].properties.map((property) => property.id)).toEqual(['unit']);
    for (const field of numberFields(spec)) {
      expect(field.config.links ?? []).toEqual([]);
      expect(field.getLinks?.({}) ?? []).toEqual([]);
    }
    // The ad-hoc filter buttons come from `PanelContext.onAddAdHocFilter`. The Renderer gives no `PanelContext`.
    expect(Object.keys(props)).not.toContain('onAddAdHocFilter');
  });

  // contract-rule: renderer.12
  it('gives no data links for links that a data source puts in the frames', () => {
    const spec = fixtureSpec('smoke-timeseries') as { data: { results: Record<string, { frames: unknown[] }> } };
    for (const json of Object.values(spec.data.results).flatMap((result) => result.frames)) {
      for (const field of (json as { schema: { fields: Array<{ config?: object }> } }).schema.fields) {
        field.config = { ...field.config, links: [{ title: 't', url: 'https://evil.example/x' }] };
      }
    }
    const fields = toPanelProps(parse(spec), cartesian).data.series.flatMap((f) => f.fields);
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.config.links).toBeUndefined();
      expect(field.getLinks?.({ valueRowIndex: 0 })).toEqual([]);
    }
  });

  it('removes call-out properties and keeps the rest', () => {
    expect(
      withoutCallOuts({
        defaults: { links: [], unit: 'short' },
        overrides: [{ matcher: { id: 'byName', options: 'a' }, properties: [{ id: 'actions', value: [] }] }],
      })
    ).toEqual({
      defaults: { unit: 'short' },
      overrides: [{ matcher: { id: 'byName', options: 'a' }, properties: [] }],
    });
  });

  // contract-rule: renderer.11
  it('uses the theme of the spec, dark by default', () => {
    expect(themeOf('dark').isDark).toBe(true);
    expect(themeOf('light').isLight).toBe(true);
  });

  it('gives the time zone of the spec and the time range of data.range', () => {
    const spec = { ...parse(fixtureSpec('epoch-range')), timeZone: 'utc' };
    const props = toPanelProps(spec, cartesian);
    expect(props.timeZone).toBe('utc');
    expect(props.timeRange.from.valueOf()).toBe(spec.data.range.from);
    expect(props.timeRange.to.valueOf()).toBe(spec.data.range.to);
  });
});

describe('toPanelProps for each fixture set', () => {
  const sets = fixtureSets().filter((set) => !set.startsWith('error-'));

  it.each(sets)('%s: builds the props with the frames of the spec', (set) => {
    const spec = parse(fixtureSpec(set));
    const props = toPanelProps(spec, PANELS[spec.panel.type]);
    const rows = props.data.series.reduce((sum, frame) => sum + frame.length, 0);
    expect(rows > 0).toBe(fixtureState(set).state !== 'no-data');
    for (const frame of props.data.series) {
      for (const field of frame.fields) {
        expect(field.display).toBeDefined();
      }
    }
  });
});

describe('preparePanel: the series-truncated cut', () => {
  /** smoke-timeseries with one frame of `count` number fields. */
  const wide = (type: string, count: number) => {
    const spec = parse(fixtureSpec('smoke-timeseries'));
    return {
      ...spec,
      panel: { ...spec.panel, type },
      data: {
        ...spec.data,
        results: {
          A: {
            frames: [
              {
                schema: {
                  fields: [
                    { name: 'time', type: FieldType.time },
                    ...Array.from({ length: count }, (_, i) => ({ name: `s${i}`, type: FieldType.number })),
                  ],
                },
                data: { values: [[1, 2], ...Array.from({ length: count }, () => [1, 2])] },
              },
            ],
          },
        },
      },
    };
  };

  // contract-rule: state.19
  it('draws the first 50 series of a cartesian panel and counts the rest', () => {
    const { props, omittedSeries } = preparePanel(wide('grafana-echartscartesian-panel', 53), cartesian);
    expect(omittedSeries).toBe(3);
    const names = props.data.series[0].fields.filter((field) => field.type === FieldType.number).map((f) => f.name);
    expect(names).toHaveLength(50);
    expect(names.at(-1)).toBe('s49');
  });

  it('does not cut at 50 series, and does not cut the other families', () => {
    expect(preparePanel(wide('grafana-echartscartesian-panel', 50), cartesian).omittedSeries).toBe(0);
    const heatmap = PANELS['grafana-echartsheatmap-panel'];
    expect(preparePanel(wide('grafana-echartsheatmap-panel', 60), heatmap).omittedSeries).toBe(0);
    const stream = PANELS['grafana-echartsstream-panel'];
    expect(preparePanel(wide('grafana-echartsstream-panel', 60), stream).omittedSeries).toBe(10);
  });

  // contract-rule: state.19
  it('cuts the gauge panel to 50 number fields: one gauge for each', () => {
    const gauge = PANELS['grafana-echartsgauge-panel'];
    const { props, omittedSeries } = preparePanel(wide('grafana-echartsgauge-panel', 53), gauge);
    expect(omittedSeries).toBe(3);
    const numbers = props.data.series[0].fields.filter((field) => field.type === FieldType.number);
    expect(numbers).toHaveLength(50);
    expect(preparePanel(wide('grafana-echartsgauge-panel', 10), gauge).omittedSeries).toBe(0);
  });

  // contract-rule: state.19
  it('does not cut an Auto candlestick, which draws one series from the number fields of the first frame', () => {
    const spec = wide('grafana-echartscartesian-panel', 0);
    const ohlc = (refId: string) => ({
      schema: {
        refId,
        fields: [
          { name: 'time', type: FieldType.time },
          ...['open', 'high', 'low', 'close', 'volume'].map((name) => ({ name, type: FieldType.number })),
        ],
      },
      data: {
        values: [
          [1, 2],
          [1, 2],
          [3, 4],
          [0, 1],
          [2, 3],
          [9, 9],
        ],
      },
    });
    const frames = Array.from({ length: 11 }, (_, i) => ohlc(`F${i}`));
    const { props, omittedSeries } = preparePanel(
      {
        ...spec,
        panel: { ...spec.panel, options: { ...spec.panel.options, seriesType: 'Auto' } },
        data: { ...spec.data, results: { A: { frames } } },
      },
      cartesian
    );
    expect(omittedSeries).toBe(0);
    expect(props.data.series).toHaveLength(11);
  });
});

// `renderer.35`: the legend state of the user wins over the overrides of each viz spec, and stays until `destroy`.
describe('the legend state in preparePanel', () => {
  const KEPT = '/api/health';
  const fixed = (fixedColor: string) => ({ mode: FieldColorModeId.Fixed, fixedColor });

  const specWith = (overrides: unknown[]) => {
    const spec = fixtureSpec('prometheus-line');
    (spec.panel as Record<string, unknown>).fieldConfig = { defaults: {}, overrides };
    return parse(spec);
  };

  /** The state of one Renderer: each draw reads it, and each legend action merges into it. */
  const renderer = () => {
    let state: LegendOverrides | undefined;
    const hook = () => ({
      overrides: state,
      onChange: (change: LegendOverrides) => {
        state = mergeLegendOverrides(state, change);
      },
    });
    return { draw: (spec: VizSpec) => preparePanel(spec, cartesian, hook()).props };
  };

  const colorOf = (props: SpecPanelProps, name: string) =>
    props.data.series
      .flatMap((frame) => frame.fields.map((field) => ({ frame, field })))
      .find(({ frame, field }) => field.type === FieldType.number && getFieldDisplayName(field, frame) === name)?.field
      .config.color;
  const seriesNames = (props: SpecPanelProps) =>
    props.data.series.flatMap((frame) =>
      frame.fields.filter((f) => f.type === FieldType.number).map((f) => getFieldDisplayName(f, frame))
    );

  const byName = (name: string, properties: unknown[]) => ({ matcher: { id: 'byName', options: name }, properties });
  const color = (fixedColor: string) => ({ id: 'color', value: fixed(fixedColor) });
  const hideRule = (kept: string[]) => ({
    __systemRef: 'hideSeriesFrom',
    matcher: { id: 'byNames', options: { mode: 'exclude', names: kept, prefix: 'All except:', readOnly: true } },
    properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: true } }],
  });

  it('gives a legend color priority over a broader color rule that is after the byName rule of the viz spec', () => {
    const spec = () =>
      specWith([
        byName(KEPT, [{ id: 'unit', value: 'ms' }]),
        { matcher: { id: 'byRegexp', options: '.*' }, properties: [color('red')] },
      ]);
    const draw = renderer().draw;
    const first = draw(spec());
    expect(colorOf(first, KEPT)).toEqual(fixed('red'));
    first.onFieldConfigChange(changeSeriesColorConfig(first.fieldConfig, KEPT, 'blue'));
    expect(colorOf(draw(spec()), KEPT)).toEqual(fixed('blue'));
    // The color stays after each later viz spec.
    expect(colorOf(draw(spec()), KEPT)).toEqual(fixed('blue'));
  });

  it('keeps a legend change that is equal to the overrides of the viz spec when a later spec is not', () => {
    const draw = renderer().draw;
    const first = draw(specWith([]));
    const names = seriesNames(first);
    expect(names.length).toBeGreaterThan(2);
    // 1. The user shows only `KEPT`.
    first.onFieldConfigChange(
      toggleSeriesVisibilityConfig(first.fieldConfig, KEPT, SeriesVisibilityChangeMode.ToggleSelection, names)
    );
    // 2. The viz spec has the same override as the user.
    const second = draw(specWith([hideRule([KEPT])]));
    expect(getHiddenSeriesNames(second.fieldConfig, names).size).toBe(names.length - 1);
    // 3. The user changes a color.
    second.onFieldConfigChange(changeSeriesColorConfig(second.fieldConfig, KEPT, 'blue'));
    // 4. A viz spec with no hidden series does not show the series again.
    const third = draw(specWith([]));
    expect(getHiddenSeriesNames(third.fieldConfig, names).size).toBe(names.length - 1);
    expect(colorOf(third, KEPT)).toEqual(fixed('blue'));
  });

  it('keeps a legend color that is equal to the color of the viz spec when a later spec is not', () => {
    const draw = renderer().draw;
    const first = draw(specWith([byName(KEPT, [color('red')])]));
    first.onFieldConfigChange(changeSeriesColorConfig(first.fieldConfig, KEPT, 'blue'));
    const second = draw(specWith([byName(KEPT, [color('blue')])]));
    second.onFieldConfigChange(
      toggleSeriesVisibilityConfig(second.fieldConfig, KEPT, SeriesVisibilityChangeMode.ToggleSelection, [KEPT, 'x'])
    );
    expect(colorOf(draw(specWith([byName(KEPT, [color('red')])])), KEPT)).toEqual(fixed('blue'));
  });

  it('lets the user pick the color of the viz spec again after a legend color', () => {
    const draw = renderer().draw;
    const spec = () => specWith([byName(KEPT, [color('red')])]);
    const first = draw(spec());
    first.onFieldConfigChange(changeSeriesColorConfig(first.fieldConfig, KEPT, 'blue'));
    const second = draw(spec());
    expect(colorOf(second, KEPT)).toEqual(fixed('blue'));
    second.onFieldConfigChange(changeSeriesColorConfig(second.fieldConfig, KEPT, 'red'));
    expect(colorOf(draw(spec()), KEPT)).toEqual(fixed('red'));
  });

  it('gives no legend change for a write that is not one, as the positions of a relations drag', () => {
    const onChange = jest.fn();
    const { props } = preparePanel(specWith([]), cartesian, { onChange });
    props.onFieldConfigChange(setMarkPositionsConfig(props.fieldConfig, new Map([[KEPT, { x: 999, y: 999 }]])));
    expect(onChange).not.toHaveBeenCalled();
  });
});
