import { type GraphSeriesOption } from 'echarts';
import { type EChartsType, init } from 'lib/echarts/echarts';
import {
  prepareForceStart,
  readLiveForceLayout,
  readLiveForcePositions,
  restoreForcePositions,
} from './forcePositions';

const NODE_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

function forceOption(repulsion = 200): { series: GraphSeriesOption[] } {
  return {
    series: [
      {
        type: 'graph',
        layout: 'force',
        animation: false,
        force: { initLayout: 'none', layoutAnimation: false, repulsion, edgeLength: 60, gravity: 0.2, friction: 0.2 },
        data: NODE_IDS.map((id) => ({ id, name: id })),
        links: NODE_IDS.slice(1).map((target) => ({ source: 'a', target })),
      },
    ],
  };
}

function createChart() {
  return init(document.createElement('div'), null, { width: 400, height: 300 });
}

/** The rebuild of `useChartOption`. */
function rebuild(chart: EChartsType, option: { series: GraphSeriesOption[] }) {
  const live = readLiveForceLayout(chart);
  const keep = prepareForceStart(option, live);
  chart.setOption(option, keep ? { notMerge: true, lazyUpdate: true } : { notMerge: true });
  if (keep) {
    restoreForcePositions(chart, live.positions);
  }
}

/** The drawn node positions in pixels. https://echarts.apache.org/en/api.html#echartsInstance.convertToPixel */
function drawnPositions(chart: EChartsType): Map<string, number[]> {
  const drawn = new Map<string, number[]>();
  for (const [id, point] of readLiveForcePositions(chart)) {
    drawn.set(id, chart.convertToPixel({ seriesIndex: 0 }, point));
  }
  return drawn;
}

/** The mean distance in pixels of the drawn nodes from their center. */
function drawnSpread(chart: EChartsType): number {
  const points = [...drawnPositions(chart).values()];
  const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return points.reduce((sum, p) => sum + Math.hypot(p[0] - cx, p[1] - cy), 0) / points.length;
}

describe('force layout across a notMerge rebuild', () => {
  it('draws each node in the same place after a rebuild with the same option', () => {
    const chart = createChart();
    rebuild(chart, forceOption());
    const before = drawnPositions(chart);

    rebuild(chart, forceOption());
    const after = drawnPositions(chart);

    expect([...after.keys()].sort()).toEqual(NODE_IDS);
    for (const id of NODE_IDS) {
      const [x0, y0] = before.get(id) ?? [NaN, NaN];
      const [x1, y1] = after.get(id) ?? [NaN, NaN];
      expect(Math.hypot(x1 - x0, y1 - y0)).toBe(0);
    }
    chart.dispose();
  });

  it('draws a kept layout as large as a new layout after a repulsion change', () => {
    const fresh = createChart();
    rebuild(fresh, forceOption(900));
    const freshSpread = drawnSpread(fresh);

    const chart = createChart();
    rebuild(chart, forceOption(50));
    const lowSpread = drawnSpread(chart);
    rebuild(chart, forceOption(900));
    const keptSpread = drawnSpread(chart);

    expect(freshSpread).toBeGreaterThan(lowSpread * 1.5);
    expect(Math.abs(keptSpread - freshSpread)).toBeLessThan(freshSpread * 0.1);
    fresh.dispose();
    chart.dispose();
  });
});
