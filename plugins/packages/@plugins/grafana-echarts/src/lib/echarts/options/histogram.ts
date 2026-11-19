import {
  type DisplayProcessor,
  type Field,
  type FieldConfigSource,
  formattedValueToString,
  getDisplayProcessor,
  type GrafanaTheme2,
} from '@grafana/data';
import { GraphGradientMode, StackingMode, TooltipDisplayMode } from '@grafana/schema';
import { type CustomSeriesOption, type CustomSeriesRenderItem, type LinearGradientObject } from 'echarts';
import { type TopLevelFormatterParams } from 'echarts/types/dist/shared';
import { type XAXisOption, type YAXisOption } from 'echarts/types/src/coord/cartesian/AxisModel';
import { type HistogramModel, isOrdinalHistogram } from 'lib/echarts/converters/histogram';
import { getCartesianGrid } from 'lib/echarts/grid/grid';
import { clipRectByRect } from 'lib/echarts/options/binnedHeatmap';
import { getBarFillColor } from 'lib/echarts/options/bars';
import { type GradientStop, getHueGradientStops, getOpacityGradientStops } from 'lib/grafana/fields/gradientColors';
import {
  getHistogramFieldStyles,
  getHistogramStackingGroups,
  type HistogramFieldStyle,
  type HistogramStackingGroup,
} from 'lib/grafana/fields/histogramStyle';
import { getXTickSpacing } from 'lib/echarts/axes/xTickSpacing';
import { cartesianCategoryDefaultOptions, getCartesianAxisStyle, mergeAxisStyle } from 'lib/echarts/options/cartesian';
import { resolveEChartsLegend } from 'lib/echarts/options/legend';
import { isRect } from 'lib/echarts/options/narrowing';
import { type EChartCartesianSeriesOption } from 'lib/echarts/charts/types';
import { getSeriesColor } from 'lib/echarts/style';
import { seriesTooltip } from 'lib/echarts/tooltip/option';
import { type TooltipModel, type TooltipRow, type TooltipSink } from 'lib/echarts/tooltip/types';
import { getHiddenSeriesNames } from 'lib/grafana/fields/seriesConfig';
import { type PanelOptions } from 'types';

// The core Histogram panel draws each bucket as a bar from its lower to its upper bound, on a linear x axis.
// Buckets with names (heatmap-rows `le` buckets) go on an ordinal x axis: bucket `i` is from position `i` to
// `i + 1`, and the tick at position `i` has the name of the lower bound of bucket `i`.
// Core source: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/Histogram.tsx
// The bars are a `custom` series, because an ECharts `bar` series has one width for all bars.
// https://echarts.apache.org/en/option.html#series-custom

/** Dimensions of one bar: `[xMin, xMax, base, top, count]`. */
const X_MIN = 0;
const X_MAX = 1;
const BASE = 2;
const TOP = 3;
const COUNT = 4;

/** Smallest space between two x tick labels, in px, as the uPlot default of a horizontal axis. */
const X_TICK_MIN_SPACE = 60;

/** The most x ticks. With no plot width, a small bucket size on a wide x range can give millions of ticks. */
const MAX_X_TICKS = 50;

/** Space on the right of the plot, in px, for the right half of the last x label. */
const X_LABEL_OVERHANG = 16;

export interface HistogramOptionInput {
  model: HistogramModel;
  theme: GrafanaTheme2;
  options: PanelOptions;
  fieldConfig: FieldConfigSource;
  isGrafanaLegend: boolean;
  plotWidth?: number;
  tooltipSink?: TooltipSink;
}

/** The color of each count field: the classic palette counts only the count fields, as core `prepConfig`. */
export function getHistogramColors(model: HistogramModel, theme: GrafanaTheme2): string[] {
  return model.counts.map((field, seriesIndex) =>
    getSeriesColor({ ...field, state: { ...field.state, seriesIndex } }, theme)
  );
}

