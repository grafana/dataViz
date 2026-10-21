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
  draggable = false,
  extraLinks: GraphSeriesOption['links'] = []
): {
  series: GraphSeriesOption[];
} {
  return {
    series: [
      {
        type: 'graph',
        layout: 'force',
        animation: false,
        draggable,
        force: { initLayout: 'none', layoutAnimation: false, repulsion, edgeLength: 60, gravity: 0.2, friction: 0.2 },
        data: NODE_IDS.map((id) => ({ id, name: id })),
        links: [...NODE_IDS.slice(1).map((target) => ({ source: 'a', target })), ...extraLinks],
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

interface ForceInstance {
  warmUp(): void;
  setFixed(index: number): void;
  step(callback: (stopped: boolean) => void): void;
}

/**
 * Drag the first node 100 pixels to the right, then return how far the second node moved in pixels. This makes the
 * calls of the drag handler of the ECharts graph view, because a ZRender pointer drag does not move a node in jsdom.
 * The force instance is not in the public API.
 * https://github.com/apache/echarts/blob/master/src/chart/graph/GraphView.ts
 */
function dragFirstNode(chart: EChartsType): number {
  const series = Reflect.get(chart, 'getModel').call(chart).getSeriesByIndex(0);
  const force: ForceInstance = series.forceLayout;
  const data = series.getData();
  const [x, y]: number[] = data.getItemLayout(0);
  const before = drawnPositions(chart).get(NODE_IDS[1]) ?? [NaN, NaN];
  force.warmUp();
  force.setFixed(0);
  data.setItemLayout(0, [x + 100, y]);
  let stopped = false;
  for (let step = 0; step < 1000 && !stopped; step++) {
    force.step((done) => {
      stopped = done;
    });
  }
  const after = drawnPositions(chart).get(NODE_IDS[1]) ?? [NaN, NaN];
  return Math.hypot(after[0] - before[0], after[1] - before[1]);
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

  it('moves the linked nodes on a drag after a rebuild with the same option', () => {
    const fresh = createChart();
    rebuild(fresh, forceOption(200, true));
    const freshMove = dragFirstNode(fresh);

    const chart = createChart();
    rebuild(chart, forceOption(200, true));
    rebuild(chart, forceOption(200, true));
    const keptMove = dragFirstNode(chart);

    expect(freshMove).toBeGreaterThan(5);
    expect(keptMove).toBeGreaterThan(5);
    fresh.dispose();
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

    rebuild(chart, forceOption(200, false, [{ source: from, target: to }]));

    expect(drawnDistance(chart, from, to)).toBeLessThan(apart * 0.8);
    chart.dispose();
  });
});
