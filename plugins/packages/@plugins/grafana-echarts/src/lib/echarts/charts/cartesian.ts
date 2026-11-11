import { getDuplicateFieldIssue, getFieldShapeIssue, getTextNumberIssue } from './dataShape';
import { type Field } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import {
  type CartesianAxisOption,
  type XAXisOption,
  type YAXisOption,
} from 'echarts/types/src/coord/cartesian/AxisModel';
import {
  type CartesianSingleValueSeriesType,
  type EChartsGraphFieldConfig,
  type MultiValueSeriesType,
  type SeriesType,
} from 'editor/types';
import { buildCartesianYAxes, getAxisGridSpacing } from 'lib/echarts/axes/yAxes';
import { isCartesianSingleValueSeriesType, isMultiValueSeriesType } from 'lib/echarts/charts/narrowing';
import { categoryCartesianToEChartsOption } from 'lib/echarts/converters/categoryCartesian';
import { categoryCartesianFields } from 'lib/echarts/converters/categoryCartesianModel';
import {
  resolveFieldSeriesType,
  resolveFieldSpanNulls,
  resolveFieldStack,
} from 'lib/echarts/converters/fieldOverrides';
import {
  collectTimeSeriesFields,
  forEachTimeSeriesField,
  framesHaveTimeField,
  joinStackedFieldsOnTime,
} from 'lib/echarts/converters/frames';
import { isHistogramPanel } from 'lib/echarts/converters/histogram';
import { isSpanNullsThreshold } from 'lib/echarts/converters/spanNulls';
import {
  getBoxplotDataIssue,
  getCandlestickDataIssue,
  multiValueCartesianToEChartsOption,
  resolveMultiValueSources,
} from 'lib/echarts/converters/multiValueCartesian';
import { getDrawnSeries, isTimeSeriesStacked, timeSeriesToEChartsOption } from 'lib/echarts/converters/timeSeries';
import { getCartesianGrid, getTimeCartesianGrid } from 'lib/echarts/grid/grid';
import { ANNOTATION_LANE_SIZE, buildAnnotationMarkerSeries } from 'lib/echarts/options/annotationMarkers';
import { buildAnnotationSeries, toCategoryAnnotationMarks } from 'lib/echarts/options/annotations';
import { AXIS_FONT_SIZE } from 'lib/echarts/options/base';
import { isHorizontalBars, resolvePanelStacking } from 'lib/echarts/options/bars';
import {
  cartesianCategoryDefaultOptions,
  cartesianTimeDefaultOptions,
  getCartesianAxisStyle,
  getTimeAxisBounds,
  getXTickRotate,
  mergeAxisStyle,
} from 'lib/echarts/options/cartesian';
import { DEFAULT_CHART_LEGEND, resolveEChartsLegend } from 'lib/echarts/options/legend';
import {
  buildCategoryCartesianLegendItems,
  buildMultiValueCartesianLegendItems,
  buildTimeSeriesLegendItems,
} from 'lib/echarts/options/legendItems';
import { buildThresholdMarks, type ThresholdMarks } from 'lib/echarts/options/thresholds';
import { getCartesianSeriesColor, getFieldValueFormatters } from 'lib/echarts/style';
import { buildAnnotationTooltipModel } from 'lib/echarts/tooltip/annotation';
import { indexedFormatterResolver } from 'lib/echarts/tooltip/model';
import { getFieldMinMax } from 'lib/grafana/fields/fieldConfig';
import { getHiddenSeriesNames } from 'lib/grafana/fields/seriesConfig';
import {
  findThresholdField,
  getThresholdsStyleMode,
  resolveFieldThresholds,
  thresholdDisplayForMode,
} from 'lib/grafana/fields/thresholds';
import { isNumberField } from 'lib/grafana/narrowing';
import { getXTickSpacing } from 'lib/echarts/axes/xTickSpacing';
import { getSeriesExtents } from 'lib/echarts/axes/yTicks';
import { getTimeXTicks } from 'lib/echarts/axes/timeXTicks';
import { getTimeAxisLabelFormatter, isUtcTimeZone } from 'lib/grafana/timeAxisFormat';
import { countAnnotationLanes, readAnnotationDisplay, readAnnotations } from 'lib/grafana/annotations';
import { type FieldTypedDataFrame } from 'lib/grafana/types';
import { type PanelOptions } from 'types';
import {
  type BaseOptionParts,
  type CartesianContext,
  type ChartContext,
  type ChartModule,
  type ChartNotice,
  type EChartCartesianSeriesOption,
  type EChartMultiValueCartesianSeriesOption,
} from './types';
import { buildHistogramChartOption, buildHistogramLegendItems, getHistogramDataIssue } from './histogram';