/** The ECharts option of a histogram: one custom series of bars for each count field. */
export function buildHistogramOption(input: HistogramOptionInput): EChartCartesianSeriesOption {
  const { model, theme, options, isGrafanaLegend } = input;
  const hidden = getHiddenSeriesNames(input.fieldConfig, model.names);
  const colors = getHistogramColors(model, theme);
  const styles = getHistogramFieldStyles(model.counts, options);
  const groups = getHistogramStackingGroups(model.counts, styles, (i) => hidden.has(model.names[i]));
  const percent = isPercentOnly(model, styles, hidden);
  const bounds = getBucketBounds(model);
  const range = getXAxisRange(model, bounds);
  const rows = getBarRows(model, bounds, groups, range);
  const axisStyle = getCartesianAxisStyle(theme);
  const countDisplay = getDisplay(model.counts[0], theme);
  const hoverOrder = getHoverOrder(model, rows, hidden);

  const series: CustomSeriesOption[] = model.counts.flatMap((field, i) =>
    hidden.has(model.names[i])
      ? []
      : [
          {
            name: model.names[i],
            type: 'custom',
            coordinateSystem: 'cartesian2d',
            zlevel: options.zLevel?.series,
            renderItem: makeHistogramRenderItem(colors[i], styles[i], theme, hoverOrder[i]),
            // The x extent spans both bounds, and the y extent spans the base and the top of each bar.
            // https://echarts.apache.org/en/option.html#series-custom.encode
            encode: { x: [X_MIN, X_MAX], y: [BASE, TOP], tooltip: [COUNT] },
            data: rows[i],
            itemStyle: { color: colors[i] },
            tooltip: seriesTooltip(buildHistogramTooltip(input, colors, hidden, i), input.tooltipSink),
          },
        ]
  );

  return {
    ...cartesianCategoryDefaultOptions,
    legend: resolveEChartsLegend(isGrafanaLegend, options.legend, theme),
    // The last x label is on the right edge of the plot. `containLabel` does not keep space for its right half.
    grid: getCartesianGrid(isGrafanaLegend ? undefined : options.legend, { right: X_LABEL_OVERHANG }),
    xAxis: mergeAxisStyle<XAXisOption>(
      { type: 'value', ...range, ...getXTickInterval(model, bounds, input.plotWidth) },
      axisStyle,
      {
        zlevel: options.zLevel?.axis,
        // Hide a label that overlaps another, as core drops labels by their measured width (`values`).
        // https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/Histogram.tsx
        axisLabel: {
          ...getXTickSpacing({ plotWidth: undefined, labelWidth: undefined }).axisLabel,
          formatter: getXLabelFormatter(model, bounds, theme),
        },
      }
    ),
    yAxis: mergeAxisStyle<YAXisOption>(
      // A count is a whole number, so the count axis has no ticks between two whole numbers.
      // https://echarts.apache.org/en/option.html#yAxis.minInterval
      { type: 'value', min: 0, ...(percent ? { max: 1 } : { minInterval: 1 }) },
      axisStyle,
      { zlevel: options.zLevel?.axis },
      (value) =>
        (percent ? getDisplayProcessor({ field: { config: { unit: 'percentunit' } }, theme }) : countDisplay)(value)
    ),
    series,
  };
}

/**
 * True when each shown field stacks with 100%. Then the count axis is 0 to 100%. Else it shows the counts.
 */
function isPercentOnly(model: HistogramModel, styles: HistogramFieldStyle[], hidden: Set<string>): boolean {
  const shown = styles.filter((_, i) => !hidden.has(model.names[i]));
  return shown.length > 0 && shown.every((style) => style.stacking === StackingMode.Percent);
}

/**
 * The bar rows of each count field, as core `preparePlotData2` with the stacking groups. A stacked bar starts on
 * the top of the bars of the same bucket before it in its group. 100% stacking divides by the total of the
 * bucket in the group. A field in no group starts at 0. A bucket out of the x range gets a row with no bar, so
 * its count does not change the count axis, as the uPlot scale of core.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/utils.ts
 */
function getBarRows(
  model: HistogramModel,
  bounds: BucketBounds,
  groups: HistogramStackingGroup[],
  range: { min?: number; max?: number }
): number[][][] {
  const buckets = model.xMin.values.length;
  const countOf = (i: number, j: number) => Number(model.counts[i].values[j]) || 0;
  const groupOf = (i: number) => groups.find((group) => group.fields.includes(i));
  const totals = groups.map((group) =>
    Array.from({ length: buckets }, (_, j) => group.fields.reduce((sum, i) => sum + countOf(i, j), 0))
  );
  const bases = groups.map(() => new Array<number>(buckets).fill(0));
  return model.counts.map((_, i) => {
    const group = groupOf(i);
    const g = group ? groups.indexOf(group) : -1;
    return Array.from({ length: buckets }, (_, j) => {
      const count = countOf(i, j);
      const height = group?.mode === StackingMode.Percent ? (totals[g][j] > 0 ? count / totals[g][j] : 0) : count;
      const base = group ? bases[g][j] : 0;
      if (group) {
        bases[g][j] += height;
      }
      const [xMin, xMax] = [bounds.mins[j], bounds.maxs[j]];
      if (xMax <= (range.min ?? -Infinity) || xMin >= (range.max ?? Infinity)) {
        return [xMin, xMax, 0, 0, 0];
      }
      return [xMin, xMax, base, base + height, count];
    });
  });
}

