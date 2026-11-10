import { type DataFrame, type FieldConfigSource, type GrafanaTheme2 } from '@grafana/data';
import { frameToMultivariate, type MultivariateItem } from 'lib/echarts/converters/multivariate';

/**
 * A single radar axis.
 *
 * `name` is the label drawn at the tip of the axis, and `max` (optional) fixes
 * the outer bound of that axis. When `max` is omitted, ECharts auto-scales the
 * axis from the data, which is why we only set it when we actually have data.
 *
 * See https://echarts.apache.org/en/option.html#radar.indicator
 */
export interface RadarIndicator {
  name: string;
  max?: number;
}

/**
 * A single radar polygon (one closed shape on the chart).
 *
 * `value` is positional: `value[i]` corresponds to `indicator[i]`. A `null`
 * entry leaves a gap on that axis rather than plotting a zero.
 *
 * See https://echarts.apache.org/en/option.html#series-radar.data
 */
export interface RadarPolygon {
  name: string;
  value: Array<number | null>;
  itemStyle: { color: string };
}

/**
 * The two data-dependent pieces a radar chart needs: the shared axis definition
 * (`indicator`) and the polygons drawn against it (`data`). `items` holds the
 * source row of each polygon, in the same order as `data`, so the tooltip can map
 * a `dataIndex` back to its row. The caller merges these into a base radar option.
 */
export interface RadarData {
  indicator: RadarIndicator[];
  data: RadarPolygon[];
  items: MultivariateItem[];
}

/**
 * Convert Grafana data frames into the pieces required by an ECharts radar chart.
 *
 * A thin adapter over the multivariate model (see `converters/multivariate.ts`):
 * - Each number field is one axis (indicator).
 * - Each visible row is one polygon. A row hidden by the legend toggle draws no polygon.
 * - The `max` of each indicator is the largest value of the visible polygons on that axis,
 *   so the outer ring fits the data. It is not set when the axis has no value (ECharts then auto-scales).
 *
 * See https://echarts.apache.org/en/option.html#radar
 *
 * Returns `null` when no usable data can be derived.
 */
export function radarToEChartsOption(
  series: DataFrame[],
  theme: GrafanaTheme2,
  fieldConfig?: FieldConfigSource
): RadarData | null {
  const model = frameToMultivariate(series, theme, fieldConfig);

  if (!model) {
    return null;
  }

  const items = model.items.filter((item) => !item.hidden);

  const data: RadarPolygon[] = items.map((item) => ({
    name: item.name,
    value: item.values,
    itemStyle: { color: item.color },
  }));

  const indicator: RadarIndicator[] = model.axes.map(({ name }, axis) => {
    let max: number | undefined = undefined;
    for (const item of items) {
      const value = item.values[axis];
      if (value !== null && (max === undefined || value > max)) {
        max = value;
      }
    }

    return max === undefined ? { name } : { name, max };
  });

  return { indicator, data, items };
}
