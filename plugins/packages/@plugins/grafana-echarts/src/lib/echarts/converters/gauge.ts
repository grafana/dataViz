// Changes the Grafana values of a gauge panel into the plain model that the ECharts option code reads.
// No ECharts type is here, and no Grafana type goes past this file.
import {
  FALLBACK_COLOR,
  type FieldConfig,
  type FieldDisplay,
  formattedValueToString,
  type GrafanaTheme2,
  ThresholdsMode,
} from '@grafana/data';

/** A part of the threshold band: it ends at `to` (0 is the minimum, 1 is the maximum) and has one color. */
export interface GaugeThresholdStop {
  to: number;
  color: string;
}

/** One gauge: all that the option code needs to draw it. */
export interface GaugeValue {
  /** The display name. */
  name: string;
  /** The value text, with its prefix and suffix. */
  text: string;
  /** The value as a number. `NaN` when the value is not a number. */
  numeric: number;
  min: number;
  max: number;
  /** The color of the value arc, as a CSS color. */
  color: string;
  /** The threshold band from the minimum to the maximum. The last stop ends at 1. */
  thresholds: GaugeThresholdStop[];
  /** The field has a display name of its own. Text mode `auto` reads it. */
  hasDisplayName: boolean;
}

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;

/**
 * The range of the gauge. Equal limits give a division by zero, so they move apart by 10%, as core does.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/RadialGauge/utils.ts
 */
export function resolveGaugeRange(field: FieldConfig): { min: number; max: number } {
  const min = field.min ?? DEFAULT_MIN;
  const max = field.max ?? DEFAULT_MAX;
  if (min !== max) {
    return { min, max };
  }
  // A range of [0, 0] stays empty with the 10% rule, so it gets the default maximum.
  return min === 0 ? { min: 0, max: DEFAULT_MAX } : { min: min - Math.abs(min) * 0.1, max: max + Math.abs(max) * 0.1 };
}

const clampFraction = (fraction: number) => Math.min(Math.max(fraction, 0), 1);

/**
 * The threshold steps as band stops. A step has the color from its value to the value of the next step. Steps
 * outside the range, and steps with no length, are left out.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/configure-thresholds/
 */
export function resolveGaugeThresholds(
  field: FieldConfig,
  range: { min: number; max: number },
  theme: GrafanaTheme2
): GaugeThresholdStop[] {
  const steps = field.thresholds?.steps ?? [];
  const isPercent = field.thresholds?.mode === ThresholdsMode.Percentage;
  const toFraction = (value: number) =>
    clampFraction(isPercent ? value / 100 : (value - range.min) / (range.max - range.min));

  const stops: GaugeThresholdStop[] = [];
  let from = 0;
  steps.forEach((step, index) => {
    const next = steps[index + 1];
    const to = next ? toFraction(next.value) : 1;
    if (to > from) {
      stops.push({ to, color: theme.visualization.getColorByName(step.color) });
      from = to;
    }
  });
  return stops;
}

/** One `GaugeValue` for each `FieldDisplay`, in the same order. */
export function resolveGaugeValues(displays: FieldDisplay[], theme: GrafanaTheme2): GaugeValue[] {
  return displays.map((display) => {
    const range = resolveGaugeRange(display.field);
    return {
      name: display.display.title ?? '',
      text: formattedValueToString(display.display),
      numeric: display.display.numeric,
      ...range,
      color: display.display.color ?? FALLBACK_COLOR,
      thresholds: resolveGaugeThresholds(display.field, range, theme),
      hasDisplayName: display.field.displayName != null,
    };
  });
}
