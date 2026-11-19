import {
  createTheme,
  DataFrameType,
  dateTime,
  type DataFrame,
  type FieldConfig,
  FieldType,
  MappingType,
  toDataFrame,
  type ValueMapping,
} from '@grafana/data';
import { GraphGradientMode, LegendDisplayMode, StackingMode, TooltipDisplayMode } from '@grafana/schema';
import { type CustomSeriesOption } from 'echarts';
import { type TopLevelFormatterParams } from 'echarts/types/dist/shared';
import { cartesianChartModule } from 'lib/echarts/charts/cartesian';
import { type ChartContext } from 'lib/echarts/charts/types';
import { buildHistogramModel } from 'lib/echarts/converters/histogram';
import { type TooltipModel } from 'lib/echarts/tooltip/types';
import { type PanelOptions } from 'types';
import { buildHistogramOption, getHistogramFill } from './histogram';
import { buildPanelChartOption } from './panelOption';

const theme = createTheme();
const legend = { showLegend: true, displayMode: LegendDisplayMode.List, placement: 'bottom' as const, calcs: [] };
const noOverrides = { defaults: {}, overrides: [] };

const frame = (fields: Record<string, number[]>, unit?: string): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: Object.values(fields)[0].map((_, i) => 1783137094497 + i) },
      ...Object.entries(fields).map(([name, values]) => ({ name, type: FieldType.number, values, config: { unit } })),
    ],
  });

/** The series of the histogram option. The tooltip models go to `sink`. */
const optionFor = (frames: DataFrame[], options: Partial<PanelOptions> = {}, sink?: (model: TooltipModel) => void) => {
  const option = buildHistogramOption({
    model: buildHistogramModel(frames, { bucketSize: 10 }, theme)!,
    theme,
    options: { legend, ...options } as PanelOptions,
    fieldConfig: noOverrides,
    isGrafanaLegend: true,
    tooltipSink: sink,
  });
  return option.series as CustomSeriesOption[];
};

/** The `[xMin, xMax, base, top, count]` rows of each series. */
const rowsOf = (series: CustomSeriesOption[]) => series.map((entry) => entry.data);

/** The tooltip model of series `seriesIndex` at bucket `dataIndex`. */
const tooltipOf = (frames: DataFrame[], options: Partial<PanelOptions>, seriesIndex: number, dataIndex: number) => {
  const models: TooltipModel[] = [];
  const series = optionFor(frames, options, (model) => models.push(model));
  const { formatter } = series[seriesIndex].tooltip as { formatter: (params: TopLevelFormatterParams) => string };
  formatter({ dataIndex, seriesIndex } as TopLevelFormatterParams);
  return models[0];
};