/**
 * The hover order of each bar, as core: the cursor focus of uPlot selects the bar with the lowest top at or above
 * the cursor (`focus: { prox: 1e6, bias: 1 }` in core `prepConfig`). On a tie, the first series wins. Thus the
 * bar with the lowest top gets the highest order, and the first series gets the higher order on a tie. The bars of one
 * stacking group do not overlap. The bars of two groups overlap as the bars of two unstacked series.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/Histogram.tsx
 */
function getHoverOrder(model: HistogramModel, rows: number[][][], hidden: Set<string>): number[][] {
  const shown = model.counts.map((_, i) => i).filter((i) => !hidden.has(model.names[i]));
  const order = model.counts.map(() => new Array<number>(model.xMin.values.length).fill(0));
  for (let j = 0; j < model.xMin.values.length; j++) {
    const sorted = [...shown].sort((a, b) => rows[b][j][TOP] - rows[a][j][TOP] || b - a);
    sorted.forEach((i, rank) => (order[i][j] = rank + 1));
  }
  return order;
}

/**
 * Draw one bar from `xMin` to `xMax` and from its base to its top, clipped to the grid. As core, a bucket with
 * a count of 0 draws no bar. The fill and the border come from the field style (`getHistogramFill`).
 * An invisible copy of the bar on top of all bars is the hover area. Its `z2` is the hover order of the bar, so
 * the tooltip shows the bar that core shows. ZRender does not draw an invisible element, but it hit-tests it.
 * https://echarts.apache.org/en/option.html#series-custom.renderItem
 * https://echarts.apache.org/en/option.html#series-custom.renderItem.return_rect.invisible
 */
function makeHistogramRenderItem(
  color: string,
  style: HistogramFieldStyle,
  theme: GrafanaTheme2,
  hoverOrder: number[]
): CustomSeriesRenderItem {
  const { lineWidth } = style;
  return (params, api) => {
    if (!Number(api.value(COUNT)) || !isRect(params.coordSys)) {
      return;
    }
    const start = api.coord([api.value(X_MIN), api.value(TOP)]);
    const end = api.coord([api.value(X_MAX), api.value(BASE)]);
    const shape = clipRectByRect(
      {
        x: Math.min(start[0], end[0]),
        y: Math.min(start[1], end[1]),
        width: Math.abs(end[0] - start[0]),
        height: Math.abs(end[1] - start[1]),
      },
      params.coordSys
    );
    if (!shape) {
      return;
    }
    return {
      type: 'group',
      children: [
        { type: 'rect', shape, style: { ...getHistogramFill(color, style, theme, params.coordSys), lineWidth } },
        { type: 'rect', shape, style: { fill: color }, invisible: true, z2: hoverOrder[params.dataIndex] },
      ],
    };
  };
}

/**
 * The fill and the border of the bars of a field, as core `UPlotSeriesBuilder` (`getFill`, `getLineColor`):
 * - None (and Scheme, not supported yet): the color at the fill opacity, and a solid border.
 * - Opacity: a gradient from the color at the fill opacity to transparent, and a solid border.
 * - Hue: a gradient of hues at the fill opacity. The border is the same gradient, solid.
 * Core draws one gradient over the plot, from its top to its bottom, so each bar shows a part of it.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/config/UPlotSeriesBuilder.ts
 */
