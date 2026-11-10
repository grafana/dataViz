import {
  type DataFrame,
  type Field,
  type FieldConfigSource,
  getFieldDisplayName,
  type GrafanaTheme2,
} from '@grafana/data';
import { findCategoricalFrame, resolveCategoriesFromFrame } from 'lib/echarts/converters/frames';
import { getPaletteColorByIndex } from 'lib/echarts/style';
import { getHiddenSeriesNames, getSeriesColorOverride } from 'lib/grafana/fields/seriesConfig';
import { isNumberField } from 'lib/grafana/narrowing';

/** One axis: a number field of the source frame. */
export interface MultivariateAxis {
  name: string;
  field: Field<number>;
}

/**
 * One item: a row of the source frame, drawn as one radar polygon or one parallel line.
 * `values[i]` is the value on `axes[i]`. A `null` value leaves a gap on that axis.
 */
export interface MultivariateItem {
  name: string;
  rowIndex: number;
  values: Array<number | null>;
  color: string;
  hidden: boolean;
}

export interface MultivariateModel {
  axes: MultivariateAxis[];
  items: MultivariateItem[];
}

/**
 * The multivariate model of the data, shared by radar and parallel coordinates.
 *
 * - Each number field is one axis.
 * - Each row is one item. The first string field gives the item name, else the row index.
 *
 * This is the wide shape: one row for each item, one number field for each metric, for example SQL with
 * `GROUP BY service`. The data plane calls it numeric long: https://grafana.com/developers/dataplane/numeric
 *
 * Only the first frame with a number field is read. The legend toggle and the color overrides name rows,
 * not fields, so the item reads them by name, as pie slices do.
 *
 * Returns `null` when no frame has a number field.
 */
export function frameToMultivariate(
  frames: DataFrame[],
  theme: GrafanaTheme2,
  fieldConfig: FieldConfigSource | undefined
): MultivariateModel | null {
  const frame = findCategoricalFrame(frames);
  if (!frame) {
    return null;
  }

  const axes: MultivariateAxis[] = frame.fields
    .filter(isNumberField)
    .map((field) => ({ name: getFieldDisplayName(field, frame, frames), field }));
  const names = resolveCategoriesFromFrame(frame);
  const hidden = fieldConfig ? getHiddenSeriesNames(fieldConfig, names) : new Set<string>();

  const items: MultivariateItem[] = names.map((name, rowIndex) => ({
    name,
    rowIndex,
    values: axes.map(({ field }) => field.values[rowIndex] ?? null),
    color:
      (fieldConfig ? getSeriesColorOverride(fieldConfig, name, theme) : undefined) ??
      getPaletteColorByIndex(rowIndex, theme),
    hidden: hidden.has(name),
  }));

  return { axes, items };
}
