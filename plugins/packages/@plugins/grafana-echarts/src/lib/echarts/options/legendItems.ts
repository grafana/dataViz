import {
  type DataFrame,
  type DisplayValue,
  type Field,
  type FieldConfigSource,
  fieldReducers,
  getDisplayProcessor,
  getFieldDisplayName,
  type GrafanaTheme2,
  type InterpolateFunction,
  type ReduceDataOptions,
  reduceField,
} from '@grafana/data';
import { type SortOrder } from '@grafana/schema';
import { type VizLegendItem } from '@grafana/ui';
import type { MultiValueSeriesType, PieLegendValue } from 'editor/types';
import { type ChartContext } from 'lib/echarts/charts/types';
import { framesToCategoryCartesian } from 'lib/echarts/converters/categoryCartesianModel';
import { forEachTimeSeriesField } from 'lib/echarts/converters/frames';
import { multiValueCartesianToEChartsOption } from 'lib/echarts/converters/multiValueCartesian';
import { frameToMultivariate } from 'lib/echarts/converters/multivariate';
import { formatPieShare, getPieSliceTotal, resolvePieSlices } from 'lib/echarts/converters/pie';
import { type PieSliceModel } from 'lib/echarts/converters/types';
import { getFieldAxisSides } from 'lib/echarts/axes/yAxes';
import { getFieldConfigFromField } from 'lib/grafana/fields/fieldConfig';
import { getHiddenSeriesNames } from 'lib/grafana/fields/seriesConfig';
import { getCartesianSeriesColor } from 'lib/echarts/style';

/**
 * Reduce a field down to per-series calc columns for the table legend.
 */
export function getCalcDisplayValues(calcs: string[], field: Field, theme: GrafanaTheme2, timeZone?: string) {
  if (calcs.length === 0) {
    return [];
  }

  const display = field.display ?? getDisplayProcessor({ field, theme, timeZone });
  const fieldCalcs = reduceField({ field, reducers: calcs });

  return calcs.map((calc) => ({
    ...display(fieldCalcs[calc]),
    title: fieldReducers.getIfExists(calc)?.name ?? calc,
  }));
}

export function buildTimeSeriesLegendItems(
  series: DataFrame[],
  theme: GrafanaTheme2,
  calcs: string[],
  fieldConfig: FieldConfigSource,
  timeZone?: string
): VizLegendItem[] {
  const refs: Array<{ frame: DataFrame; frameIndex: number; field: Field; fieldIndex: number; label: string }> = [];
  forEachTimeSeriesField(series, ({ frame, frameIndex, field, fieldIndex }) => {
    refs.push({ frame, frameIndex, field, fieldIndex, label: getFieldDisplayName(field, frame, series) });
  });

  // Hidden state comes from `fieldConfig` so legend greys with the chart on toggle. See `getHiddenSeriesNames`.
  const hidden = getHiddenSeriesNames(
    fieldConfig,
    refs.map((ref) => ref.label)
  );

  // Item on the right axis: y axis 2, as core.
  const sides = getFieldAxisSides(refs.map((ref) => ref.field));
  const rightAxis = new Set(refs.filter((_, i) => sides[i] === 'right').map((ref) => ref.field));

  // `hideFrom.legend` drops the item; the series still draws (core parity).
  return refs
    .filter(({ field }) => !isHiddenFromLegend(field))
    .map(({ field, frameIndex, fieldIndex, label }) => ({
      label,
      fieldName: label,
      color: getCartesianSeriesColor(field, series, theme),
      yAxis: rightAxis.has(field) ? 2 : 1,
      // Kept in the legend when hidden from the viz so it can be toggled back.
      disabled: hidden.has(label),
      getItemKey: () => `${frameIndex}-${fieldIndex}`,
      getDisplayValues: () => getCalcDisplayValues(calcs, field, theme, timeZone),
    }));
}

/**
 * Legend items for a category-axis cartesian chart, mirroring the series the
 * category converter emits (item-key prefix `series-`).
 *
 * Built from `framesToCategoryCartesian` rather than by re-filtering the first
 * frame's fields, so the legend covers every frame's series and stays in the same
 * order as the chart (see `CategoryCartesianModel`). The item key is the series
 * index for that reason — a field index would collide across frames.
 */
export function buildCategoryCartesianLegendItems(
  series: DataFrame[],
  theme: GrafanaTheme2,
  calcs: string[],
  fieldConfig: FieldConfigSource,
  timeZone?: string
): VizLegendItem[] {
  const model = framesToCategoryCartesian(series, theme);
  if (!model) {
    return [];
  }

  // Hidden state from `fieldConfig` keeps the legend in lockstep with the chart.
  const hidden = getHiddenSeriesNames(
    fieldConfig,
    model.series.map(({ name }) => name)
  );

  // `hideFrom.legend` drops the item; the key stays the series index of the chart.
  return model.series.flatMap(({ field, name, color }, index) =>
    isHiddenFromLegend(field)
      ? []
      : [
          {
            label: name,
            fieldName: name,
            color,
            yAxis: 1,
            // Kept in the legend when hidden from the viz so it can be toggled back.
            disabled: hidden.has(name),
            getItemKey: () => `series-${index}`,
            getDisplayValues: () => getCalcDisplayValues(calcs, field, theme, timeZone),
          },
        ]
  );
}

