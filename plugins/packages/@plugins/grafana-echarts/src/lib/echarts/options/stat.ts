// The ECharts option parts of the stat panel. This file reads the cells of `lib/grafana/stat/layout.ts`, which
// have all positions and colors, and gives one `custom` series that draws them.
// https://echarts.apache.org/en/option.html#series-custom
import { type CustomSeriesOption, type CustomSeriesRenderItemReturn } from 'echarts';
import {
  STAT_LINE_HEIGHT,
  type StatBackground,
  type StatCell,
  type StatSparkline,
  type StatText,
  type StatValueText,
} from 'lib/grafana/stat/layout';

/** One graphic element of a `custom` series group. */
type StatElement = Extract<NonNullable<CustomSeriesRenderItemReturn>, { type: 'group' }>['children'][number];

/**
 * The distance from the middle of a line of text down to its baseline, as a factor of the font size. ECharts
 * puts each part of a rich text at the bottom of the line, so a part with a smaller font is below the baseline
 * of the larger part by this factor of the difference of the sizes.
 */
const BASELINE_FACTOR = 0.25;

/** The characters that start or end a part of an ECharts rich text. A text with one of them is not a rich text. */
const RICH_TEXT_SYNTAX = /[{}|]/;

/**
 * The text style keys that the name and the value share.
 * https://echarts.apache.org/en/option.html#series-custom.renderItem.return_text.style
 */
const getTextStyle = (text: StatText, fontFamily: string) => ({
  x: text.x,
  y: text.y,
  align: text.align,
  verticalAlign: 'top' as const,
  fill: text.color,
  fontFamily,
  fontSize: text.fontSize,
  fontWeight: text.fontWeight,
  lineHeight: text.fontSize * STAT_LINE_HEIGHT,
});

/** The name of the value. A name that is wider than its box is cut, with an ellipsis. */
export function getStatTitleElement(title: StatText, fontFamily: string): StatElement {
  return {
    type: 'text',
    silent: true,
    style: { ...getTextStyle(title, fontFamily), text: title.text, width: title.maxWidth, overflow: 'truncate' },
  };
}

/**
 * The value text. A suffix is a second part of a rich text, with a smaller font and on the baseline of the value.
 * https://echarts.apache.org/en/option.html#series-custom.renderItem.return_text.style.rich
 */
export function getStatValueElement(value: StatValueText, fontFamily: string): StatElement {
  const style = getTextStyle(value, fontFamily);
  const { suffix } = value;
  if (!suffix || RICH_TEXT_SYNTAX.test(value.text) || RICH_TEXT_SYNTAX.test(suffix)) {
    return { type: 'text', silent: true, style: { ...style, text: `${value.text}${suffix ?? ''}` } };
  }
  const part = { fill: style.fill, fontFamily, fontWeight: style.fontWeight };
  return {
    type: 'text',
    silent: true,
    style: {
      x: style.x,
      y: style.y,
      align: style.align,
      verticalAlign: style.verticalAlign,
      text: `{value|${value.text}}{suffix|${suffix}}`,
      rich: {
        value: { ...part, fontSize: value.fontSize, lineHeight: style.lineHeight, verticalAlign: 'bottom' },
        suffix: {
          ...part,
          fontSize: value.suffixFontSize,
          lineHeight: value.suffixFontSize * STAT_LINE_HEIGHT,
          verticalAlign: 'bottom',
          padding: [0, 0, (value.fontSize - value.suffixFontSize) * BASELINE_FACTOR, 0],
        },
      },
    },
  };
}

/**
 * The sparkline: for each segment, the area from the line down to the baseline, and the line above it.
 * A segment of one point draws nothing, because a line needs two points.
 * https://echarts.apache.org/en/option.html#series-custom.renderItem.return_polyline
 */
export function getStatSparklineElements(sparkline: StatSparkline): StatElement[] {
  return sparkline.segments
    .filter((segment) => segment.length > 1)
    .flatMap((segment): StatElement[] => [
      {
        type: 'polygon',
        silent: true,
        shape: {
          points: [
            ...segment,
            [segment[segment.length - 1][0], sparkline.baseline],
            [segment[0][0], sparkline.baseline],
          ],
        },
        style: { fill: sparkline.fillColor },
      },
      {
        type: 'polyline',
        silent: true,
        shape: { points: segment },
        style: { stroke: sparkline.lineColor, lineWidth: 1, fill: 'none' },
      },
    ]);
}

/**
 * The fill of a cell in a background color mode: a rectangle of the size of the cell. Two colors make a linear
 * gradient. `global` gives the gradient line in pixels of the canvas, and not as a part of the rectangle.
 * https://echarts.apache.org/en/option.html#series-custom.renderItem.return_rect
 * https://echarts.apache.org/en/option.html#color
 */
export function getStatBackgroundElement(cell: StatCell, background: StatBackground): StatElement {
  const [from, to] = background.colors;
  return {
    type: 'rect',
    silent: true,
    shape: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
    style: {
      fill:
        to === undefined
          ? from
          : {
              type: 'linear',
              global: true,
              x: background.start[0],
              y: background.start[1],
              x2: background.end[0],
              y2: background.end[1],
              colorStops: [
                { offset: 0, color: from },
                { offset: 1, color: to },
              ],
            },
    },
  };
}

/** The elements of one cell, in paint order: the background, then the sparkline, then the text. */
export function getStatCellElements(cell: StatCell, fontFamily: string): StatElement[] {
  return [
    ...(cell.background ? [getStatBackgroundElement(cell, cell.background)] : []),
    ...(cell.sparkline ? getStatSparklineElements(cell.sparkline) : []),
    ...(cell.title ? [getStatTitleElement(cell.title, fontFamily)] : []),
    ...(cell.value ? [getStatValueElement(cell.value, fontFamily)] : []),
  ];
}

/** The cells of the panel for a chart size in pixels. */
export type StatCellLayout = (width: number, height: number) => StatCell[];

export interface StatSeriesInput {
  /** The number of values. Each value is one data item. */
  count: number;
  layout: StatCellLayout;
  fontFamily: string;
  zlevel?: number;
}

/**
 * The stat series: one data item for each value. The cells have pixel positions, so the series uses no
 * coordinate system. `zlevel` puts the series on its own canvas layer, as the other families do.
 *
 * `renderItem` asks for the layout with the size of the chart. ECharts calls it again after a resize, so the
 * cells follow the panel size, although the panel builds the option only when the data or the options change.
 * The layout is kept for one size, because ECharts calls `renderItem` one time for each data item.
 * https://echarts.apache.org/en/option.html#series-custom.coordinateSystem
 * https://echarts.apache.org/en/option.html#series-custom.renderItem
 */
export function getStatSeries({ count, layout, fontFamily, zlevel }: StatSeriesInput): CustomSeriesOption {
  let last: { width: number; height: number; cells: StatCell[] } | undefined;
  const cellsFor = (width: number, height: number) => {
    if (last?.width !== width || last.height !== height) {
      last = { width, height, cells: layout(width, height) };
    }
    return last.cells;
  };

  return {
    type: 'custom',
    coordinateSystem: 'none',
    zlevel,
    data: Array.from({ length: count }, (_, index) => index),
    renderItem: (params, api) => {
      const cell = cellsFor(api.getWidth(), api.getHeight())[params.dataIndex];
      return cell ? { type: 'group', children: getStatCellElements(cell, fontFamily) } : undefined;
    },
  };
}
