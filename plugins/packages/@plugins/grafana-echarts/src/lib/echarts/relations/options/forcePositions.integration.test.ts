import { type GraphSeriesOption } from 'echarts';
import { type EChartsType, init } from 'lib/echarts/echarts';
import {
  prepareForceStart,
  readLiveForceLayout,
  readLiveForcePositions,
  restoreForcePositions,
} from './forcePositions';

const NODE_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

function forceOption(
  repulsion = 200,
  extraLinks: GraphSeriesOption['links'] = [],
  layoutAnimation = false,
  ids = NODE_IDS
): {
  series: GraphSeriesOption[];
} {
  return {
    series: [
      {
        type: 'graph',
        layout: 'force',
        animation: false,
        force: { initLayout: 'none', layoutAnimation, repulsion, edgeLength: 60, gravity: 0.2, friction: 0.2 },
        data: ids.map((id) => ({ id, name: id })),
        links: [...ids.slice(1).map((target) => ({ source: ids[0], target })), ...extraLinks],
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
    restoreForcePositions(chart, option, live.positions);
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

/** The distance in pixels between two drawn nodes. */
function drawnDistance(chart: EChartsType, from: string, to: string): number {
  const drawn = drawnPositions(chart);
  const [x0, y0] = drawn.get(from) ?? [NaN, NaN];
  const [x1, y1] = drawn.get(to) ?? [NaN, NaN];
  return Math.hypot(x1 - x0, y1 - y0);
}

/** The mean distance in pixels of the drawn nodes from their center. */
function drawnSpread(chart: EChartsType): number {
  const points = [...drawnPositions(chart).values()];
  const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return points.reduce((sum, p) => sum + Math.hypot(p[0] - cx, p[1] - cy), 0) / points.length;
}

/** The sum of the distances in pixels that the nodes moved. */
function totalMove(before: Map<string, number[]>, after: Map<string, number[]>): number {
  let sum = 0;
  for (const [id, [x0, y0]] of before) {
    const [x1, y1] = after.get(id) ?? [NaN, NaN];
    sum += Math.hypot(x1 - x0, y1 - y0);
  }
  return sum;
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
      expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(0.5);
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

  it('completes an animated layout after a rebuild during the animation', () => {
    jest.useFakeTimers();
    try {
      const chart = createChart();
      rebuild(chart, forceOption(200, [], true));
      // The animation makes one step each 16 ms, so the layout is at its start.
      jest.advanceTimersByTime(100);
      const early = drawnPositions(chart);

      rebuild(chart, forceOption(200, [], true));
      jest.advanceTimersByTime(20000);

      expect(totalMove(early, drawnPositions(chart))).toBeGreaterThan(10);
      // The layout stopped, so the subsequent rebuild moves no node.
      const settled = drawnPositions(chart);
      rebuild(chart, forceOption(200, [], true));
      jest.advanceTimersByTime(20000);
      expect(totalMove(settled, drawnPositions(chart))).toBeLessThan(0.5);
      chart.dispose();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not keep the position of a removed node', () => {
    const chart = createChart();
    for (let round = 0; round < 5; round++) {
      const ids = ['a', ...NODE_IDS.slice(1).map((id) => `${id}-${round}`)];
      rebuild(chart, forceOption(200, [], false, ids));
      expect([...readLiveForcePositions(chart).keys()].sort()).toEqual([...ids].sort());
    }
    chart.dispose();
  });

  it('pulls two nodes together after a rebuild adds a link between them', () => {
    const chart = createChart();
    rebuild(chart, forceOption());
    // The start positions are random, so link the two leaves that are farthest apart.
    const leaves = NODE_IDS.slice(1);
    const [from, to] = leaves
      .flatMap((a, i) => leaves.slice(i + 1).map((b): [string, string] => [a, b]))
      .reduce((far, pair) => (drawnDistance(chart, ...pair) > drawnDistance(chart, ...far) ? pair : far));
    const apart = drawnDistance(chart, from, to);

    rebuild(chart, forceOption(200, [{ source: from, target: to }]));

    expect(drawnDistance(chart, from, to)).toBeLessThan(apart * 0.8);
    chart.dispose();
  });
});
