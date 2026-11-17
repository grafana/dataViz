// The values of a single-value panel (gauge, stat): one `FieldDisplay` for each reduced field or for each row.
// This file has no ECharts code.
// https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/field/fieldDisplay.ts
import {
  type DataFrame,
  type Field,
  type FieldConfigSource,
  type FieldDisplay,
  getDisplayProcessor,
  getFieldDisplayValues,
  type GrafanaTheme2,
  type InterpolateFunction,
  type ReduceDataOptions,
} from '@grafana/data';

export interface FieldDisplayInput {
  frames: DataFrame[];
  fieldConfig: FieldConfigSource;
  /** The `reduceOptions` of the panel. Unset gives one value for each number field, reduced with `defaultCalc`. */
  reduceOptions: ReduceDataOptions | undefined;
  /** The reducer when `reduceOptions.calcs` is unset or empty. */
  defaultCalc: string;
  replaceVariables: InterpolateFunction;
  theme: GrafanaTheme2;
  timeZone?: string;
}

/**
 * The values that the panel shows, in the order of the frames and the fields. Grafana does the reduction, the
 * display name, the color, the unit and the value mappings. The result is empty when no field matches: Grafana
 * gives a "No data" placeholder with no column index for that case, and this function removes it.
 */
export function resolveFieldDisplays(input: FieldDisplayInput): FieldDisplay[] {
  const { frames, fieldConfig, reduceOptions, defaultCalc, replaceVariables, theme, timeZone } = input;
  const calcs = reduceOptions?.calcs?.length ? reduceOptions.calcs : [defaultCalc];

  return getFieldDisplayValues({
    data: frames,
    fieldConfig,
    reduceOptions: { ...reduceOptions, calcs },
    replaceVariables,
    theme,
    timeZone,
  }).filter((display) => display.colIndex !== undefined);
}

const PERCENT_UNIT_MAX: Record<string, number> = { percent: 100, percentunit: 1 };

/** A field with the unit `percent` or `percentunit` gets the range of its unit, unless `min` or `max` is set. */
function withPercentUnitRange(field: Field, theme: GrafanaTheme2): Field {
  const unitMax = PERCENT_UNIT_MAX[field.config.unit ?? ''];
  if (unitMax === undefined) {
    return field;
  }
  const min = field.config.min ?? 0;
  const max = field.config.max ?? unitMax;
  const ranged: Field = { ...field, state: { ...field.state, range: { min, max, delta: max - min } } };
  // The display processor reads the range for the color of the value, so it must see the new range.
  ranged.display = getDisplayProcessor({ field: ranged, theme });
  return ranged;
}

/**
 * Copies of the frames in which each percent field has the range 0 to 100 (`percent`) or 0 to 1 (`percentunit`).
 * Without it, the range of a percent field is the range of its data, and a value of 87% fills the gauge.
 * Core Gauge applies the same rule: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/gauge/GaugePanel.tsx
 */
export function applyPercentUnitRange(frames: DataFrame[], theme: GrafanaTheme2): DataFrame[] {
  return frames.map((frame) => ({ ...frame, fields: frame.fields.map((field) => withPercentUnitRange(field, theme)) }));
}