// Cartesian family (Groups 1-2). The x-axis mode follows the data, not the
// series type: time frames render on a `time` axis, while Numeric frames with no
// time field render on a `category` axis built from the shared categorical
// model.

/** The height in pixels of the time axis labels and the grid padding, below and above the value axes. */
const TIME_X_AXIS_SPACE = 30;

/** Time-axis cartesian: `[time, value]` series on a time grid. */
function buildTimeOption(
  ctx: ChartContext<CartesianSingleValueSeriesType, EChartsGraphFieldConfig>,
  { isGrafanaLegend, plotWidth, plotHeight }: BaseOptionParts
): EChartCartesianSeriesOption | null {
  const { theme, options, formatValue, timeZone } = ctx;
  const timeCtx = { ...ctx, frames: cartesianTimeFrames(ctx) };

  // Support rendering time without series
  const cartSeries = timeSeriesToEChartsOption(timeCtx, { horizontal: false, plotLength: plotWidth }) ?? [];

  const axisStyle = getCartesianAxisStyle(theme);

  // One y-axis per distinct field unit; each series is pinned to its unit's axis.
  const fields = cartesianSeriesFields(ctx);
  const axes = buildCartesianYAxes({
    fields,
    baseYAxis: cartesianTimeDefaultOptions.yAxis,
    axisStyle,
    theme,
    timeZone,
    fallbackFormatter: formatValue,
    zlevel: options.zLevel?.axis,
    ...getBarFieldSets(fields, ctx, true),
    colorOf: (field) => getCartesianSeriesColor(field, timeCtx.frames, theme),
    // The value axes are the plot height less the grid padding and the time axis labels.
    ...(plotHeight != null && plotHeight > TIME_X_AXIS_SPACE
      ? { coreTicks: { axisLength: plotHeight - TIME_X_AXIS_SPACE, fieldExtents: getSeriesExtents(cartSeries) } }
      : {}),
  });
  const indexedSeries = cartSeries.map((cartesian, i) => ({ ...cartesian, yAxisIndex: axes.seriesYAxisIndex[i] ?? 0 }));
  const thresholdSeries = attachThresholdMarks(indexedSeries, cartesianThresholdMarks(ctx, false));
  // The annotation series go last, so the index of each data series stays its field index
  // (see `cartesianSeriesFields`): the lines and bands, then the markers under the plot.
  const annotations = readAnnotations(ctx.annotations, theme);
  const annotationDisplay = readAnnotationDisplay(options.annotations);
  const annotationRange = getTimeAxisBounds(ctx.timeRange);
  const annotationSeries = [
    buildAnnotationSeries(annotations, annotationRange, options.zLevel?.series, annotationDisplay),
    buildAnnotationMarkerSeries(annotations, annotationRange, {
      tooltip: (index) => buildAnnotationTooltipModel(annotations[index], timeZone),
      sink: ctx.tooltipSink,
      zlevel: options.zLevel?.series,
      multiLane: annotationDisplay.multiLane,
    }),
  ].filter((entry) => entry != null);
  const series = [...thresholdSeries, ...annotationSeries];

  // Pin the time axis to the dashboard range so gaps in this panel's data still
  // align with sibling panels sharing the same range. Labels are formatted via
  // Grafana's timezone-aware formatter (ECharts' built-in date labels would
  // render in browser-local time, ignoring the dashboard timezone).
  const xTicks = getTimeXTicks(ctx.timeRange, ctx.timeZone, plotWidth);
  const xAxis = mergeAxisStyle<XAXisOption>(cartesianTimeDefaultOptions.xAxis, axisStyle, {
    ...getTimeAxisBounds(ctx.timeRange),
    // The axis is the time range also for bars, as core: edge bars are half cut (#1086).
    // https://echarts.apache.org/en/option.html#xAxis.containShape
    containShape: false,
    ...xTicks,
    axisLabel: {
      ...xTicks.axisLabel,
      ...getXTickRotate(options.xTickRotate),
      ...getAnnotationLaneMargin(annotationDisplay.multiLane, countAnnotationLanes(ctx.annotations)),
    },
  });

  return {
    ...cartesianTimeDefaultOptions,
    // Place time ticks on UTC boundaries for a UTC dashboard. Omitted otherwise (default false).
    // https://echarts.apache.org/en/option.html#useUTC
    ...(isUtcTimeZone(timeZone) ? { useUTC: true } : {}),
    legend: resolveEChartsLegend(isGrafanaLegend, options.legend, theme),
    grid: getTimeCartesianGrid(isGrafanaLegend ? undefined : options.legend, getBarLabelSpace(cartSeries)),
    xAxis,
    yAxis: axes.yAxis,
    series,
  };
}

