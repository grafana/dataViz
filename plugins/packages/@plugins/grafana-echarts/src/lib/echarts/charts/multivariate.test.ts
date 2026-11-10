import { createTheme, type DataFrame, type FieldConfigSource, FieldType, toDataFrame } from '@grafana/data';
import { multivariateChartModule, radarChartModule } from 'lib/echarts/charts/multivariate';
import { type ChartContext } from 'lib/echarts/charts/types';
import { type PanelOptions } from 'types';

const theme = createTheme();

const tableFrame = (): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'team', type: FieldType.string, values: ['Sales', 'Admin'] },
      { name: 'Budget', type: FieldType.number, values: [43, 10], config: { unit: 'currencyUSD' } },
      { name: 'Actual', type: FieldType.number, values: [50, 14], config: { unit: 'percent' } },
      { name: 'Forecast', type: FieldType.number, values: [30, 28] },
    ],
  });

const noOverrides: FieldConfigSource = { defaults: {}, overrides: [] };

const hideSales: FieldConfigSource = {
  defaults: {},
  overrides: [
    {
      matcher: { id: 'byName', options: 'Sales' },
      properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: false } }],
    },
  ],
};

/**
 * Minimal context for the tooltip resolvers, which only read the frames, theme,
 * field config, time zone and panel-wide fallback formatter.
 */
const makeContext = (fieldConfig: FieldConfigSource = noOverrides): ChartContext =>
  ({
    frames: [tableFrame()],
    theme,
    fieldConfig,
    timeZone: 'utc',
    formatValue: (value: unknown) => ({ text: String(value) }),
    options: {},
  }) as unknown as ChartContext;

// Radar and parallel are one module over one multivariate model: each row becomes
// a single data item (a polygon / a polyline) of a single series, and each number
// field is one axis. The tooltip lists one row per axis (`dimensionIndex`) for the
// hovered item (`dataIndex`), so the resolvers are shared by both render types.
describe('multivariateChartModule tooltips', () => {
  it('clamps the tooltip to Single for the whole family', () => {
    // A hover already lists every axis of one item, so "All" has nothing to add.
    expect(multivariateChartModule.singleTooltipOnly).toBe(true);
  });

  it('lists one tooltip row per axis, read from the start of the item value', () => {
    expect(multivariateChartModule.getTooltipDimensions?.(makeContext())).toEqual(['Budget', 'Actual', 'Forecast']);
    expect(multivariateChartModule.tooltipDimensionOffset).toBe(0);
  });

  it('formats each axis row with the unit of its own field', () => {
    const resolve = multivariateChartModule.getTooltipValueFormatter!(makeContext());

    expect(resolve({ dataIndex: 0, dimensionIndex: 0 })(12).prefix).toBe('$');
    expect(resolve({ dataIndex: 0, dimensionIndex: 1 })(12).suffix?.trim()).toBe('%');
  });

  it('resolves each axis row to its field at the row of the hovered item', () => {
    const resolve = multivariateChartModule.getTooltipFieldResolver!(makeContext());

    expect(resolve({ dataIndex: 1, dimensionIndex: 1 })).toMatchObject({ field: { name: 'Actual' }, rowIndex: 1 });
    // Without an axis, the first axis gives the links of the row.
    expect(resolve({ dataIndex: 1 })).toMatchObject({ field: { name: 'Budget' }, rowIndex: 1 });
  });

  it('maps a dataIndex to the visible rows when a row is hidden', () => {
    const resolve = multivariateChartModule.getTooltipFieldResolver!(makeContext(hideSales));

    // The first data item is now the second row (Admin).
    expect(resolve({ dataIndex: 0, dimensionIndex: 0 })).toMatchObject({ rowIndex: 1 });
  });

  it('resolves no field for a missing or out-of-range dataIndex', () => {
    const resolve = multivariateChartModule.getTooltipFieldResolver!(makeContext());
    expect(resolve({})).toBeUndefined();
    expect(resolve({ dataIndex: 99 })).toBeUndefined();
  });

  it('keeps the radar alias pointing at the family module', () => {
    expect(radarChartModule).toBe(multivariateChartModule);
  });
});

describe('multivariateChartModule parallel option', () => {
  const buildParallel = (options: Partial<PanelOptions> = {}) => {
    const ctx = {
      frames: [tableFrame()],
      theme,
      fieldConfig: noOverrides,
      timeZone: 'utc',
      seriesType: 'parallel',
      formatValue: (value: unknown) => ({ text: String(value) }),
      options,
    } as unknown as ChartContext;
    return multivariateChartModule.buildOption(ctx, { isGrafanaLegend: true } as never) as {
      parallelAxis: Array<{ name: string }>;
      series: Array<{ data: Array<{ name?: string }>; lineStyle?: { opacity?: number } }>;
    };
  };

  // The family renders one series, so `series.name` cannot identify a line and
  // the tooltip header falls back to the data item's own `name`. Dropping it
  // here is what left the parallel tooltip with an empty header.
  it('names each polyline so the tooltip header can label it', () => {
    expect(buildParallel().series[0].data.map((item) => item.name)).toEqual(['Sales', 'Admin']);
  });

  it('draws one parallel axis per number field', () => {
    expect(buildParallel().parallelAxis.map((axis) => axis.name)).toEqual(['Budget', 'Actual', 'Forecast']);
  });

  // ECharts' own default is 0.45, which reads as washed out against Grafana's
  // palette; an unset opacity must resolve to our fully-opaque default instead.
  it('draws fully opaque lines when no opacity is configured', () => {
    expect(buildParallel().series[0].lineStyle?.opacity).toBe(1);
  });

  it('still honours a configured opacity, including zero', () => {
    expect(buildParallel({ parallelLineOpacity: 40 }).series[0].lineStyle?.opacity).toBe(0.4);
    expect(buildParallel({ parallelLineOpacity: 0 }).series[0].lineStyle?.opacity).toBe(0);
  });
});

describe('multivariateChartModule legend', () => {
  it('lists one item per row, greys a hidden row, and has no calc values', () => {
    const items = multivariateChartModule.buildLegendItems!(makeContext(hideSales), ['max']);

    expect(items.map((item) => [item.label, item.disabled])).toEqual([
      ['Sales', true],
      ['Admin', false],
    ]);
    expect(items[0].getDisplayValues?.()).toEqual([]);
  });
});
