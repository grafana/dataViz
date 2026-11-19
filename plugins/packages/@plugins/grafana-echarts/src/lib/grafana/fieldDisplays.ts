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
  /**
   * The reducer when `reduceOptions.calcs` is unset or empty. For an empty list, core uses `last`, which gives no
   * value for a field that ends with a null. The pie chart of this package uses its default too.
   */
  defaultCalc: string;
  replaceVariables: InterpolateFunction;
  theme: GrafanaTheme2;
  timeZone?: string;
  /** Add the values of the field over time to each result (`FieldDisplay.sparkline`). */
  sparkline?: boolean;
  /** Add the change from the first value to the last value, in percent, to each result (`DisplayValue.percentChange`). */
  percentChange?: boolean;
}

/**
 * The values that the panel shows, in the order of the frames and the fields. Grafana does the reduction, the
 * display name, the color, the unit and the value mappings.
 *
 * The result is empty when no field matches. For that case Grafana gives one placeholder with no column index,
 * and this function removes it. The text of the placeholder is the `noValue` field option, or "No data". The
 * caller owns that case: its data issue view shows the message, and reads `fieldConfig.defaults.noValue` if it
 * shows the text of the option.
 *
 * A number field with no row is a different case, for example a query that returns no row. It gives one result
 * with a `NaN` number, and its text is the `noValue` field option, or ''. The result is not empty.
 */
export function resolveFieldDisplays(input: FieldDisplayInput): FieldDisplay[] {
  const { frames, reduceOptions, defaultCalc, ...rest } = input;
  const calcs = reduceOptions?.calcs?.length ? reduceOptions.calcs : [defaultCalc];

  return getFieldDisplayValues({ ...rest, data: frames, reduceOptions: { ...reduceOptions, calcs } }).filter(
    (display) => display.colIndex !== undefined
  );
}

/**
 * A copy of the field with a new range. The copy has a new display processor, because the processor reads the
 * range for the color and the percent of a value. The input field does not change.
 *
 * `timeZone` is the time zone of the dashboard. The new processor does not get the time zone of the old one, and
 * without it, a value with a date unit shows in the time zone of the browser.
 */
export function withFieldRange(
  field: Field,
  range: { min: number; max: number },
  theme: GrafanaTheme2,
  timeZone: string | undefined
): Field {
  const { min, max } = range;
  const ranged: Field = { ...field, state: { ...field.state, range: { min, max, delta: max - min } } };
  ranged.display = getDisplayProcessor({ field: ranged, theme, timeZone });
  return ranged;
}

const PERCENT_UNIT_MAX: Record<string, number> = { percent: 100, percentunit: 1 };

/** A field with the unit `percent` or `percentunit` gets the range of its unit, unless `min` or `max` is set. */
function withPercentUnitRange(field: Field, theme: GrafanaTheme2): Field {
  const unitMax = PERCENT_UNIT_MAX[field.config.unit ?? ''];
  if (unitMax === undefined) {
    return field;
  }
  // A percent value has no time, so its processor needs no time zone. Core Gauge gives it none too.
  return withFieldRange(field, { min: field.config.min ?? 0, max: field.config.max ?? unitMax }, theme, undefined);
}

/**
 * Copies of the frames in which each percent field has the range 0 to 100 (`percent`) or 0 to 1 (`percentunit`).
 * Without it, the range of a percent field is the range of its data, and a value of 87% fills the gauge.
 * Core Gauge applies the same rule: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/gauge/GaugePanel.tsx
 */
export function applyPercentUnitRange(frames: DataFrame[], theme: GrafanaTheme2): DataFrame[] {
  return frames.map((frame) => ({ ...frame, fields: frame.fields.map((field) => withPercentUnitRange(field, theme)) }));
}
