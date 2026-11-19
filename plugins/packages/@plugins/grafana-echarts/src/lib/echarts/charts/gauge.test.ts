import { createTheme, dateTime, FieldType, type TimeRange, toDataFrame, type ValueFormatter } from '@grafana/data';
import { type GaugeSeriesOption } from 'echarts';
import { type ChartContext } from 'lib/echarts/charts/types';
import { gaugeFieldConfig, gaugeFrame } from 'test/gaugeCanvas';
import { applyGrafanaFieldDefaults } from 'test/panel';
import { type PanelOptions } from 'types';
import { gaugeChartModule, resolveGaugeModel } from './gauge';

const theme = createTheme();
const timeRange: TimeRange = { from: dateTime(1000), to: dateTime(3000), raw: { from: 'now-1h', to: 'now' } };
const formatValue: ValueFormatter = (value) => ({ text: String(value) });
const base = { isGrafanaLegend: true, plotWidth: 400, plotHeight: 300 };

const makeContext = (
  frames = [gaugeFrame({ cpu: [10, 40, 72] })],
  options: Partial<PanelOptions> = {}
): ChartContext => ({
  frames: applyGrafanaFieldDefaults(frames),
  theme,
  timeZone: 'utc',
  timeRange,
  options: options as PanelOptions,
  seriesType: 'gauge',
  family: 'gauge',
  formatValue,
  fieldConfig: { defaults: {}, overrides: [] },
  replaceVariables: (value: string) => value,
});

const buildSeries = (ctx: ChartContext, parts = base) =>
  (gaugeChartModule.buildOption(ctx, parts)?.series ?? []) as GaugeSeriesOption[];