/** Category-axis cartesian: plain y-values over a category x-axis, or horizontal bars. */
function buildCategoryOption(
  ctx: ChartContext<CartesianSingleValueSeriesType>,
  { isGrafanaLegend, plotWidth, plotHeight }: BaseOptionParts
): EChartCartesianSeriesOption | null {
  const { theme, options, formatValue, seriesType, timeZone } = ctx;

  if (!isCartesianSingleValueSeriesType(seriesType)) {
    throw new Error(`Categorical-x requires a cartesian series type! ${seriesType}`);
  }

  // Core Bar chart turns the bars in a tall panel. Only a bar panel turns: a
  // category line chart stays upright.
  const horizontal = seriesType === 'bar' && isHorizontalBars(options.orientation, true, plotWidth, plotHeight);
  const plotLength = horizontal ? plotHeight : plotWidth;
  const categoryData = categoryCartesianToEChartsOption({ ...ctx, seriesType }, { horizontal, plotLength });
  const axisStyle = getCartesianAxisStyle(theme);

  // One value axis per distinct field unit; each series is pinned to its unit's axis.
  const fields = cartesianSeriesFields(ctx);
  const axes = buildCartesianYAxes({
    fields,
    baseYAxis: cartesianCategoryDefaultOptions.yAxis,
    axisStyle,
    theme,
    timeZone,
    fallbackFormatter: formatValue,
    zlevel: options.zLevel?.axis,
    horizontal,
    ...getBarFieldSets(fields, ctx),
    colorOf: (field) => getCartesianSeriesColor(field, ctx.frames, theme),
  });

  const baseSeries = categoryData.series;
  const seriesArray = Array.isArray(baseSeries) ? baseSeries : baseSeries ? [baseSeries] : [];
  const indexedSeries = seriesArray.map((cartesian, i) => ({
    ...cartesian,
    ...(horizontal
      ? { xAxisIndex: axes.seriesYAxisIndex[i] ?? 0, yAxisIndex: 0 }
      : { yAxisIndex: axes.seriesYAxisIndex[i] ?? 0 }),
  }));
  const series = attachThresholdMarks(indexedSeries, cartesianThresholdMarks(ctx, horizontal));

  // The category axis carries its labels in `data`. As core Bar chart, it draws
  // no grid lines or ticks, and "Highlight full area on hover" draws a band over
  // the hovered category. The x tick options (rotation, max length, minimum
  // spacing) apply to the labels.
  const categories = categoryData.categories ?? [];
  const categoryAxis: CartesianAxisOption = {
    data: categories,
    axisLabel: getCategoryTickLabel(options, categories.length, plotLength),
    splitLine: { show: false },
    axisTick: { show: false },
    ...(options.fullHighlight && resolvePanelStacking(options) === StackingMode.None
      ? { axisPointer: { show: true, type: 'shadow', triggerTooltip: false, label: { show: false } } }
      : {}),
  };
  const spacing = getAxisGridSpacing(axes);
  const labelSpace = getBarLabelSpace(seriesArray, horizontal);

  return {
    ...cartesianCategoryDefaultOptions,
    legend: resolveEChartsLegend(isGrafanaLegend, options.legend, theme),
    grid: getCartesianGrid(
      isGrafanaLegend ? undefined : options.legend,
      horizontal ? { bottom: spacing.left, top: spacing.right, right: labelSpace } : { ...spacing, top: labelSpace }
    ),
    ...(horizontal
      ? {
          // The first category at the top, as core horizontal bars.
          yAxis: mergeAxisStyle<YAXisOption>({ type: 'category', inverse: true }, axisStyle, categoryAxis),
          xAxis: axes.yAxis,
        }
      : {
          xAxis: mergeAxisStyle(cartesianCategoryDefaultOptions.xAxis, axisStyle, categoryAxis),
          yAxis: axes.yAxis,
        }),
    series,
  };
}