export function getHistogramFill(
  color: string,
  { fillOpacity, gradientMode }: HistogramFieldStyle,
  theme: GrafanaTheme2,
  plot: { y: number; height: number }
): { fill: string | LinearGradientObject; stroke: string | LinearGradientObject } {
  const opacity = Math.min(Math.max(fillOpacity, 0), 100) / 100;
  switch (gradientMode) {
    case GraphGradientMode.Opacity:
      return { fill: plotGradient(getOpacityGradientStops(color, opacity), plot), stroke: color };
    case GraphGradientMode.Hue:
      return {
        fill: plotGradient(getHueGradientStops(color, opacity, theme.isDark), plot),
        stroke: plotGradient(getHueGradientStops(color, 1, theme.isDark), plot),
      };
    default:
      return { fill: getBarFillColor(color, fillOpacity), stroke: color };
  }
}

/**
 * A vertical gradient from the top to the bottom of the plot, in px of the canvas (`global: true`).
 * https://echarts.apache.org/en/option.html#color
 */
function plotGradient(colorStops: GradientStop[], plot: { y: number; height: number }): LinearGradientObject {
  return { type: 'linear', x: 0, y: plot.y, x2: 0, y2: plot.y + plot.height, colorStops, global: true };
}

/** The x positions of the buckets. On an ordinal axis, the positions are the bucket indexes. */
interface BucketBounds {
  mins: number[];
  maxs: number[];
  ordinal: boolean;
}

/**
 * The x position of each bucket. On an ordinal axis, bucket `i` is from `i` to `i + 1`, as the core bars with
 * `align: 1` and `size: [1, Infinity]`.
 */
function getBucketBounds(model: HistogramModel): BucketBounds {
  if (isOrdinalHistogram(model)) {
    const mins = model.xMin.values.map((_: unknown, i: number) => i);
    return { mins, maxs: mins.map((i: number) => i + 1), ordinal: true };
  }
  return { mins: toNumbers(model.xMin), maxs: toNumbers(model.xMax), ordinal: false };
}

/**
 * The x range. With no field min and max, it spans the lower bound of the first bucket to the upper bound of the
 * last bucket, as core. The field min and max of the first count field set the range for buckets of one size, as
 * core `prepConfig`: the min rounds up and the max rounds down to a multiple of the bucket size. A max that is the
 * lower bound of the last bucket gives the upper bound of that bucket.
 * On an ordinal axis, core ends the axis at the last position (`incrRoundDn(wantedMax, 1)`), and it does not read
 * the field min and max. The last bucket of heatmap-rows is an empty bucket for `+Inf`, so the axis ends at its
 * lower bound.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/Histogram.tsx
 */
function getXAxisRange(model: HistogramModel, bounds: BucketBounds): { min?: number; max?: number } {
  if (bounds.ordinal) {
    return bounds.mins.length ? { min: 0, max: Math.max(1, bounds.mins.length - 1) } : {};
  }
  const values = [...bounds.mins, ...bounds.maxs].filter(Number.isFinite);
  if (!values.length) {
    return {};
  }
  // A loop, not `Math.min(...values)`: a spread of many buckets can exceed the call stack.
  const min = values.reduce((a, b) => Math.min(a, b));
  const max = values.reduce((a, b) => Math.max(a, b));
  const size = getUniformBucketSize(bounds);
  const { min: fieldMin, max: fieldMax } = model.counts[0]?.config ?? {};
  if (size == null) {
    return { min, max };
  }
  // Core adds one bucket when the max is the lower bound of the last bucket, so that bucket is drawn.
  const lastMin = bounds.mins[bounds.mins.length - 1];
  const toMax = (value: number) => (value === lastMin ? max : round(Math.floor(value / size) * size));
  return {
    min: Number.isFinite(fieldMin) ? round(Math.ceil(fieldMin! / size) * size) : min,
    max: Number.isFinite(fieldMax) ? toMax(fieldMax!) : max,
  };
}

/** The size of the buckets of a number axis when all buckets have one size that is more than 0. */
function getUniformBucketSize(bounds: BucketBounds): number | undefined {
  if (bounds.ordinal) {
    return undefined;
  }
  const sizes = new Set(bounds.mins.map((min, i) => round(bounds.maxs[i] - min)));
  const [size] = [...sizes];
  return sizes.size === 1 && size > 0 ? size : undefined;
}

/**
 * The x tick labels. A number bound uses the display of the field. On an ordinal axis, the tick at position `i`
 * is the name of the lower bound of bucket `i`, with no format, as core (`values: (u, splits) => splits`).
 */
function getXLabelFormatter(model: HistogramModel, bounds: BucketBounds, theme: GrafanaTheme2) {
  if (bounds.ordinal) {
    return (value: number) => String(model.xMin.values[value] ?? '');
  }
  const display = getDisplay(model.xMin, theme);
  return (value: number) => formattedValueToString(display(value));
}

