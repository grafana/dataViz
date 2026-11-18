import { layoutRepeaterCells } from './layout';

const SPACING = 16;

const layout = (width: number, height: number, count: number) =>
  layoutRepeaterCells({ width, height, count, spacing: SPACING });

describe('layoutRepeaterCells', () => {
  it('gives one value the full panel', () => {
    expect(layout(400, 300, 1)).toEqual([{ x: 0, y: 0, width: 400, height: 300 }]);
  });

  it('puts four values in a 2 x 2 grid with the spacing between the cells', () => {
    expect(layout(400, 300, 4)).toEqual([
      { x: 0, y: 0, width: 192, height: 142 },
      { x: 208, y: 0, width: 192, height: 142 },
      { x: 0, y: 158, width: 192, height: 142 },
      { x: 208, y: 158, width: 192, height: 142 },
    ]);
  });

  it('makes the cell of a last row that is not full as wide as the panel', () => {
    const cells = layout(400, 300, 3);
    expect(cells).toHaveLength(3);
    expect(cells[2]).toEqual({ x: 0, y: 158, width: 400, height: 142 });
  });

  it('puts the values side by side in a wide panel', () => {
    const cells = layout(1200, 200, 4);
    expect(new Set(cells.map((cell) => cell.y))).toEqual(new Set([0]));
    expect(cells.map((cell) => cell.x)).toEqual([0, 304, 608, 912]);
  });

  it('puts the values one below the other in a tall panel', () => {
    const cells = layout(200, 1200, 4);
    expect(new Set(cells.map((cell) => cell.x))).toEqual(new Set([0]));
    expect(cells.every((cell) => cell.width === 200)).toBe(true);
  });

  it('keeps every cell inside the panel, with a size above zero', () => {
    // The small panels have no space for all counts. For those, the result is empty.
    const panels = [
      [640, 360],
      [100, 100],
      [300, 40],
      [40, 300],
      [17, 23],
    ];
    for (const [width, height] of panels) {
      for (const count of [1, 2, 5, 7, 12, 50, 200]) {
        for (const cell of layout(width, height, count)) {
          expect(cell.x + cell.width).toBeLessThanOrEqual(width + 1e-9);
          expect(cell.y + cell.height).toBeLessThanOrEqual(height + 1e-9);
          expect(cell.width).toBeGreaterThan(0);
          expect(cell.height).toBeGreaterThan(0);
        }
      }
    }
  });

  it('gives no cell when the spacing is larger than the share of one cell', () => {
    // 50 values in 100 x 100 give 8 columns. The 7 spaces of 16 px are wider than the panel.
    expect(layout(100, 100, 50)).toEqual([]);
    // 4 values give 2 x 2, with cells of 42 x 42.
    expect(layout(100, 100, 4)).toHaveLength(4);
  });

  it.each([
    ['no value', 400, 300, 0],
    ['no width', 0, 300, 3],
    ['no height', 400, 0, 3],
    ['a width that is not a number', NaN, 300, 3],
    ['a height that is not a number', 400, NaN, 3],
  ])('gives no cell for %s', (_, width, height, count) => {
    expect(layout(width, height, count)).toEqual([]);
  });
});