/** Core `custom.hideFrom.legend`: the series draws, but has no legend item. */
function isHiddenFromLegend(field: Field): boolean {
  return getFieldConfigFromField(field).custom?.hideFrom?.legend === true;
}

/**
 * Legend items for a multi-value cartesian chart (candlestick/boxplot). The
 * converter emits a single series per source frame, so this yields one legend
 * entry mirroring it. Table calc columns are omitted: each item is a
 * multi-dimensional array (OHLC / five-number summary), so a single reduced
 * value would be misleading.
 */
export function buildMultiValueCartesianLegendItems(ctx: ChartContext<MultiValueSeriesType>): VizLegendItem[] {
  const data = multiValueCartesianToEChartsOption(ctx);
  if (!data) {
    return [];
  }

  // The series maps to a legend item by name; keep it (greyed) when hidden so it
  // can be toggled back. The converter already applied any color override, so
  // the swatch reflects it.
  const series = Array.isArray(data.series) ? data.series : data.series ? [data.series] : [];
  const seriesNames = series.map((chartSeries) => chartSeries.name?.toString() ?? '');
  const hidden = getHiddenSeriesNames(ctx.fieldConfig, seriesNames);
  return series.map((chartSeries, index) => {
    const label = chartSeries.name?.toString() ?? '';
    return {
      label,
      fieldName: label,
      color: chartSeries.itemStyle?.color?.toString(),
      yAxis: 1,
      disabled: hidden.has(label),
      getItemKey: () => `multiValue-${index}`,
      getDisplayValues: () => [],
    };
  });
}

/**
 * Legend items for the multivariate family (radar, parallel): one entry for each
 * row (polygon or line) of the multivariate model (item-key prefix `polygon-`).
 * A hidden row stays in the legend, greyed, so it can be toggled back. There are
 * no calc values: a calc over the axes of one row mixes their units.
 */
export function buildRadarLegendItems(
  series: DataFrame[],
  theme: GrafanaTheme2,
  fieldConfig: FieldConfigSource
): VizLegendItem[] {
  const model = frameToMultivariate(series, theme, fieldConfig);
  return (model?.items ?? []).map(({ name, rowIndex, color, hidden }) => ({
    label: name,
    fieldName: name,
    color,
    yAxis: 1,
    disabled: hidden,
    getItemKey: () => `polygon-${rowIndex}`,
    getDisplayValues: () => [],
  }));
}

/**
 * The pie legend's value columns for one slice (Grafana Pie chart "Legend values"
 * parity): a Value and/or Percent `DisplayValue`, in that order, matching the
 * selected `values`. The value formats with the slice field's unit/decimals (like
 * the slice labels and tooltip); the percent is the slice's share of the visible
 * total, through the same `formatPieShare` those surfaces use, so all three agree.
 * A hidden slice contributes `0` to the total and shows `-` for its percent. Each
 * column is always titled ("Value" / "Percent") — the table legend renders a `?`
 * header for a title-less column, so titling both is simpler than conditionally
 * dropping them; the list legend ignores the titles.
 */
function getPieLegendDisplayValues(
  slice: PieSliceModel,
  total: number,
  values: PieLegendValue[],
  theme: GrafanaTheme2,
  timeZone?: string
): DisplayValue[] {
  const out: DisplayValue[] = [];

  if (values.includes('value')) {
    const display = slice.field.display ?? getDisplayProcessor({ field: slice.field, theme, timeZone });
    out.push({ ...display(slice.value ?? null), title: 'Value' });
  }

  if (values.includes('percent')) {
    const percent = slice.hidden || total <= 0 ? 0 : ((slice.value ?? 0) / total) * 100;
    out.push({
      numeric: percent,
      text: slice.hidden ? '-' : formatPieShare(slice.value, total, slice.field.config.decimals),
      title: 'Percent',
    });
  }

  return out;
}

/**
 * Legend items for the pie, from the shared slice resolver so the legend matches
 * the rendered slices (same names, colors, hidden state, and `sort` order). Every
 * slice is kept — a hidden one is marked `disabled` (greyed) so it can be toggled
 * back. Each item's value columns show the selected `values` (Percent / Value); an
 * empty selection shows slice names only. Percentages are of the *visible* total
 * (hidden slices excluded), matching the chart and tooltip.
 */
export function buildPieLegendItems(
  series: DataFrame[],
  theme: GrafanaTheme2,
  values: PieLegendValue[],
  fieldConfig: FieldConfigSource,
  reduceOptions: ReduceDataOptions | undefined,
  replaceVariables: InterpolateFunction,
  timeZone?: string,
  sort?: SortOrder
): VizLegendItem[] {
  const slices = resolvePieSlices(series, theme, fieldConfig, reduceOptions, replaceVariables, timeZone, sort);
  const total = getPieSliceTotal(slices.filter((slice) => !slice.hidden));

  return slices.map((slice, index) => ({
    label: slice.name,
    fieldName: slice.name,
    color: slice.color,
    yAxis: 1,
    disabled: slice.hidden,
    getItemKey: () => `slice-${index}`,
    getDisplayValues: () => getPieLegendDisplayValues(slice, total, values, theme, timeZone),
  }));
}
