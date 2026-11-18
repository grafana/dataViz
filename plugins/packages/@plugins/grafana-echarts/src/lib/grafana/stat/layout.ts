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
import { getDisplayLinks } from 'lib/grafana/dataLinks';
import { fitFontSize, measureTextWidth } from 'lib/grafana/fitFontSize';
import { layoutRepeaterCells, type RepeaterCell } from 'lib/grafana/repeater/layout';
import {
  BACKGROUND_SPARKLINE_FILL,
  getBackgroundGradientColors,
  getBackgroundGradientLine,
  getBackgroundSparklineLineColor,
  getBackgroundTextColor,
} from 'lib/grafana/stat/colors';
import { type FlowAlign, type FlowItem, layoutFlow } from 'lib/grafana/stat/flow';
import {
  formatPercentChange,
  getPercentChangeColor,
  hasPercentChange,
  measurePercentChange,
  type PercentChangeIcon,
  placePercentChange,
} from 'lib/grafana/stat/percentChange';
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
/** The part of the height that the value fits when the cell has a percent change and no sparkline. */
const PERCENT_CHANGE_VALUE_HEIGHT = 0.75;
/** The gap between the name and the value of a centered cell, in widths of the character "0". */
const CENTER_GAP_CH = 0.75;

export type StatTextAlign = FlowAlign;

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
  /** The layout measures the text as wider than `maxWidth`, so the text is cut there, with an ellipsis. */
  truncate?: boolean;
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

/** The change from the first value to the last value of the series, in percent, with an arrow for its sign. */
export interface StatPercentChange {
  text: StatText;
  /** The arrow has the color of the text. A change of 0 has no arrow. */
  icon?: PercentChangeIcon;
}

/** One value of the panel, with all positions in pixels from the top left corner of the panel. */
export interface StatCell extends RepeaterCell {
  background?: StatBackground;
  percentChange?: StatPercentChange;
  title?: StatText;
  value?: StatValueText;
  sparkline?: StatSparkline;
  /** The value that the cell shows, for data links. */
  display: FieldDisplay;
  /** The value has one or more data links, so the cell gets pointer events. */
  hasLinks?: boolean;
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
  /**
   * The font sizes that the panel options set. A text with a set size is not fitted: `texts` has no text to
   * align to for it, so its fit gives 0, and the size here replaces the fit.
   */
  titleSize?: number;
  valueSize?: number;
  /**
   * The factor for the height that the value fits, in a cell with no sparkline: 0.75 when the value has a
   * percent change, which needs a part of the height, else 1.
   */
  valueHeightFactor: number;
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
  const value =
    input.valueSize ??
    fitValue(input, maxTextWidth * (texts.titleToAlignTo ? 0.3 : 1), maxTextHeight * input.valueHeightFactor);
  const title = input.titleSize ?? limitTitle(fitTitle(input, maxTextWidth * 0.6, maxTextHeight), value);
  return { title, value, chartHeight: 0 };
}

/** Wide cell with a sparkline in the lower half. */
function fitWideWithChart(input: FitInput): StatFontSizes {
  const { maxTextWidth, maxTextHeight, cell } = input;
  return {
    title: input.titleSize ?? fitTitle(input, maxTextWidth * 0.6, maxTextHeight * 0.4),
    value: input.valueSize ?? fitValue(input, maxTextWidth * 0.4, maxTextHeight * 0.5),
    chartHeight: cell.height * 0.5,
  };
}

/** The name above the value, and a sparkline that fills the space below them. */
function fitStackedWithChart(input: FitInput): StatFontSizes {
  const { maxTextWidth, maxTextHeight, cell } = input;
  const fittedTitle = fitTitle(input, maxTextWidth, cell.height * 0.15);
  const value =
    input.valueSize ??
    fitValue(input, maxTextWidth, maxTextHeight - cell.height * 0.25 - fittedTitle * STAT_LINE_HEIGHT);
  const title = input.titleSize ?? limitTitle(fittedTitle, value);
  return { title, value, chartHeight: cell.height - (title + value) * STAT_LINE_HEIGHT };
}

/** The name above the value. */
function fitStackedNoChart(input: FitInput): StatFontSizes {
  const { maxTextWidth, maxTextHeight, cell } = input;
  const fittedTitle = fitTitle(input, maxTextWidth, cell.height * 0.15);
  const valueHeight = (maxTextHeight - fittedTitle * STAT_LINE_HEIGHT) * input.valueHeightFactor;
  const value = input.valueSize ?? fitValue(input, maxTextWidth, valueHeight);
  return { title: input.titleSize ?? limitTitle(fittedTitle, value), value, chartHeight: 0 };
}

/**
 * The space in pixels between the name and the value of a centered cell. Core gives the CSS gap `0.75ch`: 75%
 * of the width of the character "0" in the body font.
 */
function getCenterGap(theme: GrafanaTheme2): number {
  const { fontFamily, fontSize } = theme.typography;
  return CENTER_GAP_CH * (measureTextWidth({ text: '0', fontSize, fontFamily }) ?? fontSize / 2);
}

