import { type EChartsType } from 'lib/echarts/echarts';

// The ECharts side of "add an annotation from the chart": which pointer events ask for one, and
// the time under the cursor. Grafana-free, so the standalone renderer can use it too (#280).
// Core reference: `TooltipPlugin2` (packages/grafana-ui/src/components/uPlot/plugins/TooltipPlugin2.tsx).

/**
 * A new annotation in epoch ms: a point when `from` equals `to`, else a region. Core keeps the
 * same range in `TimeSeriesPanel` (`newAnnotationRange`).
 */
export interface AnnotationDraft {
  from: number;
  to: number;
}

/** A draft from two times in any order. */
export function draftFromRange(start: number, end: number): AnnotationDraft {
  return { from: Math.min(start, end), to: Math.max(start, end) };
}

/** The modifier keys of a DOM mouse event. */
type ModifierKeys = Pick<MouseEvent, 'ctrlKey' | 'metaKey'>;

/**
 * Whether a pointer event asks for an annotation: ctrl or cmd is held, as core's
 * `maybeZoomAction` test. Such a click does not pin the tooltip, and such a drag does not zoom.
 */
export function isAnnotationGesture(event: ModifierKeys | null | undefined): boolean {
  return event != null && (event.ctrlKey || event.metaKey);
}

/**
 * The time (epoch ms) at a canvas pixel on the first x-axis, or `null` when the pixel is out of
 * the first grid or that axis is not a time axis.
 * https://echarts.apache.org/en/api.html#echartsInstance.containPixel
 * https://echarts.apache.org/en/api.html#echartsInstance.convertFromPixel
 */
export function timeAtPixel(chart: EChartsType, x: number, y: number): number | null {
  if (chart.isDisposed() || !chart.containPixel({ gridIndex: 0 }, [x, y])) {
    return null;
  }
  const time: unknown = chart.convertFromPixel({ xAxisIndex: 0 }, x);
  return typeof time === 'number' && Number.isFinite(time) ? time : null;
}

/**
 * The canvas x of a time (epoch ms) on the first x-axis. A time out of `range`, the range of that axis, gives the
 * nearest edge of the plot area. `null` when the chart has no such axis.
 * https://echarts.apache.org/en/api.html#echartsInstance.convertToPixel
 */
export function pixelAtTime(chart: EChartsType, time: number, range: { from: number; to: number }): number | null {
  if (chart.isDisposed()) {
    return null;
  }
  const x: unknown = chart.convertToPixel({ xAxisIndex: 0 }, Math.min(Math.max(time, range.from), range.to));
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}