describe('buildHistogramOption', () => {
  const twoSeries = [frame({ A: [1, 2, 11], B: [3, 12, 13] })];

  it('draws each series from zero with Stacking Off', () => {
    expect(rowsOf(optionFor(twoSeries))).toEqual([
      [
        [0, 10, 0, 2, 2],
        [10, 20, 0, 1, 1],
      ],
      [
        [0, 10, 0, 1, 1],
        [10, 20, 0, 2, 2],
      ],
    ]);
  });

  it('starts each series on the top of the series before it with Stacking Normal', () => {
    expect(rowsOf(optionFor(twoSeries, { stacking: StackingMode.Normal }))[1]).toEqual([
      [0, 10, 2, 3, 1],
      [10, 20, 1, 3, 2],
    ]);
  });

  it('divides by the total of the bucket with Stacking 100%', () => {
    const series = optionFor(twoSeries, { stacking: StackingMode.Percent });
    const tops = (rowsOf(series)[1] as number[][]).map((row) => row[3]);
    expect(tops).toEqual([1, 1]);
  });

  it('spans the x axis from the first lower bound to the last upper bound', () => {
    const model = buildHistogramModel(twoSeries, { bucketSize: 10 }, theme)!;
    const option = buildHistogramOption({
      model,
      theme,
      options: { legend } as unknown as PanelOptions,
      fieldConfig: noOverrides,
      isGrafanaLegend: true,
      plotWidth: 400,
    });
    expect(option.xAxis).toMatchObject({ type: 'value', min: 0, max: 20, interval: 10 });
  });

  describe('the field min and max, as core prepConfig', () => {
    const limited = (config: { min?: number; max?: number }) =>
      toDataFrame({ fields: [{ name: 'A', type: FieldType.number, values: [1, 2, 11, 25], config }] });
    const optionOf = (config: { min?: number; max?: number }) =>
      buildHistogramOption({
        model: buildHistogramModel([limited(config)], { bucketSize: 10 }, theme)!,
        theme,
        options: { legend } as unknown as PanelOptions,
        fieldConfig: noOverrides,
        isGrafanaLegend: true,
        plotWidth: 400,
      });

    it('rounds the min up and the max down to a multiple of the bucket size', () => {
      expect(optionOf({ min: 5, max: 25 }).xAxis).toMatchObject({ min: 10, max: 20, interval: 10 });
    });

    it('adds one bucket when the max is the lower bound of the last bucket, as core', () => {
      expect(optionOf({ max: 20 }).xAxis).toMatchObject({ min: 0, max: 30 });
      expect(optionOf({ max: 19 }).xAxis).toMatchObject({ min: 0, max: 10 });
    });

    it('keeps the upper bound of the last bucket when only the min is set', () => {
      expect(optionOf({ min: 5 }).xAxis).toMatchObject({ min: 10, max: 30 });
    });

    it('gives the buckets out of the range no bar, so they do not change the count axis', () => {
      const [rows] = rowsOf(optionOf({ min: 5, max: 25 }).series as CustomSeriesOption[]);
      expect(rows).toEqual([
        [0, 10, 0, 0, 0],
        [10, 20, 0, 1, 1],
        [20, 30, 0, 0, 0],
      ]);
    });
  });

  it('gives no more than 50 x ticks when the plot width is not known', () => {
    // Two buckets of size 1, 1000 buckets apart: one tick for each bucket would give 1001 ticks.
    const model = buildHistogramModel([frame({ A: [0.5, 1000.5] })], { bucketSize: 1 }, theme)!;
    const option = buildHistogramOption({
      model,
      theme,
      options: { legend } as unknown as PanelOptions,
      fieldConfig: noOverrides,
      isGrafanaLegend: true,
      plotWidth: undefined,
    });
    expect(option.xAxis).toMatchObject({ min: 0, max: 1001, interval: 21 });
  });
});

