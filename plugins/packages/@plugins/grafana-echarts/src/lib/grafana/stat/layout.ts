// The layout of the stat panel: one cell for each value, with the position, the size and the color of each part.
// This file has no ECharts code. `lib/echarts/options/stat.ts` draws the cells.
//
// It gives the layout of the `BigValue` component of `@grafana/ui`. That component fits the font sizes in
// `BigValueLayout` and gives the positions to CSS flexbox. This file does the two steps as pixel arithmetic.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/BigValue/BigValueLayout.tsx
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/BigValue/BigValue.tsx
import {
  colorManipulator,
  type DisplayValue,
  type DisplayValueAlignmentFactors,
  type FieldDisplay,
  FieldType,
  formattedValueToString,
  getDisplayValueAlignmentFactors,
  type GrafanaTheme2,
  type TimeRange,
} from '@grafana/data';
import { BigValueColorMode, BigValueJustifyMode, BigValueTextMode } from '@grafana/schema';
import { type StatRenderOptions } from 'editor/stat';
import { fitFontSize, measureTextWidth } from 'lib/grafana/fitFontSize';
import { layoutRepeaterCells, type RepeaterCell } from 'lib/grafana/repeater/layout';
import {
  BACKGROUND_SPARKLINE_FILL,
  getBackgroundGradientColors,
  getBackgroundGradientLine,
  getBackgroundSparklineLineColor,
  getBackgroundTextColor,
} from 'lib/grafana/stat/colors';
import {
  getSparklineXRange,
  getSparklineYRange,
  layoutSparklineSegments,
  type SparklinePoint,
} from 'lib/grafana/sparkline';

/** The space between two cells in pixels, as core Stat gives to `VizRepeater`. */
export const STAT_CELL_SPACING = 3;
/** The line height of all text, as a factor of the font size. */
export const STAT_LINE_HEIGHT = 1.2;
const MAX_TITLE_SIZE = 30;
const VALUE_FONT_WEIGHT = 500;
/** A cell that is wider than this factor of its height puts the name and the value side by side. */
const WIDE_ASPECT_RATIO = 2.5;
/** The smallest cell height in pixels that has a sparkline, for the wide and the stacked layouts. */
const WIDE_CHART_MIN_HEIGHT = 50;
const STACKED_CHART_MIN_HEIGHT = 100;
const SPARKLINE_FILL_ALPHA = 0.2;
/** The gap between the name and the value of a centered cell, in widths of the character "0". */
const CENTER_GAP_CH = 0.75;

export type StatTextAlign = 'left' | 'center' | 'right';

/** One line of text. `y` is the top of its line box, which is `fontSize * STAT_LINE_HEIGHT` high. */
export interface StatText {
  text: string;
  /** The left edge, the center or the right edge of the text, as `align` says. */
  x: number;
  y: number;
  align: StatTextAlign;
  fontSize: number;
  fontWeight: number;
  color: string;
  /** The text does not draw wider than this. */
  maxWidth: number;
}

/** The value text. The suffix (for example a unit) comes after `text`, with a smaller font. */
export interface StatValueText extends StatText {
  suffix?: string;
  suffixFontSize: number;
}

export interface StatSparkline {
  /** The points of the line in pixels. Each segment is one line with no gap. */
  segments: SparklinePoint[][];
  /** The y position in pixels to which the area below the line is filled. */
  baseline: number;
  lineColor: string;
  fillColor: string;
}

/**
 * The fill of a cell in a background color mode. With two colors it is a linear gradient from `start` to
 * `end`, which are pixel positions. With one color it is a solid fill.
 */
export interface StatBackground {
  colors: [string] | [string, string];
  start: SparklinePoint;
  end: SparklinePoint;
}

/** One value of the panel, with all positions in pixels from the top left corner of the panel. */
export interface StatCell extends RepeaterCell {
  background?: StatBackground;
  title?: StatText;
  value?: StatValueText;
  sparkline?: StatSparkline;
  /** The value that the cell shows, for data links. */
  display: FieldDisplay;
}

export interface StatLayoutInput {
  /** The width of the panel in pixels. */
  width: number;
  /** The height of the panel in pixels. */
  height: number;
  values: FieldDisplay[];
  options: StatRenderOptions;
  theme: GrafanaTheme2;
  /** The time range of the panel: the x range of the sparklines. */
  timeRange?: TimeRange;
}

/**
 * The text mode of the panel for the automatic mode, as core Stat: a panel with no title, or with a display name
 * in the field config, shows the name of each value.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/stat/StatPanel.tsx
 */
