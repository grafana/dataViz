import { getMultivariateIssue } from './multivariateIssue';
import { PARALLEL_LINE_OPACITY_DEFAULT, PARALLEL_SMOOTH_DEFAULT } from 'editor/parallel';
import { frameToMultivariate, type MultivariateModel } from 'lib/echarts/converters/multivariate';
import { parallelToEChartsOption } from 'lib/echarts/converters/parallel';
import { radarToEChartsOption } from 'lib/echarts/converters/radar';
import { DEFAULT_CHART_LEGEND, resolveEChartsLegend } from 'lib/echarts/options/legend';
import { buildRadarLegendItems } from 'lib/echarts/options/legendItems';
import { getParallelComponent, getParallelLineStyle, parallelDefaultOptions } from 'lib/echarts/options/parallel';
import {
  getRadarAreaStyle,
  getRadarComponent,
  getRadarLineStyle,
  getRadarSymbol,
  radarDefaultOptions,
} from 'lib/echarts/options/radar';
import { getFieldValueFormatters } from 'lib/echarts/style';
import {
  type BaseOptionParts,
  type ChartContext,
  type ChartModule,
  type EChartParallelSeriesOption,
  type EChartRadarSeriesOption,
} from './types';

/**
 * Multivariate chart family: radar and parallel coordinates, built from the
 * same multivariate model (each number field -> one axis, each row -> one
 * polygon or line; see `converters/multivariate.ts`). `buildOption` dispatches on
 * `ctx.seriesType` (mirrors `hierarchyChartModule`) to pick the coordinate
 * system. Both render types draw the visible rows as the data items of one
 * series, so the legend and the tooltip resolvers serve both unchanged. See
 * `modules/multivariate/parity.md`.
 */

/** Radar render: one indicator for each number field, one polygon for each visible row. */
function buildRadarOption(ctx: ChartContext, isGrafanaLegend: boolean): EChartRadarSeriesOption | null {
  const { frames, theme, options, fieldConfig } = ctx;
  const radar = radarToEChartsOption(frames, theme, fieldConfig);

  if (!radar) {
    return null;
  }

  // Advanced series style (fill / line width / symbol), each omitted at its
  // default so an untouched radar renders unchanged.
  const areaStyle = getRadarAreaStyle(options.radarFillArea);
  const lineStyle = getRadarLineStyle(options.radarLineWidth);
  const symbol = getRadarSymbol(options.radarSymbolSize);

  return {
    ...radarDefaultOptions,
    legend: resolveEChartsLegend(
      isGrafanaLegend,
      options.legend,
      theme,
      radar.data.map((polygon) => polygon.name)
    ),
    // Advanced shape / rings on the radar coordinate component, plus its layout
    // box and themed indicator names. As with parallel, only a native ECharts
    // legend needs room reserved — a Grafana DOM legend is laid out by
    // `VizLayout` before the canvas exists.
    radar: getRadarComponent(
      radar.indicator,
      options.radarShape,
      options.radarSplitNumber,
      theme,
      isGrafanaLegend ? undefined : options.legend
    ),
    series: [
      {
        type: 'radar',
        data: radar.data,
        ...(areaStyle ? { areaStyle } : {}),
        ...(lineStyle ? { lineStyle } : {}),
        ...symbol,
      },
    ],
  };
}

/**
 * Parallel-coordinates render: one `parallelAxis` for each number field (a value
 * axis that auto-scales to its own data), one polyline for each visible row,
 * colored through each data item's `lineStyle`.
 */