/**
 * Category tick labels: the Advanced "X tick rotation", the "X-axis tick label
 * max length" (only with rotated labels, as core) and the "X-axis labels minimum
 * spacing", which skips labels until they are that far apart.
 * https://echarts.apache.org/en/option.html#xAxis.axisLabel.interval
 */
function getCategoryTickLabel(options: PanelOptions, categoryCount: number, plotLength: number | undefined) {
  const maxLength = options.xTickLabelMaxLength;
  const truncate = maxLength != null && maxLength > 0 && (options.xTickRotate ?? 0) !== 0;
  const spacing = options.xTickLabelSpacing ?? 0;
  const bandPx = plotLength != null && categoryCount > 0 ? plotLength / categoryCount : undefined;
  return {
    // Hide a label that overlaps another. ECharts' 'auto' interval measures the labels.
    // "X tick rotation" and "X-axis labels minimum spacing" stay as set.
    ...getXTickSpacing({ plotWidth: undefined, labelWidth: undefined }).axisLabel,
    ...getXTickRotate(options.xTickRotate),
    ...(truncate
      ? { formatter: (label: string) => (label.length > maxLength ? `${label.substring(0, maxLength)}...` : label) }
      : {}),
    ...(spacing > 0 && bandPx ? { interval: Math.max(0, Math.ceil(Math.abs(spacing) / bandPx) - 1) } : {}),
  };
}

/**
 * Grid space (px) for bar value labels outside the bar ends, so the label of the
 * largest bar is not cut at the plot edge: above vertical bars, right of
 * horizontal bars.
 */
function getBarLabelSpace(
  series: Array<{ type?: string; label?: { show?: boolean; fontSize?: unknown } }>,
  horizontal = false
) {
  const label = series.find((entry) => entry.type === 'bar' && entry.label?.show)?.label;
  if (!label) {
    return 0;
  }
  const fontSize = typeof label.fontSize === 'number' ? label.fontSize : AXIS_FONT_SIZE;
  return horizontal ? fontSize * 4 : fontSize + 4;
}

/**
 * Bar fields for the value axes: every bar field (its axis includes zero, unless `barsIncludeZero` is `false`) and,
 * in percent stacking, the stacked ones (they share a 0% to 100% axis). On a
 * time axis (`stackLines`), stacked line fields share the percent axis too.
 */
