// The colors of a stat cell in the background color modes. This file has no ECharts code.
//
// It gives the colors of the `BigValue` component of `@grafana/ui` for the color modes `background` and
// `background_solid`: the background of the cell, the text color on it, and the sparkline colors.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/BigValue/BigValueLayout.tsx
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/utils/colors.ts
import { colorManipulator } from '@grafana/data';
import { Hsl } from 'lib/grafana/fields/gradientColors';

/** The text colors on a colored background, as `getTextColorForAlphaBackground` of `@grafana/ui`. */
const DARK_TEXT = 'rgb(32, 34, 38)';
const LIGHT_TEXT = 'rgb(247, 248, 250)';
/** A background with more brightness than this has dark text. The range is 0 to 255. */
const BRIGHT_BACKGROUND = 180;
/** A background with less alpha than this shows the panel below it, so the text has the theme color. */
const MIN_BACKGROUND_ALPHA = 0.3;

/** The fill of the sparkline area on a colored background. */
export const BACKGROUND_SPARKLINE_FILL = 'rgba(255,255,255,0.4)';
/** The sparkline line on a colored background is the value color with this percent added to each channel. */
const SPARKLINE_BRIGHTEN_PERCENT = 40;

/** The hue shift in degrees of the two colors of the gradient. */
const GRADIENT_HUE_SHIFT = 8;
/** The percent of lightness that the start color and the end color of the gradient lose. */
const GRADIENT_START_DARKEN = 15;
const GRADIENT_END_DARKEN = 5;
/** A dark theme makes the colors darker. A light theme makes them lighter, by a smaller amount. */
const LIGHT_THEME_FACTOR = -0.7;
/** The angle of the gradient in degrees, clockwise from "up", as the CSS `linear-gradient` function. */
const GRADIENT_ANGLE = 120;

/** The color as `rgb()` or `rgba()`, and its channels. `asRgbString` reads all CSS formats and color names. */
function readColor(color: string): { rgb: string; channels: number[]; alpha: number } {
  const rgb = colorManipulator.asRgbString(color);
  // `decomposeColor` types its values as `any`.
  const values: unknown = colorManipulator.decomposeColor(rgb).values;
  const [r = 0, g = 0, b = 0, alpha = 1] = Array.isArray(values) ? values.map((value: unknown) => Number(value)) : [];
  return { rgb, channels: [r, g, b], alpha };
}

/**
 * The text color on a background of the value color: dark text on a bright color, light text on a dark color,
 * and the text color of the theme on a color that is almost transparent.
 */
export function getBackgroundTextColor(valueColor: string, isDark: boolean): string {
  const { channels, alpha } = readColor(valueColor);
  if (alpha < MIN_BACKGROUND_ALPHA) {
    return isDark ? LIGHT_TEXT : DARK_TEXT;
  }
  // The perceived brightness of the W3C color contrast rule: https://www.w3.org/TR/AERT/#color-contrast
  const [r, g, b] = channels;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > BRIGHT_BACKGROUND ? DARK_TEXT : LIGHT_TEXT;
}

/** The color of the sparkline line on a background of the value color. */
export function getBackgroundSparklineLineColor(valueColor: string): string {
  const { rgb, alpha } = readColor(valueColor);
  return Hsl.from(rgb).brighten(SPARKLINE_BRIGHTEN_PERCENT).toString(alpha);
}

/** The start color and the end color of the background gradient of a cell. */
export function getBackgroundGradientColors(valueColor: string, isDark: boolean): [string, string] {
  const { rgb, alpha } = readColor(valueColor);
  const factor = isDark ? 1 : LIGHT_THEME_FACTOR;
  return [
    Hsl.from(rgb)
      .spin(GRADIENT_HUE_SHIFT)
      .darken(GRADIENT_START_DARKEN * factor)
      .toString(alpha),
    Hsl.from(rgb)
      .spin(-GRADIENT_HUE_SHIFT)
      .darken(GRADIENT_END_DARKEN * factor)
      .toString(alpha),
  ];
}

/**
 * The start point and the end point in pixels of the gradient line of a rectangle, as CSS `linear-gradient`
 * gives them: the line goes through the center of the rectangle, and its length puts the two colors at the
 * corners.
 * https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient#composition_of_a_linear_gradient
 */
export function getBackgroundGradientLine(rect: { x: number; y: number; width: number; height: number }): {
  start: [number, number];
  end: [number, number];
} {
  const angle = (GRADIENT_ANGLE * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const half = (Math.abs(rect.width * dx) + Math.abs(rect.height * dy)) / 2;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  return {
    start: [centerX - dx * half, centerY - dy * half],
    end: [centerX + dx * half, centerY + dy * half],
  };
}
