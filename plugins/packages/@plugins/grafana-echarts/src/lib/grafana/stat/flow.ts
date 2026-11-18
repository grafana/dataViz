// The positions of the texts of a stat cell. This file has no ECharts code.
//
// Core Stat gives the name, the value and the percent change to a CSS flexbox: a column in a stacked cell, and
// a row that wraps in a wide cell. A canvas has no flexbox, so this file does the arithmetic of the flexbox
// rules that `BigValueLayout` sets.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/BigValue/BigValueLayout.tsx
// https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox

/** How `x` of a position relates to the item: its left edge, its center or its right edge. */
export type FlowAlign = 'left' | 'center' | 'right';

export interface FlowItem {
  /** The width in pixels. `undefined` when the host cannot measure text. */
  width: number | undefined;
  height: number;
  /** A space above the item in a column. A negative space moves the item up. */
  marginTop?: number;
}

export interface FlowPosition {
  x: number;
  align: FlowAlign;
  /** The top of the item. */
  y: number;
}

export interface FlowInput {
  items: FlowItem[];
  /** The content box of the cell. */
  box: { x: number; y: number; width: number; height: number };
  /** `column` puts each item below the last one. `row` puts the items side by side, and wraps. */
  direction: 'row' | 'column';
  /** The items are at the center of the box in the two directions, with `gap` between them. */
  centered: boolean;
  /** The space in pixels between two items, and between two lines. It is used only when `centered`. */
  gap: number;
  /**
   * The items start at the top of the box, and are not at its vertical center. A cell with a sparkline that is
   * not `centered` does this. In a row, the lines then share the free height of the box.
   */
  atTop: boolean;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** The items in a column: at the left edge or at the horizontal center of the box. */
function layoutColumn({ items, box, centered, gap, atTop }: FlowInput): FlowPosition[] {
  const x = centered ? box.x + box.width / 2 : box.x;
  const align: FlowAlign = centered ? 'center' : 'left';
  const spacing = centered ? gap : 0;
  const total = sum(items.map((item) => item.height + (item.marginTop ?? 0))) + spacing * (items.length - 1);
  let y = atTop ? box.y : box.y + (box.height - total) / 2;
  return items.map((item) => {
    y += item.marginTop ?? 0;
    const position = { x, align, y };
    y += item.height + spacing;
    return position;
  });
}

/** The items of a row in lines: an item that has no space in a line starts a new line. */
function wrapLines(widths: number[], maxWidth: number, gap: number): number[][] {
  const lines: number[][] = [];
  let lineWidth = 0;
  widths.forEach((width, index) => {
    const line = lines[lines.length - 1];
    if (line && lineWidth + gap + width <= maxWidth) {
      line.push(index);
      lineWidth += gap + width;
    } else {
      lines.push([index]);
      lineWidth = width;
    }
  });
  return lines;
}

/**
 * The horizontal positions of the items of one line. A line of one item has the item at the center (`centered`)
 * or at the left. A `centered` line of more items is one group at the center. A line that is not `centered`
 * has its first item at the left edge, its last item at the right edge, and equal spaces between the items.
 */
function layoutLine(
  widths: number[],
  box: FlowInput['box'],
  centered: boolean,
  gap: number
): Array<Pick<FlowPosition, 'x' | 'align'>> {
  if (widths.length === 1) {
    return [centered ? { x: box.x + box.width / 2, align: 'center' } : { x: box.x, align: 'left' }];
  }
  const free = box.width - sum(widths);
  if (centered) {
    let x = box.x + (free - gap * (widths.length - 1)) / 2;
    return widths.map((width) => {
      const position = { x, align: 'left' as const };
      x += width + gap;
      return position;
    });
  }
  const last = widths.length - 1;
  const spacing = free / last;
  let left = box.x;
  return widths.map((width, index) => {
    const start = left;
    left += width + spacing;
    if (index === 0) {
      return { x: box.x, align: 'left' };
    }
    return index === last ? { x: box.x + box.width, align: 'right' } : { x: start + width / 2, align: 'center' };
  });
}

/** The items in a row that wraps. */
function layoutRow(input: FlowInput, widths: number[]): FlowPosition[] {
  const { items, box, centered, atTop } = input;
  const gap = centered ? input.gap : 0;
  const lines = wrapLines(widths, box.width, gap);
  const lineHeights = lines.map((line) => Math.max(...line.map((index) => items[index].height)));
  const total = sum(lineHeights) + gap * (lines.length - 1);
  // At the top, the lines share the free height of the box, and each item is at the top of its line.
  const extra = atTop ? Math.max(0, box.height - total) / lines.length : 0;
  let lineTop = atTop ? box.y : box.y + (box.height - total) / 2;

  const positions: FlowPosition[] = [];
  lines.forEach((line, lineIndex) => {
    const lineHeight = lineHeights[lineIndex];
    const xs = layoutLine(
      line.map((index) => widths[index]),
      box,
      centered,
      gap
    );
    line.forEach((index, column) => {
      const y = atTop ? lineTop : lineTop + (lineHeight - items[index].height) / 2;
      positions[index] = { ...xs[column], y };
    });
    lineTop += lineHeight + gap + extra;
  });
  return positions;
}

/**
 * The position of each item, in the order of the items. When the host cannot measure text, a row has no widths:
 * a `centered` row is then a column, and a row that is not `centered` does not wrap.
 */
export function layoutFlow(input: FlowInput): FlowPosition[] {
  if (input.direction === 'column') {
    return layoutColumn(input);
  }
  const widths = input.items.map((item) => item.width);
  if (widths.every((width): width is number => width !== undefined)) {
    return layoutRow(input, widths);
  }
  return input.centered
    ? layoutColumn(input)
    : layoutRow(
        input,
        widths.map(() => 0)
      );
}
