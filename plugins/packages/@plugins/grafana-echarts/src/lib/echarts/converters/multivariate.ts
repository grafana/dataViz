import {
  type DataFrame,
  type Field,
  type FieldConfigSource,
  getFieldDisplayName,
  type GrafanaTheme2,
} from '@grafana/data';
import { findCategoricalFrame } from 'lib/echarts/converters/frames';
import { getPaletteColorByIndex } from 'lib/echarts/style';
import { getHiddenSeriesNames, getSeriesColorOverride } from 'lib/grafana/fields/seriesConfig';
import { isNumberField, isStringField } from 'lib/grafana/narrowing';

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
 * - Each row is one item, named by `rowName`.
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
  const stringFields = frame.fields.filter(isStringField);
  const names = Array.from({ length: frame.length }, (_, rowIndex) => rowName(stringFields, rowIndex));
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

/**
 * The name of a row: the non-empty values of all its string fields, joined with a space (for example
 * `prod web-01`), else the row index. The name is also the key of the legend toggle and of a `byName`
 * color override, so the first string field alone is not enough: a label column such as `cluster` often
 * has one value on every row. Core pie names its "All values" rows the same way
 * (`getSmartDisplayNameForRow`, which `@grafana/data` does not export):
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/field/fieldDisplay.ts
 */
function rowName(stringFields: Array<Field<string>>, rowIndex: number): string {
  const parts = stringFields
    .map((field) => {
      const value = field.values[rowIndex] ?? '';
      return field.display ? field.display(value).text : value;
    })
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(' ') : String(rowIndex);
}