// Core draws buckets with names on an ordinal x axis: bucket `i` is from position `i` to `i + 1`, the axis ends
// at the last position, and each position has a tick with the name of its lower bound (`isOrdinalX`).
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/Histogram.tsx
// Core reads the stacking, the fill and the line width from each count field (`prepConfig`, `preparePlotData2`).
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/Histogram.tsx
describe('histogram field settings', () => {
  /** One frame with a field for each entry, with its custom field config. */
  const customFrame = (fields: Array<[string, number[], Record<string, unknown>]>): DataFrame =>
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: fields[0][1].map((_, i) => 1783137094497 + i) },
        ...fields.map(([name, values, custom]) => ({ name, type: FieldType.number, values, config: { custom } })),
      ],
    });
  const stack = (mode: StackingMode, group = 'A') => ({ stacking: { mode, group } });
  const noPanelOptions: Partial<PanelOptions> = {};

  it('stacks the fields of each stacking group on their own, as core getStackingGroups', () => {
    const frames = [
      customFrame([
        ['A', [1, 2, 11], stack(StackingMode.Normal)],
        ['B', [3, 12, 13], stack(StackingMode.Normal, 'B')],
        ['C', [4, 14, 15], stack(StackingMode.Normal)],
        ['D', [5, 16, 17], stack(StackingMode.Normal, 'B')],
      ]),
    ];
    const [a, b, c, d] = rowsOf(optionFor(frames));
    // Group A: C is on A. Group B: D is on B. A and B start at 0.
    expect(a).toEqual([
      [0, 10, 0, 2, 2],
      [10, 20, 0, 1, 1],
    ]);
    expect(b).toEqual([
      [0, 10, 0, 1, 1],
      [10, 20, 0, 2, 2],
    ]);
    expect(c).toEqual([
      [0, 10, 2, 3, 1],
      [10, 20, 1, 3, 2],
    ]);
    expect(d).toEqual([
      [0, 10, 1, 2, 1],
      [10, 20, 2, 4, 2],
    ]);
  });

  it('divides by the total of the bucket in the group with Stacking 100%, and keeps the count axis for a mix', () => {
    const frames = [
      customFrame([
        ['A', [1, 2, 11], stack(StackingMode.Percent)],
        ['B', [3, 12, 13], stack(StackingMode.Percent)],
        ['C', [4, 14, 15], stack(StackingMode.None)],
      ]),
    ];
    const option = buildHistogramOption({
      model: buildHistogramModel(frames, { bucketSize: 10 }, theme)!,
      theme,
      options: { legend, ...noPanelOptions } as PanelOptions,
      fieldConfig: noOverrides,
      isGrafanaLegend: true,
    });
    const [a, b, c] = rowsOf(option.series as CustomSeriesOption[]) as number[][][];
    expect(a.map((row) => row[3])).toEqual([2 / 3, 1 / 3]);
    expect(b.map((row) => row[3])).toEqual([1, 1]);
    expect(c.map((row) => row[3])).toEqual([1, 2]);
    expect(option.yAxis).toEqual(expect.objectContaining({ minInterval: 1 }));
    expect(option.yAxis).not.toEqual(expect.objectContaining({ max: 1 }));
  });

  it('uses the stacking of the field before the panel option', () => {
    const frames = [
      customFrame([
        ['A', [1, 2, 11], stack(StackingMode.None)],
        ['B', [3, 12, 13], {}],
      ]),
    ];
    const [, b] = rowsOf(optionFor(frames, { stacking: StackingMode.Normal }));
    // B stacks with the panel option, but A stacks with nothing, so B starts at 0.
    expect((b as number[][]).map((row) => row[2])).toEqual([0, 0]);
  });
});

describe('getHistogramFill', () => {
  const plot = { y: 10, height: 100 };
  const style = (gradientMode: GraphGradientMode, fillOpacity = 50) => ({
    stacking: StackingMode.None,
    group: 'A',
    fillOpacity,
    lineWidth: 1,
    gradientMode,
  });
  const gradient = (colorStops: unknown) => ({ type: 'linear', x: 0, y: 10, x2: 0, y2: 110, colorStops, global: true });

  it('fills with the color at the fill opacity and a solid border for None and Scheme', () => {
    for (const mode of [GraphGradientMode.None, GraphGradientMode.Scheme]) {
      expect(getHistogramFill('#ff0000', style(mode), theme, plot)).toEqual({ fill: '#ff000080', stroke: '#ff0000' });
    }
  });

  it('fills with a gradient to transparent over the plot for Opacity, with a solid border', () => {
    expect(getHistogramFill('#ff0000', style(GraphGradientMode.Opacity), theme, plot)).toEqual({
      fill: gradient([
        { offset: 0, color: '#ff000080' },
        { offset: 1, color: '#ff000000' },
      ]),
      stroke: '#ff0000',
    });
  });

  it('fills and borders with a hue gradient over the plot for Hue', () => {
    const { fill, stroke } = getHistogramFill('#ff0000', style(GraphGradientMode.Hue), theme, plot);
    expect(fill).toEqual(gradient([expect.objectContaining({ offset: 0 }), expect.objectContaining({ offset: 1 })]));
    expect(stroke).toEqual(gradient([expect.objectContaining({ offset: 0 }), expect.objectContaining({ offset: 1 })]));
    // The fill has the fill opacity, and the border is solid.
    expect(typeof fill === 'object' && fill.colorStops[0].color).toMatch(/0\.5\)$/);
    expect(typeof stroke === 'object' && stroke.colorStops[0].color).toMatch(/^#/);
  });
});