function getBarFieldSets(
  fields: Field[],
  ctx: CartesianContext,
  stackLines = false
): { barFields: Set<Field>; percentFields: Set<Field> } {
  const types = fields.map((field) => resolveFieldSeriesType(field, ctx.seriesType));
  const percent = resolvePanelStacking(ctx.options) === StackingMode.Percent;
  const stacks = (field: Field, i: number) =>
    (types[i] === 'bar' || (stackLines && types[i] === 'line')) && resolveFieldStack(field, true);
  return {
    // Core Bar chart includes zero. Core Time series fits the data (`uPlot.rangeNum`), so its import sets `false`.
    barFields: new Set(ctx.options.barsIncludeZero === false ? [] : fields.filter((_, i) => types[i] === 'bar')),
    percentFields: new Set(percent ? fields.filter(stacks) : []),
  };
}

/**
 * The frames of the time path. With stacked bars or lines in several frames, the stacked
 * fields join on time first, so each stack sums the values at one timestamp.
 * Other fields keep their frames (see `joinStackedFieldsOnTime`).
 */
function cartesianTimeFrames<V, C>(ctx: {
  frames: Array<FieldTypedDataFrame<V, C>>;
  options: PanelOptions;
  seriesType: SeriesType;
}): Array<FieldTypedDataFrame<V, C>> {
  const stackAll = resolvePanelStacking(ctx.options) !== StackingMode.None;
  return joinStackedFieldsOnTime(ctx.frames, (field) =>
    isTimeSeriesStacked(field, resolveFieldSeriesType(field, ctx.seriesType), stackAll)
  );
}

/**
 * Multi-value cartesian: candlestick/boxplot on a category x-axis.
 * Each x position carries several aligned dimensions (OHLC or five-number
 * summary) instead of a single y, so the render type also selects the field
 * mapping in the converter.
 */
function buildMultiValueOption(
  ctx: ChartContext<MultiValueSeriesType>,
  isGrafanaLegend: boolean
): EChartMultiValueCartesianSeriesOption | null {
  const { theme, options, formatValue, timeRange, timeZone } = ctx;
  // Hiding every series via the legend strips the value fields the candlestick/
  // boxplot series is built from, so the converter yields no data. Keep the axes
  // and render an empty plot (matches core Grafana) instead of dropping the panel.
  const multiValueData = multiValueCartesianToEChartsOption(ctx);

  const axisStyle = getCartesianAxisStyle(theme);

  // Candlestick/boxplot share one value axis. Source explicit Min/Max from the
  // first numeric field (the same field backing the panel `formatValue`); any
  // unset side keeps ECharts' `scale: true` auto-fit.
  const representativeField = ctx.frames.flatMap((frame) => frame.fields).find(isNumberField);
  const { min, max } = representativeField ? getFieldMinMax(representativeField) : {};

  const yAxis = mergeAxisStyle(
    cartesianCategoryDefaultOptions.yAxis,
    axisStyle,
    {
      zlevel: options.zLevel?.axis,
      min,
      max,
    },
    formatValue
  );

  // Candlestick/boxplot render on a category axis whose labels are ISO
  // timestamps (kept ISO for deterministic categories). Format them for display
  // via Grafana's timezone-aware formatter; non-time categories pass through.
  const xAxis = mergeAxisStyle(cartesianCategoryDefaultOptions.xAxis, axisStyle, {
    data: multiValueData?.categories ?? [],
    axisLabel: {
      formatter: getTimeAxisLabelFormatter(timeRange, timeZone),
      ...getXTickRotate(options.xTickRotate),
      ...(ctx.seriesType === 'candlestick'
        ? getAnnotationLaneMargin(
            readAnnotationDisplay(options.annotations).multiLane,
            countAnnotationLanes(ctx.annotations)
          )
        : {}),
    },
  });

  const baseSeries = multiValueData?.series;
  const seriesArray = Array.isArray(baseSeries) ? baseSeries : baseSeries ? [baseSeries] : [];
  // The multi-value series maps to a legend item by name; drop it when hidden
  // via the legend toggle. The legend keeps the item (greyed) so it can be
  // toggled back (see `buildMultiValueCartesianLegendItems`).
  const seriesNames = seriesArray.map((chartSeries) => String(chartSeries.name ?? ''));
  const hidden = getHiddenSeriesNames(ctx.fieldConfig, seriesNames);
  const visibleSeries = seriesArray.filter((chartSeries) => !hidden.has(String(chartSeries.name ?? '')));
  const thresholdSeries = attachThresholdMarks(visibleSeries, cartesianThresholdMarks(ctx, false));
  const annotationSeries = candlestickAnnotationSeries(ctx, multiValueData?.categories);
  const series = [...thresholdSeries, ...annotationSeries];

  return {
    ...cartesianCategoryDefaultOptions,
    legend: resolveEChartsLegend(isGrafanaLegend, options.legend, theme),
    grid: getCartesianGrid(isGrafanaLegend ? undefined : options.legend),
    xAxis,
    yAxis,
    series,
  };
}

