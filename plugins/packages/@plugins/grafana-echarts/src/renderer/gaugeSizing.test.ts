// The gauge layout at the sizes of the MCP Apps sandbox: the default height of the contract (`renderer.10`) and
// 480 px wide (`delivery.8`), with and with no toolbar and title above the chart.
import {
  GAUGE_CELL_SPACING,
  layoutGaugeGeometry,
  layoutGaugeText,
  resolveGaugeTextParts,
} from 'lib/grafana/gauge/layout';
import { layoutRepeaterCells } from 'lib/grafana/repeater/layout';
import { TITLE_HEIGHT_PX, TOOLBAR_HEIGHT_PX } from './layout';
import { DEFAULT_HEIGHT_PX } from './registry';

const FONT = 'Inter, Helvetica, Arial, sans-serif';
const NARROW_WIDTH_PX = 480;
/** The smallest sizes at which a gauge and its text are readable. */
const MIN_RADIUS_PX = 24;
const MIN_VALUE_FONT_PX = 12;
const MIN_NAME_FONT_PX = 10;

/** The gauges of `count` values in a chart of `width` x `height`, as `gaugeChartModule.buildOption` lays them out. */
function layout(width: number, height: number, count: number) {
  const cells = layoutRepeaterCells({ width, height, count, spacing: GAUGE_CELL_SPACING });
  return cells.map((cell) => {
    const geometry = layoutGaugeGeometry(cell.width, cell.height, 'gauge', 0.5, true);
    const parts = resolveGaugeTextParts('auto', count, false);
    const text = layoutGaugeText({
      geometry,
      shape: 'gauge',
      parts,
      valueText: '72.5%',
      nameText: 'memory',
      fontFamily: FONT,
    });
    return { cell, geometry, text };
  });
}

const heights = [
  ['the default height', DEFAULT_HEIGHT_PX],
  ['the default height with the toolbar and the title', DEFAULT_HEIGHT_PX - TOOLBAR_HEIGHT_PX - TITLE_HEIGHT_PX],
] as const;
// 1 value, the 3 values of `gauge-thresholds`, and 10 values: the most that the pick rule `single-value` allows.
const cases = heights.flatMap(([name, height]) => [1, 3, 10].map((count) => [count, name, height] as const));

describe('the gauge layout in the sandbox', () => {
  it.each(cases)('keeps %d gauges inside their cells and readable at 480 px wide and %s', (count, _name, height) => {
    const gauges = layout(NARROW_WIDTH_PX, height, count);
    expect(gauges).toHaveLength(count);
    for (const { cell, geometry, text } of gauges) {
      const outer = Math.max(geometry.outerRadius, geometry.bandOuterRadius);
      expect(outer).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
      expect(geometry.centerX - outer).toBeGreaterThanOrEqual(-0.001);
      expect(geometry.centerX + outer).toBeLessThanOrEqual(cell.width + 0.001);
      expect(geometry.centerY - outer).toBeGreaterThanOrEqual(-0.001);
      expect(geometry.centerY).toBeLessThanOrEqual(cell.height);
      expect(text.value?.fontSize).toBeGreaterThanOrEqual(MIN_VALUE_FONT_PX);
      if (text.name) {
        expect(text.name.fontSize).toBeGreaterThanOrEqual(MIN_NAME_FONT_PX);
      }
    }
  });

  it('keeps the cells inside the chart', () => {
    for (const [, , height] of cases) {
      for (const { cell } of layout(NARROW_WIDTH_PX, height, 10)) {
        expect(cell.x + cell.width).toBeLessThanOrEqual(NARROW_WIDTH_PX + 0.001);
        expect(cell.y + cell.height).toBeLessThanOrEqual(height + 0.001);
      }
    }
  });
});
