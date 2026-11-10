import { type DataFrame, type FieldConfigSource, type GrafanaTheme2 } from '@grafana/data';
import { frameToMultivariate, type MultivariateItem } from 'lib/echarts/converters/multivariate';

/**
 * A single parallel-coordinates axis.
 *
 * `name` is the label drawn at the axis. Unlike radar, parallel carries no
 * per-axis `max`: each axis fully auto-scales from its own data range (the caller
 * sets `type: 'value'`), which is the point of parallel coordinates — comparing
 * every dimension on its own independent scale.
 *
 * See https://echarts.apache.org/en/option.html#parallelAxis
 */
export interface ParallelAxis {
  name: string;
}

/**
 * A single parallel-coordinates polyline (one line crossing every axis).
 *
 * `value` is positional: `value[i]` corresponds to `axes[i]` (dimension `i`). A
 * `null` entry leaves a gap on that axis rather than plotting a zero.
 *
 * Parallel colors the line through its data item's `lineStyle` (where radar
 * colors the polygon through `itemStyle`).
 *
 * See https://echarts.apache.org/en/option.html#series-parallel.data
 */
export interface ParallelLine {
  name: string;
  value: Array<number | null>;
  lineStyle: { color: string };
}

/**
 * The two data-dependent pieces a parallel-coordinates chart needs: the axis
 * definitions (`axes`) and the polylines drawn against them (`data`). `items`
 * holds the source row of each line, in the same order as `data`, so the tooltip
 * can map a `dataIndex` back to its row. The caller merges these into a base
 * parallel option, adding each axis's positional `dim` and value `type`.
 */
export interface ParallelData {
  axes: ParallelAxis[];
  data: ParallelLine[];
  items: MultivariateItem[];
}

/**
 * Convert Grafana data frames into the pieces required by an ECharts parallel
 * coordinates chart.
 *
 * A thin adapter over the multivariate model (see `converters/multivariate.ts`),
 * structurally identical to `radarToEChartsOption`, so the multivariate family can
 * toggle radar↔parallel over the same frames:
 * - Each number field is one axis.
 * - Each visible row is one polyline. A row hidden by the legend toggle draws no line.
 *
 * Unlike radar, no per-axis `max` is derived — each parallel axis auto-scales.
 *
 * See https://echarts.apache.org/en/option.html#series-parallel
 *
 * Returns `null` when no usable data can be derived.
 */
export function parallelToEChartsOption(
  series: DataFrame[],
  theme: GrafanaTheme2,
  fieldConfig?: FieldConfigSource
): ParallelData | null {
  const model = frameToMultivariate(series, theme, fieldConfig);

  if (!model) {
    return null;
  }

  const items = model.items.filter((item) => !item.hidden);

  const data: ParallelLine[] = items.map((item) => ({
    name: item.name,
    value: item.values,
    lineStyle: { color: item.color },
  }));

  const axes: ParallelAxis[] = model.axes.map(({ name }) => ({ name }));

  return { axes, data, items };
}