/**
 * Put the x ticks on the bucket bounds, as core `xSplits`: one tick every `skip` buckets, so the labels are
 * at least `X_TICK_MIN_SPACE` px apart, and there are no more than `MAX_X_TICKS` ticks. Only buckets of one size
 * get this. Else ECharts selects the ticks.
 * https://echarts.apache.org/en/option.html#xAxis.interval
 */
function getXTickInterval(
  model: HistogramModel,
  bounds: BucketBounds,
  plotWidth: number | undefined
): { interval?: number } {
  // Core has a tick for each position of an ordinal axis (`incrs: [1]`).
  if (bounds.ordinal) {
    return { interval: 1 };
  }
  const size = getUniformBucketSize(bounds);
  const { min, max } = getXAxisRange(model, bounds);
  if (size == null || min == null || max == null || max <= min) {
    return {};
  }
  const bucketPx = plotWidth ? (plotWidth * size) / (max - min) : X_TICK_MIN_SPACE;
  const skip = Math.max(1, Math.ceil(X_TICK_MIN_SPACE / bucketPx), Math.ceil((max - min) / size / MAX_X_TICKS));
  return { interval: size * skip };
}

/** The values of a field as numbers. */
function toNumbers(field: Field): number[] {
  return field.values.map((value: unknown) => Number(value));
}

/** Round away the float error of a subtraction, as core `roundDecimals(…, 9)`. */
function round(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

/** The display processor of a field. Frames from a data source can have no `display` yet. */
function getDisplay(field: Field | undefined, theme: GrafanaTheme2): DisplayProcessor {
  return field?.display ?? getDisplayProcessor({ field: field ?? {}, theme });
}

/**
 * The tooltip of a bar, as core `HistogramTooltip`: the header is the bucket range, and the rows are the counts.
 * "All" lists the count of each shown series in the bucket. "Single" lists the hovered series.
 * Core changes a count of 0 to null before it draws (`preparePlotData` in `Histogram.tsx`). Thus the tooltip
 * shows the "No value" text of the field for a count of 0, and not a value mapping of 0. A field with no
 * "No value" text gets no row, as core `getFieldDisplayItems`.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/HistogramTooltip.tsx
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/VizTooltip/utils.ts
 */
function buildHistogramTooltip(
  { model, theme, options }: HistogramOptionInput,
  colors: string[],
  hidden: Set<string>,
  seriesField: number
): (params: TopLevelFormatterParams) => TooltipModel {
  const formatMin = getDisplay(model.xMin.config.unit != null ? model.xMin : model.xMax, theme);
  const formatMax = getDisplay(model.xMax.config.unit != null ? model.xMax : model.xMin, theme);
  const multi = options.tooltip?.mode === TooltipDisplayMode.Multi;
  return (params) => {
    const item = Array.isArray(params) ? params[0] : params;
    const rowIndex = item?.dataIndex ?? 0;
    const value = (field: Field): unknown => field.values[rowIndex];
    const count = (i: number): unknown => (value(model.counts[i]) === 0 ? null : value(model.counts[i]));
    const row = (i: number): TooltipRow => {
      const field = model.counts[i];
      const raw = count(i);
      return {
        color: colors[i],
        label: model.names[i],
        value: formattedValueToString(getDisplay(field, theme)(raw)),
        emphasis: multi && i === seriesField,
        rawValue: typeof raw === 'number' ? raw : null,
        source: { field, rowIndex },
      };
    };
    const xMin = value(model.xMin);
    const indexes = (multi ? model.counts.map((_, i) => i) : [seriesField]).filter(
      (i) => !hidden.has(model.names[i]) && (count(i) != null || model.counts[i].config.noValue != null)
    );
    return {
      header: {
        label: 'Bucket',
        value: `${formattedValueToString(formatMin(xMin))} - ${formattedValueToString(formatMax(value(model.xMax)))}`,
        // The x of a bucket is its lower bound.
        ...(typeof xMin === 'number' &&
          Number.isFinite(xMin) && { coordinate: { type: 'number' as const, value: xMin } }),
      },
      rows: indexes.map(row),
      source: multi ? undefined : { field: model.counts[seriesField], rowIndex },
    };
  };
}
