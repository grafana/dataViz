// The percent change of a stat cell: its text, its arrow, its sizes and its color. This file has no ECharts code.
//
// It gives the `PercentChange` component of `@grafana/ui` and the styles that `BigValueLayout` sets for it.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/BigValue/PercentChange.tsx
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/BigValue/BigValueLayout.tsx
import { type GrafanaTheme2 } from '@grafana/data';
import { PercentChangeColorMode } from '@grafana/schema';
import { type FlowItem, type FlowPosition } from 'lib/grafana/stat/flow';

/** The line height of the text, as a factor of the font size. */
const LINE_HEIGHT = 1.2;
const FONT_WEIGHT = 500;
/** The value is this many times as large as the percent change. */
const VALUE_TO_PERCENT_CHANGE_RATIO = 2.5;
const MIN_FONT_SIZE = 12;
const MIN_ICON_SIZE = 10;
const MIN_ICON_GAP = 4;
/**
 * The distance from the middle of a line of text down to its baseline, as a factor of the font size, for the
 * Inter font of Grafana. In a row, the bottom of the arrow is on the baseline of the text.
 */
const BASELINE_FACTOR = 0.36;

export type PercentChangeDirection = 'up' | 'down';

/** The arrow of a percent change, in a square of `size` pixels with its top left corner at `x`, `y`. */
export interface PercentChangeIcon {
  direction: PercentChangeDirection;
  x: number;
  y: number;
  size: number;
}

export interface PercentChangeMetrics {
  text: string;
  fontSize: number;
  fontWeight: number;
  /** `undefined` for a change of 0, which has no arrow. */
  direction: PercentChangeDirection | undefined;
  iconSize: number;
  /** The space in pixels between the arrow and the text. */
  iconGap: number;
  /** The arrow, the space and the text as one item of the flexbox of the cell. */
  item: FlowItem;
}

/** `true` when the value has a percent change to show. Grafana gives `NaN` when the first value is 0. */
export function hasPercentChange(percentChange: number | undefined): percentChange is number {
  return percentChange != null && !Number.isNaN(percentChange);
}

/** The text of a percent change, with not more than 3 significant digits. The input is in percent: 50 is 50%. */
export function formatPercentChange(percentChange: number): string {
  return (percentChange / 100).toLocaleString(undefined, { style: 'percent', maximumSignificantDigits: 3 });
}

export interface PercentChangeInput {
  percentChange: number;
  /** The font size of the value in pixels. */
  valueSize: number;
  /** The font size that the panel options set. Unset gives a size from the size of the value. */
  percentSize?: number;
  /**
   * The font size at which the text fits the cell. The text mode None sets it: the cell then shows only the
   * percent change.
   */
  fittedSize?: number;
  /** The cell is a row (a wide cell). `false` for a column (a stacked cell). */
  isRow: boolean;
  /** The width of a text in pixels. `undefined` when the host cannot measure text. */
  measure: (text: string, fontSize: number, fontWeight: number) => number | undefined;
}

/** The sizes of a percent change, before the flexbox of the cell gives it a position. */
export function measurePercentChange(input: PercentChangeInput): PercentChangeMetrics {
  const { percentChange, valueSize, percentSize, fittedSize, isRow, measure } = input;
  const text = formatPercentChange(percentChange);
  const fontSize = fittedSize ?? (percentSize || Math.max(valueSize / VALUE_TO_PERCENT_CHANGE_RATIO, MIN_FONT_SIZE));
  let iconSize = percentSize ? percentSize - 3 : Math.max(valueSize / 3, MIN_ICON_SIZE);
  if (fittedSize !== undefined) {
    iconSize = fittedSize * 0.8;
  }
  const iconGap = Math.max(fontSize / 3, MIN_ICON_GAP);
  let direction: PercentChangeDirection | undefined;
  if (percentChange !== 0) {
    direction = percentChange > 0 ? 'up' : 'down';
  }

  const textWidth = measure(text, fontSize, FONT_WEIGHT);
  return {
    text,
    fontSize,
    fontWeight: FONT_WEIGHT,
    direction,
    iconSize,
    iconGap,
    item: {
      width: textWidth === undefined ? undefined : textWidth + (direction ? iconSize + iconGap : 0),
      // In a row, the line of the percent change is as high as the line of the value, so the two texts have
      // the same vertical center. In a column, a text larger than 12px moves up, nearer to the value.
      height: fontSize * LINE_HEIGHT * (isRow ? VALUE_TO_PERCENT_CHANGE_RATIO : 1),
      marginTop: !isRow && fontSize > MIN_FONT_SIZE ? -(fontSize / 4) : 0,
    },
  };
}

/**
 * The position of the text and of the arrow, from the position of the item in the flexbox. The text is at the
 * vertical center of the item. `textY` is the top of its line box, which is `fontSize * 1.2` high.
 */
export function placePercentChange(
  metrics: PercentChangeMetrics,
  position: FlowPosition,
  isRow: boolean
): { textX: number; textY: number; icon?: PercentChangeIcon } {
  const { item, fontSize, direction, iconSize, iconGap } = metrics;
  const width = item.width ?? 0;
  let left = position.x;
  if (position.align === 'center') {
    left -= width / 2;
  } else if (position.align === 'right') {
    left -= width;
  }
  const centerY = position.y + item.height / 2;
  const textY = centerY - (fontSize * LINE_HEIGHT) / 2;
  if (!direction) {
    return { textX: left, textY };
  }
  // In a row, the bottom of the arrow is on the baseline of the text. In a column, the arrow is at the
  // vertical center of the text.
  const iconY = isRow ? centerY + fontSize * BASELINE_FACTOR - iconSize : centerY - iconSize / 2;
  return {
    textX: left + iconSize + iconGap,
    textY,
    icon: { direction, x: left, y: iconY, size: iconSize },
  };
}

/**
 * The color of the percent change. Standard: green for an increase, else red. Inverted: the opposite. Same as
 * Value: the color of the value text.
 */
export function getPercentChangeColor(
  percentChange: number,
  colorMode: PercentChangeColorMode,
  valueTextColor: string,
  theme: GrafanaTheme2
): string {
  if (colorMode === PercentChangeColorMode.SameAsValue) {
    return valueTextColor;
  }
  const sign = colorMode === PercentChangeColorMode.Inverted ? -1 : 1;
  return theme.visualization.getColorByName(percentChange * sign > 0 ? 'green' : 'red');
}
