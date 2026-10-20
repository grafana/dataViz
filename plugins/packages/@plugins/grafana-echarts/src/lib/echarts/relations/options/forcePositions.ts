import { type EChartBuildOption } from 'lib/echarts/charts/types';
import { type EChartsType } from 'lib/echarts/echarts';

// This file has no runtime imports, so the shared Panel chunk can import it without the relations chunk.

/** Node positions of a force layout, by node id. */
export type ForcePositions = ReadonlyMap<string, [number, number]>;

/** The last force layout of a chart: node positions, and the force settings that made them. */
export interface LiveForceLayout {
  positions: ForcePositions;
  force?: unknown;
  /** The links of the live option, as `source>target` keys. */
  links?: ReadonlySet<string>;
}

/**
 * The start friction of a layout in which every node has a position. ECharts stops the layout when the friction
 * decreases below 0.01, not when the nodes are stable, so a full restart moves the nodes again.
 * https://echarts.apache.org/en/option.html#series-graph.force.friction
 */
const WARM_START_FRICTION = 0.012;

/** The start friction of a layout with the same nodes, links and force settings. Each step then moves no node. */
const FROZEN_FRICTION = 0;

/** The force settings that change the result of a layout. */
const FORCE_KEYS = ['repulsion', 'edgeLength', 'gravity'] as const;

const isPoint = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number' && Number.isFinite(v));

/**
 * The model of the first series when it is a graph.
 *
 * ECharts keeps the force positions by node id in `preservedPoints` on this model, and starts the next layout of the
 * same model from them. `setOption` with `notMerge` makes a new model without them. The model is not in the public
 * API, thus each step is checked at run time.
 * https://github.com/apache/echarts/blob/master/src/chart/graph/forceLayout.ts
 */
function getGraphSeriesModel(chart: EChartsType): object | undefined {
  const getModel: unknown = Reflect.get(chart, 'getModel');
  if (typeof getModel !== 'function' || chart.isDisposed()) {
    return undefined;
  }
  const model: unknown = getModel.call(chart);
  const getSeriesByIndex: unknown = model == null ? undefined : Reflect.get(model, 'getSeriesByIndex');
  if (typeof getSeriesByIndex !== 'function') {
    return undefined;
  }
  const series: unknown = getSeriesByIndex.call(model, 0);
  return typeof series === 'object' && series !== null && Reflect.get(series, 'subType') === 'graph'
    ? series
    : undefined;
}

/** Read the last force layout of the first series. */
export function readLiveForceLayout(chart: EChartsType): LiveForceLayout {
  const first = readLiveFirstSeries(chart);
  return {
    positions: readLiveForcePositions(chart),
    force: first == null ? undefined : Reflect.get(first, 'force'),
    links: first == null ? undefined : toLinkKeys(Reflect.get(first, 'links')),
  };
}

/** The first series of the live option. https://echarts.apache.org/en/api.html#echartsInstance.getOption */
function readLiveFirstSeries(chart: EChartsType): object | undefined {
  const series: unknown = chart.isDisposed() ? undefined : chart.getOption()?.series;
  const first: unknown = Array.isArray(series) ? series[0] : undefined;
  return typeof first === 'object' && first !== null ? first : undefined;
}

/** The `source>target` keys of graph links. https://echarts.apache.org/en/option.html#series-graph.links */
function toLinkKeys(links: unknown): Set<string> | undefined {
  if (!Array.isArray(links)) {
    return undefined;
  }
  const keys = new Set<string>();
  for (const link of links) {
    if (typeof link === 'object' && link !== null) {
      keys.add(`${String(Reflect.get(link, 'source'))}>${String(Reflect.get(link, 'target'))}`);
    }
  }
  return keys;
}

export function readLiveForcePositions(chart: EChartsType): ForcePositions {
  const positions = new Map<string, [number, number]>();
  const series = getGraphSeriesModel(chart);
  const points: unknown = series == null ? undefined : Reflect.get(series, 'preservedPoints');
  if (typeof points !== 'object' || points === null) {
    return positions;
  }
  for (const [id, point] of Object.entries(points)) {
    if (isPoint(point)) {
      positions.set(id, [point[0], point[1]]);
    }
  }
  return positions;
}

/**
 * Prepare a new force graph option to start from the last layout, and tell if it can. If every node has a position
 * and the force settings did not change, the layout starts with a low friction, so the nodes stay where they are. If
 * the links also did not change, the layout starts with no friction, so no node moves. A preview ignores the force
 * settings, because its automatic settings change with the card size and a preview must stay still.
 * The positions are not set as node `x` and `y`: ECharts then fits their extent to the plot, so a change of
 * repulsion, edge length or gravity does not change the drawn size.
 */
export function prepareForceStart(
  option: EChartBuildOption,
  { positions, force, links }: LiveForceLayout,
  { isPreview = false }: { isPreview?: boolean } = {}
): boolean {
  if (positions.size === 0) {
    return false;
  }
  const first = Array.isArray(option.series) ? option.series[0] : option.series;
  if (first == null || first.type !== 'graph' || first.layout !== 'force' || !Array.isArray(first.data)) {
    return false;
  }
  const everyNodePlaced = first.data.every((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item) || item instanceof Date) {
      return false;
    }
    const id = item.id ?? item.name;
    return id != null && positions.has(String(id));
  });
  if (everyNodePlaced && (isPreview || isSameForce(first.force, force))) {
    const friction = isSameLinks(toLinkKeys(first.links), links) ? FROZEN_FRICTION : WARM_START_FRICTION;
    first.force = { ...first.force, friction };
  }
  return true;
}

/**
 * Give the last positions to the new graph series model, then run the update that `setOption` with `lazyUpdate`
 * delayed. The force layout of that update starts from the positions. A node without a position starts from a
 * random one. `resize` runs a delayed update at once.
 * https://echarts.apache.org/en/api.html#echartsInstance.setOption
 * https://echarts.apache.org/en/api.html#echartsInstance.resize
 */
export function restoreForcePositions(chart: EChartsType, positions: ForcePositions): void {
  const series = getGraphSeriesModel(chart);
  if (series != null) {
    Reflect.set(
      series,
      'preservedPoints',
      Object.fromEntries([...positions].map(([id, point]) => [id, [point[0], point[1]]]))
    );
  }
  chart.resize({ width: chart.getWidth(), height: chart.getHeight() });
}

function isSameLinks(next: ReadonlySet<string> | undefined, previous: ReadonlySet<string> | undefined): boolean {
  return next != null && previous != null && next.size === previous.size && [...next].every((key) => previous.has(key));
}

function isSameForce(next: unknown, previous: unknown): boolean {
  if (typeof next !== 'object' || next === null || typeof previous !== 'object' || previous === null) {
    return false;
  }
  return FORCE_KEYS.every((key) => Reflect.get(next, key) === Reflect.get(previous, key));
}
