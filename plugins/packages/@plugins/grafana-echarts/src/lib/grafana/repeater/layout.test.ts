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

  it('keeps every cell inside the panel', () => {
    for (const count of [2, 5, 7, 12, 50]) {
      for (const cell of layout(640, 360, count)) {
        expect(cell.x + cell.width).toBeLessThanOrEqual(640 + 1e-9);
        expect(cell.y + cell.height).toBeLessThanOrEqual(360 + 1e-9);
        expect(cell.width).toBeGreaterThan(0);
        expect(cell.height).toBeGreaterThan(0);
      }
    }
  });

  it.each([
    ['no value', 400, 300, 0],
    ['no width', 0, 300, 3],
    ['no height', 400, 0, 3],
  ])('gives no cell for %s', (_, width, height, count) => {
    expect(layout(width, height, count)).toEqual([]);
  });
});
