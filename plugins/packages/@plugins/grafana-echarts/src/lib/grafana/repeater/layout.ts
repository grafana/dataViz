// Splits a panel into one cell for each value. The gauge and the stat panels use it.
// It is the automatic grid of the `VizRepeater` component of `@grafana/ui`, as pixel arithmetic with no React.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/VizRepeater/VizRepeater.tsx

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

/**
 * The cells of `count` values in a panel of `width` x `height`, in row order. The cells of the last row are wider
 * when the row is not full, so the row fills the panel width. The result is empty when there is no value or no
 * space.
 */
export function layoutRepeaterCells(width: number, height: number, count: number, spacing: number): RepeaterCell[] {
  if (count <= 0 || width <= 0 || height <= 0) {
    return [];
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