export function resolveStatTextMode(
  textMode: BigValueTextMode,
  hasDefaultDisplayName: boolean,
  panelTitle: string | undefined
): BigValueTextMode {
  return textMode === BigValueTextMode.Auto && (hasDefaultDisplayName || !panelTitle)
    ? BigValueTextMode.ValueAndName
    : textMode;
}

/** The texts of one cell, and the texts that set the font sizes of all cells. */
interface StatTexts {
  title?: string;
  /** The value text with its prefix. */
  text: string;
  suffix?: string;
  titleToAlignTo?: string;
  valueToAlignTo: string;
}

/** The texts for a text mode. The automatic mode shows the name only when the panel has more than one value. */
function getStatTexts(
  value: DisplayValue,
  factors: DisplayValueAlignmentFactors,
  textMode: BigValueTextMode,
  count: number
): StatTexts {
  const mode = textMode === BigValueTextMode.Auto && count === 1 ? BigValueTextMode.Value : textMode;
  const text = `${value.prefix ?? ''}${value.text}`;
  const valueToAlignTo = formattedValueToString(factors);

  switch (mode) {
    case BigValueTextMode.Name:
      return { text: value.title ?? '', valueToAlignTo: factors.title ?? '' };
    case BigValueTextMode.Value:
      return { text, suffix: value.suffix, valueToAlignTo };
    case BigValueTextMode.None:
      return { text: '', valueToAlignTo: '1' };
    default:
      return { title: value.title, text, suffix: value.suffix, titleToAlignTo: factors.title, valueToAlignTo };
  }
}

/** The font size of the suffix is smaller than the one of the value, as `FormattedValueDisplay` of `@grafana/ui`. */
function suffixFontSize(fontSize: number): number {
  if (fontSize < 20) {
    return fontSize * 0.9;
  }
  return fontSize * (fontSize < 26 ? 0.8 : 0.6);
}

interface StatFontSizes {
  title: number;
  value: number;
  /** The height of the sparkline in pixels. `0` for a layout with no sparkline. */
  chartHeight: number;
}

interface FitInput {
  cell: RepeaterCell;
  texts: StatTexts;
  /** The width and the height of the cell without its padding. */
  maxTextWidth: number;
  maxTextHeight: number;
  fontFamily: string;
}

/** The fit of the name: the regular weight, and not larger than `MAX_TITLE_SIZE`. */
const fitTitle = ({ texts, fontFamily }: FitInput, width: number, height: number) =>
  texts.titleToAlignTo
    ? fitFontSize({
        text: texts.titleToAlignTo,
        width,
        height,
        lineHeight: STAT_LINE_HEIGHT,
        fontFamily,
        maxSize: MAX_TITLE_SIZE,
      })
    : 0;

const fitValue = ({ texts, fontFamily }: FitInput, width: number, height: number) =>
  texts.valueToAlignTo
    ? fitFontSize({
        text: texts.valueToAlignTo,
        width,
        height,
        lineHeight: STAT_LINE_HEIGHT,
        fontFamily,
        fontWeight: VALUE_FONT_WEIGHT,
      })
    : 0;

/** The name is not larger than 70% of the value. */
const limitTitle = (title: number, value: number) => (title > 0 ? Math.min(value * 0.7, title) : 0);

/** Wide cell, no sparkline: the name at the left, the value at the right. */
function fitWideNoChart(input: FitInput): StatFontSizes {
  const { maxTextWidth, maxTextHeight, texts } = input;
  const value = fitValue(input, maxTextWidth * (texts.titleToAlignTo ? 0.3 : 1), maxTextHeight);
  const title = limitTitle(fitTitle(input, maxTextWidth * 0.6, maxTextHeight), value);
  return { title, value, chartHeight: 0 };
}

/** Wide cell with a sparkline in the lower half. */
function fitWideWithChart(input: FitInput): StatFontSizes {
  const { maxTextWidth, maxTextHeight, cell } = input;
  return {
    title: fitTitle(input, maxTextWidth * 0.6, maxTextHeight * 0.4),
    value: fitValue(input, maxTextWidth * 0.4, maxTextHeight * 0.5),
    chartHeight: cell.height * 0.5,
  };
}

/** The name above the value, and a sparkline that fills the space below them. */
function fitStackedWithChart(input: FitInput): StatFontSizes {
  const { maxTextWidth, maxTextHeight, cell } = input;
  const fittedTitle = fitTitle(input, maxTextWidth, cell.height * 0.15);
  const value = fitValue(input, maxTextWidth, maxTextHeight - cell.height * 0.25 - fittedTitle * STAT_LINE_HEIGHT);
  const title = limitTitle(fittedTitle, value);
  return { title, value, chartHeight: cell.height - (title + value) * STAT_LINE_HEIGHT };
}