describe('gaugeChartModule', () => {
  describe('resolveGaugeModel', () => {
    it('reduces each number field to one gauge value with the last value', () => {
      const [value] = resolveGaugeModel(makeContext());
      expect(value).toMatchObject({ name: 'cpu', numeric: 72, min: 0, max: 100 });
      expect(value.thresholds.map((stop) => stop.to)).toEqual([0.6, 0.8, 1]);
    });

    it('colors the value from the threshold step that it is in', () => {
      const [low, high] = resolveGaugeModel(makeContext([gaugeFrame({ low: [10], high: [95] })]));
      expect(low.color).toBe(theme.visualization.getColorByName('green'));
      expect(high.color).toBe(theme.visualization.getColorByName('red'));
    });

    it('gives a percent field with no limits the range 0 to 100', () => {
      const frame = gaugeFrame(
        { load: [45, 55] },
        gaugeFieldConfig({ min: undefined, max: undefined, unit: 'percent' })
      );
      expect(resolveGaugeModel(makeContext([frame]))[0]).toMatchObject({ min: 0, max: 100, text: '55%' });
    });

    // The options of the suggestion for a small table (`modules/gauge/suggestions.ts`).
    it('gives one gauge for each row with all values, named by the string field', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'host', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'load', type: FieldType.number, values: [10, 40, 72], config: gaugeFieldConfig() },
        ],
      });
      const all = resolveGaugeModel(makeContext([frame], { reduceOptions: { values: true, calcs: [] } }));
      expect(all.map((value) => [value.name, value.numeric])).toEqual([
        ['a', 10],
        ['b', 40],
        ['c', 72],
      ]);
      // With no reduce options, the same frame gives one gauge with the last row.
      expect(resolveGaugeModel(makeContext([frame])).map((value) => value.numeric)).toEqual([72]);
    });
  });

  describe('buildOption', () => {
    it('draws a threshold band and a value bar for one value', () => {
      const series = buildSeries(makeContext());
      expect(series).toHaveLength(2);
      expect(series.every((entry) => entry.type === 'gauge')).toBe(true);
      expect(series[1].data).toEqual([{ value: 72, name: 'cpu' }]);
    });

    it('draws the bar only when the threshold band is off', () => {
      expect(buildSeries(makeContext(undefined, { showThresholdMarkers: false }))).toHaveLength(1);
    });

    it('draws the bar only for a field with no threshold step', () => {
      const frame = gaugeFrame({ cpu: [72] }, gaugeFieldConfig({ thresholds: undefined }));
      expect(buildSeries(makeContext([frame]))).toHaveLength(1);
    });

    it('draws one gauge for each value, each in its own cell', () => {
      const frame = gaugeFrame({ cpu: [72], memory: [35], disk: [91], network: [58] });
      const bars = buildSeries(makeContext([frame], { showThresholdMarkers: false }));
      expect(bars).toHaveLength(4);
      expect(new Set(bars.map((bar) => JSON.stringify(bar.center))).size).toBe(4);
    });

    // A viz spec, or panel JSON that a person edits, can have a value that the editor cannot give.
    it.each([
      ['shape', { shape: 'arc' }],
      ['shape', { shape: 7 }],
      ['barWidthFactor', { barWidthFactor: 'wide' }],
      ['barWidthFactor', { barWidthFactor: NaN }],
      ['textMode', { textMode: 'both' }],
      ['showThresholdMarkers', { showThresholdMarkers: 0 }],
    ])('draws %s with its default for the value %j', (_name, options) => {
      // Without the functions: each build makes a new value formatter.
      const plain = (series: GaugeSeriesOption[]) => JSON.parse(JSON.stringify(series));
      const defaults = buildSeries(makeContext());
      // The wrong values are not values of the option types.
      const series = buildSeries(makeContext(undefined, options as unknown as Partial<PanelOptions>));
      expect(plain(series)).toEqual(plain(defaults));
      for (const one of series) {
        expect([one.radius, ...(one.center as number[])].every(Number.isFinite)).toBe(true);
      }
    });

    it('gives all gauges of a panel the same font sizes', () => {
      const frame = gaugeFrame({ a: [1], longer_name: [123456] });
      const bars = buildSeries(makeContext([frame], { showThresholdMarkers: false }));
      expect(bars[0].detail?.fontSize).toBe(bars[1].detail?.fontSize);
      expect(bars[0].title?.fontSize).toBe(bars[1].title?.fontSize);
    });

    it('uses the angles of the shape option', () => {
      const [bar] = buildSeries(makeContext(undefined, { shape: 'circle', showThresholdMarkers: false }));
      expect(bar).toMatchObject({ startAngle: 90, endAngle: -270 });
    });

    it('limits the bar width factor to the range of the editor', () => {
      const widest = buildSeries(makeContext(undefined, { barWidthFactor: 1, showThresholdMarkers: false }))[0];
      const tooWide = buildSeries(makeContext(undefined, { barWidthFactor: 9, showThresholdMarkers: false }))[0];
      expect(tooWide.progress?.width).toBe(widest.progress?.width);
    });

    it('shows the name in the secondary text color below a value, and in the primary color alone', () => {
      const withValue = buildSeries(makeContext(undefined, { textMode: 'value_and_name' })).at(-1);
      const alone = buildSeries(makeContext(undefined, { textMode: 'name' })).at(-1);
      expect(withValue?.title?.color).toBe(theme.colors.text.secondary);
      expect(alone?.title?.color).toBe(theme.colors.text.primary);
    });

    it('puts the series on the canvas layer of the panel options', () => {
      const series = buildSeries(makeContext(undefined, { zLevel: { series: 3 } }));
      expect(series.map((entry) => entry.zlevel)).toEqual([3, 3]);
    });

    it.each([
      ['no number field', { ...base }, []],
      ['no width', { ...base, plotWidth: 0 }, undefined],
      ['no size yet', { isGrafanaLegend: true }, undefined],
    ] as const)('gives no option for %s', (_, parts, frames) => {
      expect(gaugeChartModule.buildOption(makeContext(frames ? [...frames] : undefined), parts)).toBeNull();
    });
  });

  it('has no legend and no tooltip, as core Gauge', () => {
    expect(gaugeChartModule.legend.showLegend).toBe(false);
    expect(gaugeChartModule.buildLegendItems(makeContext(), [])).toEqual([]);
    expect(gaugeChartModule.getTooltipOption?.(makeContext())).toEqual({ show: false });
  });
});
