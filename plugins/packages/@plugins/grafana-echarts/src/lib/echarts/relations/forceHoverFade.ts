import { type GraphSeriesOption } from 'echarts';
import { type EChartsType } from 'lib/echarts/echarts';

/**
 * Give a force graph with `force.layoutAnimation` its hover fade. ECharts turns off all animation for
 * that layout (`GraphSeriesModel.isAnimationEnabled`), so it ignores the `stateAnimation` that
 * `getRelationsHoverAnimation` sets. This sets the same transition on each mark directly:
 * `stateTransition` is the ZRender element property that ECharts sets from `stateAnimation`.
 * Run it after each `setOption`, because a render can add marks.
 * https://echarts.apache.org/en/option.html#series-graph.force.layoutAnimation
 * https://echarts.apache.org/en/option.html#series-graph.stateAnimation
 */
export function applyForceLayoutHoverFade(chart: EChartsType, option: object): void {
  const series: unknown = 'series' in option ? [option.series].flat()[0] : undefined;
  if (!isGraphSeries(series) || series.layout !== 'force' || series.force?.layoutAnimation !== true) {
    return;
  }
  const stateAnimation = series.stateAnimation;
  if (stateAnimation?.duration == null) {
    return;
  }
  const transition = { duration: stateAnimation.duration, easing: stateAnimation.easing };
  chart.getZr().storage.traverse((el) => {
    if (el.states?.emphasis == null) {
      return;
    }
    el.stateTransition = transition;
    const label = el.getTextContent();
    if (label != null) {
      label.stateTransition = transition;
    }
  });
}

function isGraphSeries(value: unknown): value is GraphSeriesOption {
  return typeof value === 'object' && value != null && 'type' in value && value.type === 'graph';
}