/** The sum of widths in pixels. `undefined` when a width is `undefined`: the host cannot measure text. */
function addWidths(...widths: Array<number | undefined>): number | undefined {
  let total = 0;
  for (const width of widths) {
    if (width === undefined) {
      return undefined;
    }
    total += width;
  }
  return total;
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
  const { titleSize: setTitleSize, valueSize: setValueSize } = options;
  const fitInput: FitInput = {
    cell,
    // As `BigValueLayout`: a text with a set size has no text to align to, so the other text gets its space.
    texts: {
      ...texts,
      titleToAlignTo: setTitleSize ? undefined : texts.titleToAlignTo,
      valueToAlignTo: setValueSize ? '' : texts.valueToAlignTo,
    },
    maxTextWidth,
    maxTextHeight,
    fontFamily: theme.typography.fontFamily,
    titleSize: setTitleSize,
    valueSize: setValueSize,
    // Core does not test for `NaN` here.
    valueHeightFactor: display.display.percentChange != null ? PERCENT_CHANGE_VALUE_HEIGHT : 1,
  };

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

  // A cell with no name puts its value at the center in each text alignment, as `shouldJustifyCenter` of core.
  const isCentered = options.justifyMode === BigValueJustifyMode.Center || !texts.title;
  const { fontFamily, fontWeightRegular } = theme.typography;
  const measure = (text: string | undefined, fontSize: number, fontWeight: number) =>
    text ? measureTextWidth({ text, fontSize, fontFamily, fontWeight }) : 0;

  // The texts are the items of a flexbox in the content box of the cell: a column in a stacked cell, and a row
  // that wraps in a wide cell. With a sparkline, texts that are not at the center start at the top of the cell.
  const titleItem: FlowItem | undefined = texts.title
    ? { width: measure(texts.title, titleSize, fontWeightRegular), height: titleSize * STAT_LINE_HEIGHT }
    : undefined;
  const valueItem: FlowItem = {
    width: addWidths(
      measure(texts.text, valueSize, VALUE_FONT_WEIGHT),
      measure(texts.suffix, suffixFontSize(valueSize), VALUE_FONT_WEIGHT)
    ),
    // A value with no text has no height, as an HTML element with no text.
    height: texts.text ? valueSize * STAT_LINE_HEIGHT : 0,
  };
  const { percentChange } = display.display;
  const percentMetrics = hasPercentChange(percentChange)
    ? measurePercentChange({
        percentChange,
        valueSize,
        percentSize: options.percentSize,
        // With the text mode None, the cell shows only the percent change, at a size that fits 80% of the cell.
        fittedSize:
          options.textMode === BigValueTextMode.None
            ? fitFontSize({
                text: formatPercentChange(percentChange),
                width: maxTextWidth * 0.8,
                height: maxTextHeight * 0.8,
                lineHeight: STAT_LINE_HEIGHT,
                fontFamily,
                fontWeight: VALUE_FONT_WEIGHT,
              })
            : undefined,
        isRow: isWide,
        measure,
      })
    : undefined;

  const items = [titleItem, valueItem, percentMetrics?.item].filter((item) => item !== undefined);
  const positions = layoutFlow({
    items,
    box: { x: cell.x + padding, y: cell.y + padding, width: maxTextWidth, height: maxTextHeight },
    direction: isWide ? 'row' : 'column',
    centered: isCentered,
    gap: isCentered ? getCenterGap(theme) : 0,
    atTop: hasChart && !isCentered,
  });
  const titlePosition = titleItem ? positions[0] : undefined;
  const valuePosition = positions[titleItem ? 1 : 0];
  const percentPosition = positions[titleItem ? 2 : 1];

  const valueColor = display.display.color ?? 'gray';
  const colors = getCellColors(cell, valueColor, options.colorMode, theme);
  const result: StatCell = { ...cell, display };
  if (colors.background) {
    result.background = colors.background;
  }
  if (getDisplayLinks(display).length > 0) {
    result.hasLinks = true;
  }

  if (texts.title && titleItem && titlePosition && titleSize > 0) {
    // A name that the layout measures as wider than its box is cut there. A name that fits is not cut, as in
    // core, which cuts no name. The measure scales from one font size, and ECharts measures at the draw size:
    // at a small size its result can be a little more, and it would then cut a name that fits.
    const maxWidth = isWide ? maxTextWidth * 0.6 : maxTextWidth;
    result.title = {
      text: texts.title,
      ...titlePosition,
      fontSize: titleSize,
      fontWeight: theme.typography.fontWeightRegular,
      color: colors.title,
      maxWidth,
    };
    if ((titleItem.width ?? 0) > maxWidth) {
      result.title.truncate = true;
    }
  }
  if (texts.text && valueSize > 0) {
    result.value = {
      text: texts.text,
      suffix: texts.suffix || undefined,
      suffixFontSize: suffixFontSize(valueSize),
      ...valuePosition,
      fontSize: valueSize,
      fontWeight: VALUE_FONT_WEIGHT,
      color: colors.value,
      maxWidth: maxTextWidth,
    };
  }
  if (hasPercentChange(percentChange) && percentMetrics) {
    const { textX, textY, icon } = placePercentChange(percentMetrics, percentPosition, isWide);
    result.percentChange = {
      text: {
        text: percentMetrics.text,
        x: textX,
        y: textY,
        align: 'left',
        fontSize: percentMetrics.fontSize,
        fontWeight: percentMetrics.fontWeight,
        // On a colored cell, the percent change has the color of the other texts.
        color: colors.background
          ? colors.title
          : getPercentChangeColor(percentChange, options.percentChangeColorMode, colors.value, theme),
        maxWidth: maxTextWidth,
      },
      icon,
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
  const cells = layoutRepeaterCells({
    width,
    height,
    count: values.length,
    spacing: STAT_CELL_SPACING,
    orientation: input.options.orientation,
  });
  const factors = getDisplayValueAlignmentFactors(values);
  return cells.map((cell, index) => layoutCell(cell, values[index], factors, input));
}
