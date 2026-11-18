import { VizOrientation } from '@grafana/data';
import { layoutRepeaterCells } from './layout';

const SPACING = 16;

const layout = (width: number, height: number, count: number) =>
  layoutRepeaterCells({ width, height, count, spacing: SPACING });

describe('layoutRepeaterCells with an orientation', () => {
  const oriented = (orientation: VizOrientation, count = 3) =>
    layoutRepeaterCells({ width: 400, height: 300, count, spacing: SPACING, orientation });

  it('gives the automatic grid for the orientation Auto, as for no orientation', () => {
    expect(oriented(VizOrientation.Auto, 4)).toEqual(layout(400, 300, 4));
  });

  it('Horizontal: cells as wide as the panel, one below the other, with the spacing between them', () => {
    // (300 - 2 * 16) / 3 = 89.33
    const cells = oriented(VizOrientation.Horizontal);
    expect(cells.map((cell) => cell.x)).toEqual([0, 0, 0]);
    expect(cells.map((cell) => cell.width)).toEqual([400, 400, 400]);
    expect(cells[0].height).toBeCloseTo(89.33, 1);
    expect(cells[1].y).toBeCloseTo(89.33 + 16, 1);
    expect(cells[2].y + cells[2].height).toBeCloseTo(300);
  });

  it('Vertical: cells as high as the panel, side by side, with the spacing between them', () => {
    // (400 - 2 * 16) / 3 = 122.67
    const cells = oriented(VizOrientation.Vertical);
    expect(cells.map((cell) => cell.y)).toEqual([0, 0, 0]);
    expect(cells.map((cell) => cell.height)).toEqual([300, 300, 300]);
    expect(cells[0].width).toBeCloseTo(122.67, 1);
    expect(cells[1].x).toBeCloseTo(122.67 + 16, 1);
    expect(cells[2].x + cells[2].width).toBeCloseTo(400);
  });

  it('gives one value the full panel in each orientation', () => {
    const full = [{ x: 0, y: 0, width: 400, height: 300 }];
    expect(oriented(VizOrientation.Horizontal, 1)).toEqual(full);
    expect(oriented(VizOrientation.Vertical, 1)).toEqual(full);
  });

  it('gives no cell for no value', () => {
    expect(oriented(VizOrientation.Horizontal, 0)).toEqual([]);
  });

  it('gives no cell when the spacing is larger than the share of one cell', () => {
    // 20 values have 19 spaces of 16 px, which are higher than 300 px. The same spaces are narrower than 400 px.
    expect(oriented(VizOrientation.Horizontal, 20)).toEqual([]);
    expect(oriented(VizOrientation.Vertical, 20)).toHaveLength(20);
    // 27 values have 26 spaces of 16 px, which are wider than 400 px.
    expect(oriented(VizOrientation.Vertical, 27)).toEqual([]);
  });

  it.each([VizOrientation.Horizontal, VizOrientation.Vertical])(
    '%s: keeps every cell inside the panel, with a size above zero',
    (orientation) => {
      for (const [width, height] of [
        [640, 360],
        [100, 100],
        [17, 23],
      ]) {
        for (const count of [1, 2, 5, 7, 12, 50]) {
          for (const cell of layoutRepeaterCells({ width, height, count, spacing: SPACING, orientation })) {
            expect(cell.x + cell.width).toBeLessThanOrEqual(width + 1e-9);
            expect(cell.y + cell.height).toBeLessThanOrEqual(height + 1e-9);
            expect(cell.width).toBeGreaterThan(0);
            expect(cell.height).toBeGreaterThan(0);
          }
        }
      }
    }
  );
});

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