/** The name above the value. */
function fitStackedNoChart(input: FitInput): StatFontSizes {
  const { maxTextWidth, maxTextHeight, cell } = input;
  const fittedTitle = fitTitle(input, maxTextWidth, cell.height * 0.15);
  const value = fitValue(input, maxTextWidth, maxTextHeight - fittedTitle * STAT_LINE_HEIGHT);
  return { title: limitTitle(fittedTitle, value), value, chartHeight: 0 };
}

/**
 * The space in pixels between the name and the value of a centered cell. Core gives the CSS gap `0.75ch`: 75%
 * of the width of the character "0" in the body font.
 */
function getCenterGap(theme: GrafanaTheme2): number {
  const { fontFamily, fontSize } = theme.typography;
  return CENTER_GAP_CH * (measureTextWidth({ text: '0', fontSize, fontFamily }) ?? fontSize / 2);
}

/**
 * The width in pixels of the name, and of the name and the value in one row with the gap between them.
 * `undefined` when the host cannot measure text.
 */
function measureRow(
  texts: StatTexts,
  titleSize: number,
  valueSize: number,
  gap: number,
  theme: GrafanaTheme2
): { title: number; total: number } | undefined {
  const { fontFamily, fontWeightRegular } = theme.typography;
  const width = (text: string | undefined, fontSize: number, fontWeight: number) =>
    text ? measureTextWidth({ text, fontSize, fontFamily, fontWeight }) : 0;
  const title = width(texts.title, titleSize, fontWeightRegular);
  const value = width(texts.text, valueSize, VALUE_FONT_WEIGHT);
  const suffix = width(texts.suffix, suffixFontSize(valueSize), VALUE_FONT_WEIGHT);
  if (title === undefined || value === undefined || suffix === undefined) {
    return undefined;
  }
  return { title, total: title + gap + value + suffix };
}

interface StatCellColors {
  background?: StatBackground;
  title: string;
  value: string;
  sparklineLine: string;
  sparklineFill: string;
}

/**
 * The colors of a cell for a color mode, as `BigValueLayout`. In the background modes the cell has the value
 * color, and the texts and the sparkline have colors that show on it. In the other modes the cell has no fill.
 */
function getCellColors(
  cell: RepeaterCell,
  valueColor: string,
  colorMode: BigValueColorMode,
  theme: GrafanaTheme2
): StatCellColors {
  const isGradient = colorMode === BigValueColorMode.Background;
  if (!isGradient && colorMode !== BigValueColorMode.BackgroundSolid) {
    const textColor = theme.colors.text.primary;
    return {
      title: textColor,
      value: colorMode === BigValueColorMode.None ? textColor : valueColor,
      sparklineLine: valueColor,
      sparklineFill: colorManipulator.alpha(valueColor, SPARKLINE_FILL_ALPHA),
    };
  }
  const textColor = getBackgroundTextColor(valueColor, theme.isDark);
  return {
    background: {
      ...getBackgroundGradientLine(cell),
      colors: isGradient ? getBackgroundGradientColors(valueColor, theme.isDark) : [valueColor],
    },
    title: textColor,
    value: textColor,
    sparklineLine: getBackgroundSparklineLineColor(valueColor),
    sparklineFill: BACKGROUND_SPARKLINE_FILL,
  };
}

