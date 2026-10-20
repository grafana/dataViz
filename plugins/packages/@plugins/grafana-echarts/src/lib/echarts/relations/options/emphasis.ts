import { type GraphSeriesOption } from 'echarts';
import {
  RELATIONS_EDGE_ARROWS_DEFAULT,
  RELATIONS_FOCUS_ADJACENCY_DEFAULT,
  RELATIONS_SHOW_NODE_LABELS_DEFAULT,
} from 'editor/relations/constants';
import { resolveAnimation } from 'lib/echarts/performance/resolvers';
import { type RelationsSeriesContext } from 'lib/echarts/relations/context';
import { getVisibleGraphLabel } from 'lib/echarts/relations/options/labels';
import { type PanelOptions } from 'types';

/**
 * Arrowhead at the target end, making edge direction readable.
 * https://echarts.apache.org/en/option.html#series-graph.edgeSymbol
 */
export function getGraphEdgeSymbol(options: PanelOptions): GraphSeriesOption['edgeSymbol'] | undefined {
  return (options.relationsEdgeArrows ?? RELATIONS_EDGE_ARROWS_DEFAULT) === true ? ['none', 'arrow'] : undefined;
}

/** Check whether hover fades unrelated marks. */
export function resolveRelationsFocusAdjacency(options: PanelOptions): boolean {
  return (options.relationsFocusAdjacency ?? RELATIONS_FOCUS_ADJACENCY_DEFAULT) === true;
}

/** Duration of the adjacency fade on hover, in ms. */
export const RELATIONS_HOVER_FADE_MS = 150;

type RelationsHoverAnimation = Pick<
  GraphSeriesOption,
  'animation' | 'animationDuration' | 'animationDurationUpdate' | 'animationThreshold' | 'stateAnimation'
>;

/**
 * Fade the adjacency focus on hover, for graph, sankey and chord. Without a fade, a dense chart
 * flickers: the cursor crosses many thin marks and gaps, and each crossing turns the fade on or off
 * in one frame.
 *
 * ECharts applies `stateAnimation` only when the series animation is on, so with the panel
 * animation off, this turns it on with near-zero durations. A zero duration sets the values without
 * an animator, so the update and roam costs do not change. Sankey sets `firstDrawMs` to 1: with an
 * animated first draw the sankey view adds a clip that its own animation removes, and at 0 ms the
 * remove runs before the clip is set, so the clip stays and cuts off a later, larger layout. The
 * threshold is removed, because ECharts turns off animation, and the fade with it, above 2000 items.
 * A force graph with `force.layoutAnimation` gets no fade, because ECharts turns off its animation.
 * https://echarts.apache.org/en/option.html#series-graph.stateAnimation
 * https://echarts.apache.org/en/option.html#series-graph.animationThreshold
 */
export function getRelationsHoverAnimation(
  options: PanelOptions,
  firstDrawMs = 0
): RelationsHoverAnimation | undefined {
  if (!resolveRelationsFocusAdjacency(options)) {
    return undefined;
  }
  const stateAnimation = { duration: RELATIONS_HOVER_FADE_MS, easing: 'cubicOut' } as const;
  if (resolveAnimation(options)) {
    return { stateAnimation };
  }
  return {
    animation: true,
    animationDuration: firstDrawMs,
    animationDurationUpdate: 0,
    animationThreshold: Number.POSITIVE_INFINITY,
    stateAnimation,
  };
}

/**
 * Hover emphasis.
 * https://echarts.apache.org/en/option.html#series-graph.emphasis
 */
export function getGraphEmphasis(ctx: RelationsSeriesContext): GraphSeriesOption['emphasis'] | undefined {
  const focus = resolveRelationsFocusAdjacency(ctx.options);
  const labelsHidden = (ctx.options.relationsShowNodeLabels ?? RELATIONS_SHOW_NODE_LABELS_DEFAULT) === false;
  if (!focus && !labelsHidden) {
    return undefined;
  }
  return {
    ...(focus ? { focus: 'adjacency' } : {}),
    // ECharts otherwise reveals a centered label with its default text color.
    ...(labelsHidden ? { label: getVisibleGraphLabel(ctx) } : {}),
  };
}
