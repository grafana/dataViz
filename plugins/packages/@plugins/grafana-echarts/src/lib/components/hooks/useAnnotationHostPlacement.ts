import { type AnnotationHost } from 'lib/components/annotations/annotationHostContext';
import { pixelAtTime } from 'lib/echarts/annotationGestures';
import { type ChartContext } from 'lib/echarts/charts/types';
import { type EChartsType } from 'lib/echarts/echarts';
import { type RefObject, useEffect } from 'react';

/**
 * Keeps the form of an annotation host at the x of its start time. The effect runs for a new form time, a new
 * chart context and a new size. If the time is out of the time range of the chart, the form goes to the nearest
 * edge of the plot area. The y of the form does not change.
 *
 * Call it after `useChartOption` and `useChartResize`, so that the chart has its new layout when the effect runs.
 */
export function useAnnotationHostPlacement(
  chart: EChartsType | null,
  containerRef: RefObject<HTMLElement | null>,
  host: AnnotationHost | undefined,
  chartContext: ChartContext,
  size: { width: number; height: number }
): void {
  const time = host?.time ?? null;
  const place = host?.place;
  const { width, height } = size;

  useEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (chart == null || place == null || time == null || rect == null) {
      return;
    }
    const { from, to } = chartContext.timeRange;
    const x = pixelAtTime(chart, time, { from: from.valueOf(), to: to.valueOf() });
    if (x != null) {
      place(rect.left + x);
    }
    // `width` and `height` are not read: a new size gives the chart a new layout.
  }, [chart, containerRef, place, time, chartContext, width, height]);
}