/**
 * Multi-lane markers move the time labels down by one lane for each annotation frame. As core
 * `getXAxisConfig`, only 2 or more lanes move them. 8 is the ECharts default margin.
 * https://echarts.apache.org/en/option.html#xAxis.axisLabel.margin
 */
function getAnnotationLaneMargin(multiLane: boolean, lanes: number): { margin?: number } {
  return multiLane && lanes > 1 ? { margin: 8 + lanes * ANNOTATION_LANE_SIZE } : {};
}

/**
 * The annotation series of a candlestick with a time field, as core Candlestick (it is built on
 * the Time series panel): the lines and bands, then the markers under the plot (a triangle for a
 * point, a bar for a region). Each category label is the ISO time of its row (see
 * `multiValueCartesian`). Boxplot has no core panel with annotations, so it draws none.
 */
function candlestickAnnotationSeries(ctx: ChartContext<MultiValueSeriesType>, categories: unknown[] | undefined) {
  if (ctx.seriesType !== 'candlestick' || !categories || !framesHaveTimeField(ctx.frames)) {
    return [];
  }
  const indexed = toCategoryAnnotationMarks(
    readAnnotations(ctx.annotations, ctx.theme),
    categories.map((label) => Date.parse(String(label)))
  );
  if (!indexed) {
    return [];
  }
  const zlevel = ctx.options.zLevel?.series;
  const display = readAnnotationDisplay(ctx.options.annotations);
  return [
    buildAnnotationSeries(indexed.marks, indexed.range, zlevel, display),
    buildAnnotationMarkerSeries(indexed.marks, indexed.range, { zlevel, multiLane: display.multiLane }),
  ].filter((entry) => entry != null);
}

/**
 * Numeric value fields in the same order the converters emit series, so a
 * tooltip's `seriesIndex` maps back to its source field. Multi-value
 * (candlestick/boxplot) draws a single series from several fields, so there is
 * no per-series field to return; the resolver falls back to the panel formatter.
 */
function cartesianSeriesFields(ctx: CartesianContext): Field[] {
  if (isMultiValueSeriesType(ctx.seriesType)) {
    return [];
  }
  if (framesHaveTimeField(ctx.frames)) {
    return collectTimeSeriesFields(cartesianTimeFrames(ctx));
  }
  // Same model the category converter emits series from, so index N here is the
  // field behind series N (see `CategoryCartesianModel`).
  return categoryCartesianFields(ctx.frames, ctx.theme);
}

/**
 * The frame row of each point of each time-axis series, in series order, as `timeSeriesToEChartsOption`
 * draws them. `undefined` for a series that draws each row, where the `dataIndex` is the row.
 */