function buildParallelOption(ctx: ChartContext, isGrafanaLegend: boolean): EChartParallelSeriesOption | null {
  const { frames, theme, options, fieldConfig } = ctx;
  const parallel = parallelToEChartsOption(frames, theme, fieldConfig);

  if (!parallel) {
    return null;
  }

  // Advanced series style (line width / opacity) and the Default-tier smooth
  // toggle. Width and smooth are omitted at their defaults so an untouched
  // parallel chart renders on ECharts' own. Opacity is the exception: it resolves
  // through our own default (fully opaque) because ECharts' 0.45 is too faint —
  // see `PARALLEL_LINE_OPACITY_DEFAULT`. Cleared-to-empty therefore lands on 100
  const lineOpacity = options.parallelLineOpacity ?? PARALLEL_LINE_OPACITY_DEFAULT;
  const lineStyle = getParallelLineStyle(options.parallelLineWidth, lineOpacity);
  const smooth = options.parallelSmooth ?? PARALLEL_SMOOTH_DEFAULT;

  return {
    ...parallelDefaultOptions,
    legend: resolveEChartsLegend(
      isGrafanaLegend,
      options.legend,
      theme,
      parallel.data.map((line) => line.name)
    ),
    // The `parallel` coordinate component carries the Advanced layout, the
    // layout box and the shared axis styling; the axes are their own top-level
    // `parallelAxis` array — one value axis per number field, positioned by `dim`.
    parallel: getParallelComponent(
      options.parallelLayout,
      theme,
      isGrafanaLegend ? undefined : options.legend,
      parallel.axes.map((axis) => axis.name)
    ),
    parallelAxis: parallel.axes.map((axis, dim) => ({ dim, name: axis.name, type: 'value' })),
    series: [
      {
        type: 'parallel',
        // Per-line color rides on each data item's `lineStyle.color` (the
        // documented per-line form); the series-level `lineStyle` below carries
        // the shared width/opacity.
        data: parallel.data.map((line) => ({
          // `name` is needed for tooltip header
          name: line.name,
          value: line.value,
          lineStyle: line.lineStyle,
        })),
        ...(smooth ? { smooth: true } : {}),
        ...(lineStyle ? { lineStyle } : {}),
        // Place the series on its own canvas layer (see the panel's
        // `zLevel.series`), matching the other families so layered canvas capture
        // can isolate it (also what the canvas tests read).
        zlevel: options.zLevel?.series,
      },
    ],
  };
}

export const multivariateChartModule: ChartModule = {
  legend: DEFAULT_CHART_LEGEND,

  getDataIssue(ctx) {
    return getMultivariateIssue(ctx.frames, ctx.theme, ctx.seriesType === 'parallel' ? 'parallel' : 'radar');
  },

  // A hover is one item (a polygon or a line), whose rows are its axes (see
  // `getTooltipDimensions`). "All" would add nothing to that, so the family is Single/Hidden only.
  singleTooltipOnly: true,

  // One tooltip row for each axis. Radar and parallel items hold only the axis values.
  getTooltipDimensions(ctx) {
    return multivariateModel(ctx)?.axes.map(({ name }) => name);
  },
  tooltipDimensionOffset: 0,

  getTooltipValueFormatter(ctx) {
    // Each axis is one number field, so each tooltip row formats with the
    // formatter of its own field (unit, decimals).
    const fields = multivariateModel(ctx)?.axes.map(({ field }) => field) ?? [];
    const formatters = getFieldValueFormatters(fields, ctx.theme, ctx.timeZone);
    return ({ dimensionIndex }) => (dimensionIndex != null ? formatters[dimensionIndex] : undefined) ?? ctx.formatValue;
  },

  getTooltipFieldResolver(ctx) {
    // `dataIndex` is the visible row, `dimensionIndex` the axis. Without an axis,
    // the first axis field gives the links of the row.
    const model = multivariateModel(ctx);
    const visible = model?.items.filter((item) => !item.hidden) ?? [];
    return ({ dataIndex, dimensionIndex }) => {
      const item = dataIndex != null ? visible[dataIndex] : undefined;
      const axis = model?.axes[dimensionIndex ?? 0];
      return item && axis ? { field: axis.field, rowIndex: item.rowIndex } : undefined;
    };
  },

  buildOption(
    ctx: ChartContext,
    { isGrafanaLegend }: BaseOptionParts
  ): EChartRadarSeriesOption | EChartParallelSeriesOption | null {
    if (ctx.seriesType === 'parallel') {
      return buildParallelOption(ctx, isGrafanaLegend);
    }
    // Radar is the family default: an unset/`'Auto'` seriesType resolves to radar
    // upstream (see `resolveAutoSeriesType`), so anything not `parallel` is radar.
    return buildRadarOption(ctx, isGrafanaLegend);
  },

  buildLegendItems(ctx) {
    return buildRadarLegendItems(ctx.frames, ctx.theme, ctx.fieldConfig);
  },
};

/** The multivariate model of the panel data, which the tooltip resolvers index into. */
function multivariateModel(ctx: ChartContext): MultivariateModel | null {
  return frameToMultivariate(ctx.frames, ctx.theme, ctx.fieldConfig);
}

/**
 * Transition alias: the family was renamed from `radar` to `multivariate` to
 * make room for parallel coordinates. Kept so existing `radarChartModule`
 * references (e.g. the registry re-export) keep resolving during the transition.
 */
export const radarChartModule = multivariateChartModule;