/** The cell without its sparkline. The font size of a text that has no space is 0, and the cell does not draw it. */
function layoutCell(
  cell: RepeaterCell,
  display: FieldDisplay,
  factors: DisplayValueAlignmentFactors,
  { values, options, theme, timeRange }: StatLayoutInput
): StatCell {
  const texts = getStatTexts(display.display, factors, options.textMode, values.length);
  const padding = cell.height > 100 ? 12 : 8;
  const maxTextWidth = cell.width - padding * 2;
  const maxTextHeight = cell.height - padding * 2;
  const fitInput: FitInput = { cell, texts, maxTextWidth, maxTextHeight, fontFamily: theme.typography.fontFamily };

  const sparkline = display.sparkline;
  const isWide = options.wideLayout && cell.width / cell.height > WIDE_ASPECT_RATIO;
  const hasChart =
    sparkline !== undefined &&
    sparkline.y.values.length > 1 &&
    cell.height > (isWide ? WIDE_CHART_MIN_HEIGHT : STACKED_CHART_MIN_HEIGHT);

  let sizes: StatFontSizes;
  if (isWide) {
    sizes = hasChart ? fitWideWithChart(fitInput) : fitWideNoChart(fitInput);
  } else {
    sizes = hasChart ? fitStackedWithChart(fitInput) : fitStackedNoChart(fitInput);
  }
  const titleSize = Math.max(sizes.title, 0);
  const valueSize = Math.max(sizes.value, 0);

  // The content box of the cell.
  const left = cell.x + padding;
  const top = cell.y + padding;
  const titleHeight = texts.title ? titleSize * STAT_LINE_HEIGHT : 0;
  const valueHeight = valueSize * STAT_LINE_HEIGHT;
  const centerX = left + maxTextWidth / 2;
  const centerY = (height: number) => top + (maxTextHeight - height) / 2;
  // A cell with no name puts its value at the center in each text alignment, as `shouldJustifyCenter` of core.
  const isCentered = options.justifyMode === BigValueJustifyMode.Center || !texts.title;

  let titleX = left;
  let titleAlign: StatTextAlign = 'left';
  let titleY: number;
  let valueY: number;
  let valueX = left;
  let valueAlign: StatTextAlign = 'left';
  if (isCentered) {
    // The texts are at the center of the cell, also with a sparkline. A wide cell puts the name and the value
    // in one row when the row has space, else the name above the value, as a flexbox that wraps.
    const gap = texts.title ? getCenterGap(theme) : 0;
    const rowWidth = isWide && texts.title ? measureRow(texts, titleSize, valueSize, gap, theme) : undefined;
    if (rowWidth && rowWidth.total <= maxTextWidth) {
      titleX = left + (maxTextWidth - rowWidth.total) / 2;
      valueX = titleX + rowWidth.title + gap;
      titleY = centerY(titleHeight);
      valueY = centerY(valueHeight);
    } else {
      titleX = valueX = centerX;
      titleAlign = valueAlign = 'center';
      titleY = centerY(titleHeight + gap + valueHeight);
      valueY = titleY + titleHeight + gap;
    }
  } else if (isWide) {
    // Side by side. With a sparkline the texts are at the top of the cell, else at its vertical center.
    titleY = hasChart ? top : centerY(titleHeight);
    valueY = hasChart ? top : centerY(valueHeight);
    valueX = left + maxTextWidth;
    valueAlign = 'right';
  } else {
    // The name above the value. With a sparkline the texts are at the top of the cell, else at its vertical center.
    titleY = hasChart ? top : centerY(titleHeight + valueHeight);
    valueY = titleY + titleHeight;
  }

  const valueColor = display.display.color ?? 'gray';
  const colors = getCellColors(cell, valueColor, options.colorMode, theme);
  const result: StatCell = { ...cell, display };
  if (colors.background) {
    result.background = colors.background;
  }

  if (texts.title && titleSize > 0) {
    result.title = {
      text: texts.title,
      x: titleX,
      y: titleY,
      align: titleAlign,
      fontSize: titleSize,
      fontWeight: theme.typography.fontWeightRegular,
      color: colors.title,
      maxWidth: isWide ? maxTextWidth * 0.6 : maxTextWidth,
    };
  }
  if (texts.text && valueSize > 0) {
    result.value = {
      text: texts.text,
      suffix: texts.suffix || undefined,
      suffixFontSize: suffixFontSize(valueSize),
      x: valueX,
      y: valueY,
      align: valueAlign,
      fontSize: valueSize,
      fontWeight: VALUE_FONT_WEIGHT,
      color: colors.value,
      maxWidth: maxTextWidth,
    };
  }

  // The sparkline is as wide as the cell, at its bottom edge. It does not use the padding.
  const yRange = sparkline && getSparklineYRange(sparkline);
  if (hasChart && sparkline?.y.type === FieldType.number && yRange && sizes.chartHeight > 0) {
    const rect = {
      x: cell.x,
      y: cell.y + cell.height - sizes.chartHeight,
      width: cell.width,
      height: sizes.chartHeight,
    };
    result.sparkline = {
      segments: layoutSparklineSegments({
        x: sparkline.x?.values,
        y: sparkline.y.values,
        xRange: getSparklineXRange({ ...sparkline, timeRange }),
        yRange,
        rect,
      }),
      baseline: rect.y + rect.height,
      lineColor: colors.sparklineLine,
      fillColor: colors.sparklineFill,
    };
  }
  return result;
}

/**
 * The cells of the panel, one for each value, in row order. All cells use the font sizes that fit the longest
 * name and the longest value of the panel, so the cells look the same.
 */
export function layoutStatCells(input: StatLayoutInput): StatCell[] {
  const { width, height, values } = input;
  const cells = layoutRepeaterCells({ width, height, count: values.length, spacing: STAT_CELL_SPACING });
  const factors = getDisplayValueAlignmentFactors(values);
  return cells.map((cell, index) => layoutCell(cell, values[index], factors, input));
}
