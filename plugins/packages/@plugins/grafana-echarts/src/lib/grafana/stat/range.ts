// The range of the number fields of a stat panel. This file has no ECharts code.
import { type DataFrame, FieldType, type GrafanaTheme2, NullValueMode } from '@grafana/data';
import { withFieldRange } from 'lib/grafana/fieldDisplays';

/** The smallest and the largest number of all number fields of the frames. `undefined` when there is no number. */
export function findNumericRange(frames: DataFrame[]): { min: number; max: number } | undefined {
  let min = Infinity;
  let max = -Infinity;
  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }
      const nullAsZero = field.config.nullValueMode === NullValueMode.AsZero;
      const values: unknown[] = field.values;
      for (const raw of values) {
        // A transformation can leave a string such as "200" in a number field.
        const value = typeof raw === 'string' && raw !== '' ? Number(raw) : raw === null && nullAsZero ? 0 : raw;
        if (typeof value === 'number' && !Number.isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
    }
  }
  return min === Infinity ? undefined : { min, max };
}

/**
 * Copies of the frames in which each number field has a range. A field that has a range keeps it. Other fields
 * get the `min` and `max` of their config, and the range of all number fields of the panel for the end that the
 * config does not give. All sparklines of the panel then use one y scale.
 * Grafana sets this range before the panel draws, but not for streaming data and not in the Renderer.
 * Core Stat applies the same rule: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/stat/StatPanel.tsx
 *
 * `timeZone` is the time zone of the dashboard. A field that gets a range also gets a new display processor, and
 * without the time zone, a value with a date unit shows in the time zone of the browser.
 */
export function applyGlobalFieldRange(
  frames: DataFrame[],
  theme: GrafanaTheme2,
  timeZone: string | undefined
): DataFrame[] {
  // The range of the panel is found one time, and only when a field needs it.
  let global: ReturnType<typeof findNumericRange>;
  let hasGlobal = false;

  return frames.map((frame) => ({
    ...frame,
    fields: frame.fields.map((field) => {
      if (field.type !== FieldType.number || field.state?.range) {
        return field;
      }
      const { min: configMin, max: configMax } = field.config;
      if (!hasGlobal && (typeof configMin !== 'number' || typeof configMax !== 'number')) {
        global = findNumericRange(frames);
        hasGlobal = true;
      }
      const min = configMin ?? global?.min;
      const max = configMax ?? global?.max;
      return typeof min === 'number' && typeof max === 'number'
        ? withFieldRange(field, { min, max }, theme, timeZone)
        : field;
    }),
  }));
}