function cartesianDrawnRows(ctx: CartesianContext): Array<number[] | undefined> {
  const refs: Array<{ field: Field; timeField: Field; type: SeriesType }> = [];
  forEachTimeSeriesField(cartesianTimeFrames(ctx), ({ field, timeField }) =>
    refs.push({ field, timeField, type: resolveFieldSeriesType(field, ctx.seriesType) })
  );
  const stackAll = resolvePanelStacking(ctx.options) !== StackingMode.None;
  return getDrawnSeries(refs, stackAll).map(({ rows }, i) =>
    rows.length === refs[i].field.values.length ? undefined : rows
  );
}

/**
 * A notice for each numeric "Connect null values" that the chart cannot draw. A threshold needs the
 * x distance between two values, so on a category axis the line breaks at each null.
 */
function getSpanNullsNotices(ctx: CartesianContext): ChartNotice[] {
  if (isHistogramPanel(ctx.options) || isMultiValueSeriesType(ctx.seriesType) || framesHaveTimeField(ctx.frames)) {
    return [];
  }
  const count = categoryCartesianFields(ctx.frames, ctx.theme).filter(
    (field) =>
      resolveFieldSeriesType(field, ctx.seriesType) === 'line' && isSpanNullsThreshold(resolveFieldSpanNulls(field))
  ).length;
  if (count === 0) {
    return [];
  }
  const series = count === 1 ? '1 series' : `${count} series`;
  return [
    {
      severity: 'warning',
      text: `Connect null values: a threshold needs a time axis. ${series} break at each null value.`,
    },
  ];
}

/**
 * Threshold line/region overlays for the panel, derived from the first field
 * with an active threshold display. Thresholds render once on the shared value
 * axis, so callers attach the result to a single series. Returns `undefined`
 * when no field requests thresholds.
 */
function cartesianThresholdMarks(ctx: CartesianContext, horizontal: boolean): ThresholdMarks | undefined {
  const field = findThresholdField(ctx.frames.flatMap((frame) => frame.fields));
  if (!field) {
    return undefined;
  }

  const display = thresholdDisplayForMode(getThresholdsStyleMode(field));
  const steps = resolveFieldThresholds(field, ctx.theme);
  if (!display || !steps) {
    return undefined;
  }

  return buildThresholdMarks(steps, display, horizontal);
}

/**
 * Attach threshold overlays to the first series so the horizontal lines/regions
 * paint once on the shared y-axis rather than being duplicated per series.
 */
function attachThresholdMarks<T>(series: T[], marks: ThresholdMarks | undefined): T[] {
  if (!marks || series.length === 0) {
    return series;
  }
  return [{ ...series[0], ...marks }, ...series.slice(1)];
}

