// Splits a panel into one cell for each value. The gauge and the stat panels use it.
// It is the `VizRepeater` component of `@grafana/ui` with its automatic grid, as pixel arithmetic with no React:
// the automatic grid, and the two orientations that put the cells in one column or in one row.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/VizRepeater/VizRepeater.tsx
import { VizOrientation } from '@grafana/data';

/** One cell of the grid, in pixels from the top left corner of the panel. */
export interface RepeaterCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The side of the largest square such that `count` squares fit the box.
 * https://math.stackexchange.com/questions/466198
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/utils/squares.ts
 */
function squareSide(boxWidth: number, boxHeight: number, count: number): number {
  const parts = Math.ceil(Math.sqrt((count * boxWidth) / boxHeight));
  if (Math.floor((parts * boxHeight) / boxWidth) * parts < count) {
    return boxHeight / Math.ceil((parts * boxHeight) / boxWidth);
  }
  return boxWidth / parts;
}

/** The number of columns and rows that give the cells nearest to a square. */
function gridCounts(width: number, height: number, count: number): { columns: number; rows: number } {
  const side = Math.max(squareSide(width, height, count), squareSide(height, width, count));
  const rows = Math.ceil(count / Math.floor(width / side));
  // The columns are counted again from the rows, so that the rows have almost the same number of cells.
  return { columns: Math.ceil(count / rows), rows };
}

/** The size of one of `count` equal parts of `total`, with `spacing` between the parts. */
const partSize = (total: number, count: number, spacing: number) => total / count - spacing + spacing / count;

export interface RepeaterLayoutInput {
  /** The width of the panel in pixels. */
  width: number;
  /** The height of the panel in pixels. */
  height: number;
  /** The number of values. */
  count: number;
  /** The space between two cells in pixels. */
  spacing: number;
  /**
   * How the cells are put in the panel. Unset or `auto` gives the automatic grid. `horizontal` gives one cell
   * for each row of the panel: the cells are as wide as the panel, one below the other. `vertical` gives one
   * cell for each column: the cells are as high as the panel, side by side.
   */
  orientation?: VizOrientation;
}

/**
 * The cells of `count` values in a panel of `width` x `height`, in row order. In the automatic grid, the cells of
 * the last row are wider when the row is not full, so the row fills the panel width. The result is empty when
 * there is no value or no space.
 */
export function layoutRepeaterCells(input: RepeaterLayoutInput): RepeaterCell[] {
  const { width, height, count, spacing, orientation } = input;
  if (count <= 0 || width <= 0 || height <= 0) {
    return [];
  }
  if (orientation === VizOrientation.Horizontal) {
    const cellHeight = partSize(height, count, spacing);
    return Array.from({ length: count }, (_, index) => ({
      x: 0,
      y: index * (cellHeight + spacing),
      width,
      height: cellHeight,
    }));
  }
  if (orientation === VizOrientation.Vertical) {
    const cellWidth = partSize(width, count, spacing);
    return Array.from({ length: count }, (_, index) => ({
      x: index * (cellWidth + spacing),
      y: 0,
      width: cellWidth,
      height,
    }));
  }
  const { columns, rows } = gridCounts(width, height, count);
  const cellHeight = partSize(height, rows, spacing);
  const lastRowCount = count - columns * (rows - 1);

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const cellWidth = partSize(width, row === rows - 1 ? lastRowCount : columns, spacing);
    return {
      x: column * (cellWidth + spacing),
      y: row * (cellHeight + spacing),
      width: cellWidth,
      height: cellHeight,
    };
  });
}
