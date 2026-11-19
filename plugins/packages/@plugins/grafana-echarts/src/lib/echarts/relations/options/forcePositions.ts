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
  /** True while an animated layout moves the nodes. The positions are then not the final positions. */
  isLayouting?: boolean;
}

/**
 * The start friction of a layout with the same nodes, links and force settings. Each step then moves no node.
 * ECharts stops the layout when the friction decreases below 0.01, not when the nodes are stable, so a restart with
 * the normal friction moves the nodes again.
 * https://echarts.apache.org/en/option.html#series-graph.force.friction
 */
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

/**
 * Read the last force layout of the first series. This reads the series model, not `getOption`, because `getOption`
 * copies the full option of every chart type on each rebuild.
 */
export function readLiveForceLayout(chart: EChartsType): LiveForceLayout {
  const series = getGraphSeriesModel(chart);
  const option: unknown = series == null ? undefined : Reflect.get(series, 'option');
  if (typeof option !== 'object' || option === null) {
    return { positions: new Map() };
  }
  return {
    positions: readLiveForcePositions(chart),
    force: Reflect.get(option, 'force'),
    // https://echarts.apache.org/en/option.html#series-graph.edges
    links: toLinkKeys(Reflect.get(option, 'edges') ?? Reflect.get(option, 'links')),
    isLayouting: series != null && isForceLayoutRunning(chart, series),
  };
}

/**
 * Tell if the graph view still steps an animated layout (`force.layoutAnimation`). The view is not in the public
 * API, thus each step is checked at run time.
 * https://github.com/apache/echarts/blob/master/src/chart/graph/GraphView.ts
 */
function isForceLayoutRunning(chart: EChartsType, series: object): boolean {
  const getView: unknown = Reflect.get(chart, 'getViewOfSeriesModel');
  const view: unknown = typeof getView === 'function' ? getView.call(chart, series) : undefined;
  return typeof view === 'object' && view !== null && Reflect.get(view, '_layouting') === true;
}

/** The first series and its node ids when it is a force graph. */
function getForceGraph(option: EChartBuildOption) {
  const first = Array.isArray(option.series) ? option.series[0] : option.series;
  if (first == null || first.type !== 'graph' || first.layout !== 'force' || !Array.isArray(first.data)) {
    return undefined;
  }
  return { series: first, ids: first.data.map(toNodeId) };
}

/** The id that ECharts gives a node: its `id`, or its `name`. */
function toNodeId(item: unknown): string | undefined {
  if (typeof item !== 'object' || item === null || Array.isArray(item) || item instanceof Date) {
    return undefined;
  }
  const id: unknown = Reflect.get(item, 'id') ?? Reflect.get(item, 'name');
  return id == null ? undefined : String(id);
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
 * Prepare a new force graph option to start from the last layout, and tell if it can. If the nodes, the links and
 * the force settings did not change and the last layout stopped, the layout starts with no friction, so no node
 * moves. Otherwise the layout starts from the last positions with the normal friction, so it settles to the new
 * nodes, links or settings, or completes a layout that an animation did not complete.
 * A preview ignores the force settings, because its automatic settings change with the card size and a preview must
 * stay still.
 * The positions are not set as node `x` and `y`: ECharts then fits their extent to the plot, so a change of
 * repulsion, edge length or gravity does not change the drawn size.
 */
export function prepareForceStart(
  option: EChartBuildOption,
  { positions, force, links, isLayouting = false }: LiveForceLayout,
  { isPreview = false }: { isPreview?: boolean } = {}
): boolean {
  if (positions.size === 0) {
    return false;
  }
  const graph = getForceGraph(option);
  if (graph == null) {
    return false;
  }
  const { series, ids } = graph;
  // A removed node also changes the layout, so the positions must be the positions of these nodes only.
  const isSameNodes = ids.length === positions.size && ids.every((id) => id != null && positions.has(id));
  const isSameLayout = isSameLinks(toLinkKeys(series.links), links) && (isPreview || isSameForce(series.force, force));
  if (isSameNodes && isSameLayout && !isLayouting) {
    series.force = { ...series.force, friction: FROZEN_FRICTION };
  }
  return true;
}

/**
 * Give the last positions of the nodes of the new option to the new graph series model, then run the update that
 * `setOption` with `lazyUpdate` delayed. The force layout of that update starts from the positions. A node without
 * a position starts from a random one. The position of a removed node is not kept, so the positions do not
 * accumulate when the node ids change with each refresh. `resize` runs a delayed update at once.
 * https://echarts.apache.org/en/api.html#echartsInstance.setOption
 * https://echarts.apache.org/en/api.html#echartsInstance.resize
 */
export function restoreForcePositions(chart: EChartsType, option: EChartBuildOption, positions: ForcePositions): void {
  const series = getGraphSeriesModel(chart);
  if (series != null) {
    const ids = new Set(getForceGraph(option)?.ids);
    Reflect.set(
      series,
      'preservedPoints',
      Object.fromEntries([...positions].filter(([id]) => ids.has(id)).map(([id, point]) => [id, [point[0], point[1]]]))
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