describe('histogram with buckets that have names', () => {
  const leFrame = toDataFrame({
    meta: { type: DataFrameType.HeatmapRows },
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 2] },
      { name: '0.1', type: FieldType.number, values: [1, 2] },
      { name: '1', type: FieldType.number, values: [3, 4] },
      { name: '+Inf', type: FieldType.number, values: [0, 1] },
    ],
  });
  const ordinalOption = (options: Partial<PanelOptions> = {}, sink?: (model: TooltipModel) => void) =>
    buildHistogramOption({
      model: buildHistogramModel([leFrame], {}, theme)!,
      theme,
      options: { legend, ...options } as PanelOptions,
      fieldConfig: noOverrides,
      isGrafanaLegend: true,
      plotWidth: 400,
      tooltipSink: sink,
    });

  it('puts bucket i from position i to i + 1', () => {
    expect(rowsOf(ordinalOption().series as CustomSeriesOption[])).toEqual([
      [
        [0, 1, 0, 3, 3],
        [1, 2, 0, 7, 7],
        [2, 3, 0, 1, 1],
        [3, 4, 0, 0, 0],
      ],
    ]);
  });

  it('ends the x axis at the last position, with a tick for each position', () => {
    expect(ordinalOption().xAxis).toMatchObject({ type: 'value', min: 0, max: 3, interval: 1 });
  });

  it('does not read the field min and max, as core with isOrdinalX', () => {
    const model = buildHistogramModel([leFrame], {}, theme)!;
    model.counts[0].config = { ...model.counts[0].config, min: 1, max: 2 };
    const option = buildHistogramOption({
      model,
      theme,
      options: { legend } as unknown as PanelOptions,
      fieldConfig: noOverrides,
      isGrafanaLegend: true,
      plotWidth: 400,
    });
    expect(option.xAxis).toMatchObject({ min: 0, max: 3, interval: 1 });
    expect(rowsOf(option.series as CustomSeriesOption[])).toEqual(
      rowsOf(ordinalOption().series as CustomSeriesOption[])
    );
  });

  it('labels each tick with the name of the lower bound of its bucket', () => {
    const { axisLabel } = ordinalOption().xAxis as { axisLabel: { formatter: (value: number) => string } };
    expect([0, 1, 2, 3].map(axisLabel.formatter)).toEqual(['0', '0.1', '1', '+Inf']);
  });

  it('gives the bucket names in the tooltip header', () => {
    const models: TooltipModel[] = [];
    const [series] = ordinalOption({}, (model) => models.push(model)).series as CustomSeriesOption[];
    const { formatter } = series.tooltip as { formatter: (params: TopLevelFormatterParams) => string };
    formatter({ dataIndex: 1, seriesIndex: 0 } as TopLevelFormatterParams);
    expect(models[0].header).toEqual({ label: 'Bucket', value: '0.1 - 1' });
  });
});