export const cartesianChartModule: ChartModule = {
  legend: DEFAULT_CHART_LEGEND,
  sharedCategoryAxis: true,
  // A histogram bar has its own tooltip with the counts of its bucket (see `buildHistogramOption`).
  singleTooltipOnly: (ctx) => isHistogramPanel(ctx.options),

  getDataIssue(ctx) {
    if (isHistogramPanel(ctx.options)) {
      return getHistogramDataIssue(ctx);
    }
    return (
      getCandlestickDataIssue(ctx) ??
      getBoxplotDataIssue(ctx) ??
      getDuplicateFieldIssue(ctx.frames) ??
      getTextNumberIssue(ctx.frames) ??
      getFieldShapeIssue(ctx.frames, { number: true })
    );
  },

  getNotices(ctx: CartesianContext) {
    return getSpanNullsNotices(ctx);
  },

  getTooltipValueFormatter(ctx: CartesianContext) {
    const formatters = getFieldValueFormatters(cartesianSeriesFields(ctx), ctx.theme, ctx.timeZone);
    return indexedFormatterResolver(formatters, ctx.formatValue, 'seriesIndex');
  },

  getTooltipFieldResolver(ctx: CartesianContext) {
    const seriesType = ctx.seriesType;
    if (isMultiValueSeriesType(seriesType)) {
      // Candlestick/boxplot draw one item from several fields at once, so the
      // hovered *dimension* picks the field while `dataIndex` picks the frame
      // row the item was rendered from (time-filtered rows shift the two apart).
      const sources = resolveMultiValueSources({ ...ctx, seriesType });
      return (item) => {
        if (sources == null || item.dimensionIndex == null || item.dataIndex == null) {
          return undefined;
        }
        const field = sources.fields[item.dimensionIndex];
        const rowIndex = sources.rows[item.dataIndex];
        return field != null && rowIndex != null ? { field, rowIndex } : undefined;
      };
    }

    // Same field order as the series (see `cartesianSeriesFields`), so the
    // hovered item's `seriesIndex` selects its source field and `dataIndex` its
    // row — the tooltip footer reads that field's data links / labels.
    const fields = cartesianSeriesFields(ctx);
    // On a time axis, a numeric "Connect null values" leaves null rows out of a line series, so
    // each series maps its `dataIndex` back to the frame row (see `getDrawnRows`).
    const drawnRows = framesHaveTimeField(ctx.frames) ? cartesianDrawnRows(ctx) : undefined;
    return (item) => {
      if (item.seriesIndex == null) {
        return undefined;
      }
      const field = fields[item.seriesIndex];
      const dataIndex = item.dataIndex ?? 0;
      const rowIndex = drawnRows?.[item.seriesIndex]?.[dataIndex] ?? dataIndex;
      return field ? { field, rowIndex } : undefined;
    };
  },

  getTooltipDimensions(ctx) {
    // Labels follow each series' own ECharts data order, not the Grafana field
    // order: candlestick is emitted `[open, close, low, high]` (see
    // `multiValueCartesian`), which is not the OHLC order its field names use.
    if (ctx.seriesType === 'candlestick') {
      return ['Open', 'Close', 'Low', 'High'];
    }
    if (ctx.seriesType === 'boxplot') {
      return ['Min', 'Q1', 'Median', 'Q3', 'Max'];
    }
    return undefined;
  },

  buildOption(
    ctx: CartesianContext,
    parts
  ): EChartCartesianSeriesOption | EChartMultiValueCartesianSeriesOption | null {
    const { isGrafanaLegend } = parts;
    // @todo gate invalid frames and always throw in internal methods

    const seriesType = ctx.seriesType;

    if (isHistogramPanel(ctx.options)) {
      return buildHistogramChartOption(ctx, parts);
    }

    if (isMultiValueSeriesType(seriesType)) {
      // @todo this is a unnecessary spread to get typescript playing nicely, I guess we need narrowing methods for context as well to avoid this
      return buildMultiValueOption({ ...ctx, seriesType }, isGrafanaLegend);
    }

    if (isCartesianSingleValueSeriesType(ctx.seriesType)) {
      return framesHaveTimeField(ctx.frames)
        ? buildTimeOption({ ...ctx, seriesType }, parts)
        : buildCategoryOption({ ...ctx, seriesType }, parts);
    }

    throw new Error(`Invalid series type: ${ctx.seriesType}`);
  },

  buildLegendItems(ctx, calcs) {
    if (isHistogramPanel(ctx.options)) {
      return buildHistogramLegendItems(ctx, calcs);
    }
    const seriesType = ctx.seriesType;
    if (isMultiValueSeriesType(seriesType)) {
      return buildMultiValueCartesianLegendItems({ ...ctx, seriesType });
    }
    return framesHaveTimeField(ctx.frames)
      ? buildTimeSeriesLegendItems(cartesianTimeFrames(ctx), ctx.theme, calcs, ctx.fieldConfig, ctx.timeZone)
      : buildCategoryCartesianLegendItems(ctx.frames, ctx.theme, calcs, ctx.fieldConfig, ctx.timeZone);
  },
};