describe('histogram tooltip', () => {
  const frames = [frame({ A: [1, 2, 11], B: [3, 12, 13] })];

  it('gives the bucket range in the header and the hovered count in Single mode', () => {
    const model = tooltipOf(frames, {}, 1, 1);
    expect(model.header).toEqual({ label: 'Bucket', value: '10 - 20', coordinate: { type: 'number', value: 10 } });
    expect(model.rows.map(({ label, value, rawValue }) => [label, value, rawValue])).toEqual([['B', '2', 2]]);
    expect(model.source?.rowIndex).toBe(1);
  });

  it('lists the count of each series in the bucket in "All" mode', () => {
    const model = tooltipOf(frames, { tooltip: { mode: TooltipDisplayMode.Multi } as never }, 1, 0);
    expect(model.rows.map(({ label, value, emphasis }) => [label, value, emphasis])).toEqual([
      ['A', '2', false],
      ['B', '1', true],
    ]);
  });

  // Core changes a count of 0 to null (`preparePlotData` in `Histogram.tsx`), so a value mapping of 0 does not
  // apply. The row shows the "No value" text, or the row is not shown (`getFieldDisplayItems`).
  describe('a count of 0', () => {
    const multi = { tooltip: { mode: TooltipDisplayMode.Multi } as never };
    const zeroMapping: ValueMapping[] = [{ type: MappingType.ValueToText, options: { '0': { text: 'zero' } } }];
    const withConfig = (config: FieldConfig) =>
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'A', type: FieldType.number, values: [1, 2, 11], config },
          { name: 'B', type: FieldType.number, values: [12, 13, 14], config },
        ],
      });

    it('shows the "No value" text of the field, not the value mapping of 0', () => {
      const model = tooltipOf([withConfig({ mappings: zeroMapping, noValue: 'none' })], multi, 0, 0);
      expect(model.rows.map(({ label, value }) => [label, value])).toEqual([
        ['A', '2'],
        ['B', 'none'],
      ]);
    });

    it('shows no row for a field with no "No value" text', () => {
      const model = tooltipOf([withConfig({ mappings: zeroMapping })], multi, 0, 0);
      expect(model.rows.map(({ label, value }) => [label, value])).toEqual([['A', '2']]);
    });
  });

  it('formats the bucket range with the unit of the bucketed field', () => {
    const model = tooltipOf([frame({ A: [100, 250] }, 'ms')], {}, 0, 0);
    expect(model.header.value).toBe('100 ms - 110 ms');
  });
});

describe('histogram mode in the panel option', () => {
  const ctx = (options: Partial<PanelOptions>): ChartContext => ({
    frames: [frame({ A: [1, 2, 11] })],
    theme,
    timeZone: 'utc',
    timeRange: { from: dateTime(1783137094497), to: dateTime(1783147894497), raw: { from: 'now-3h', to: 'now' } },
    options: { legend, histogram: true, bucketSize: 10, ...options } as PanelOptions,
    seriesType: 'line',
    formatValue: (value) => ({ text: String(value) }),
    replaceVariables: (value: string) => value,
    fieldConfig: noOverrides,
  });

  it('draws custom bar series on a value x axis, also for frames with a time field', () => {
    const option = buildPanelChartOption(ctx({}), { isGrafanaLegend: true })!;
    expect(option.xAxis).toMatchObject({ type: 'value' });
    expect((option.series as CustomSeriesOption[]).map((entry) => entry.type)).toEqual(['custom']);
    // No drag-to-zoom brush: the x axis is not a time axis.
    expect(option.brush).toBeUndefined();
  });

  it('uses the tooltip of each bar in "All" mode, which lists every count of the bucket', () => {
    const option = buildPanelChartOption(ctx({ tooltip: { mode: TooltipDisplayMode.Multi } as never }), {
      isGrafanaLegend: true,
    })!;
    expect(option.tooltip).toMatchObject({ trigger: 'item' });
  });

  it('lists one legend item for each series', () => {
    const items = cartesianChartModule.buildLegendItems(ctx({}), []);
    expect(items.map((item) => item.label)).toEqual(['A']);
  });

  it('draws the normal chart when the histogram switch is off', () => {
    const option = buildPanelChartOption(ctx({ histogram: false }), { isGrafanaLegend: true })!;
    expect(option.xAxis).toMatchObject({ type: 'time' });
  });
});
