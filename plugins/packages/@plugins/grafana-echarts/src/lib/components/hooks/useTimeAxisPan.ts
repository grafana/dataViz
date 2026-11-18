import { type AbsoluteTimeRange } from '@grafana/data';
import { type EChartsType } from 'lib/echarts/echarts';
import { isOnXAxisLabels, MIN_PAN_DISTANCE, msPerPixel, panTimeRange } from 'lib/echarts/timePan';
import { useEffect, useRef } from 'react';

/**
 * Pan with a drag of the x-axis labels, as core time panels (viz contract 26.1).
 * If `preview` is true, the x axis shows the moved range during the drag.
 * On release, a drag of `MIN_PAN_DISTANCE` px or more gives the new range to `onChangeTimeRange`.
 * A shorter drag restores the original axis. The brush zoom stays in the plot area.
 *
 * `range` is the range that the x axis shows. The handlers read the latest `range` and `onChangeTimeRange`
 * through refs, so a new prop does not bind the listeners again.
 * https://echarts.apache.org/en/api.html#echartsInstance.getZr
 */
export function useTimeAxisPan(
  chart: EChartsType | null,
  range: AbsoluteTimeRange,
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void,
  preview = true
): void {
  const latest = useRef({ range, onChangeTimeRange });
  useEffect(() => {
    latest.current = { range, onChangeTimeRange };
  }, [range, onChangeTimeRange]);

  useEffect(() => {
    if (!chart) {
      return;
    }
    const zr = chart.getZr();
    let endDrag: (() => void) | undefined;

    // Moves the x axis only. `setOption` merges, so the series and the other axes do not change.
    // https://echarts.apache.org/en/option.html#xAxis.min
    const showRange = ({ from, to }: AbsoluteTimeRange) => chart.setOption({ xAxis: [{ min: from, max: to }] });

    const onHover = (event: { offsetX: number; offsetY: number }) => {
      if (endDrag === undefined && isOnXAxisLabels(chart, event.offsetX, event.offsetY)) {
        zr.setCursorStyle('grab');
      }
    };

    const onDown = (event: { offsetX: number; offsetY: number; event?: Event }) => {
      if (endDrag !== undefined || !isOnXAxisLabels(chart, event.offsetX, event.offsetY)) {
        return;
      }
      const perPixel = msPerPixel(chart, event.offsetX);
      if (perPixel === null) {
        return;
      }
      // No text selection during the drag, as core.
      if (event.event instanceof Event) {
        event.event.preventDefault();
      }
      const start = latest.current.range;
      // The drag goes on outside the chart, as core, so the listeners are on the document and use `clientX`.
      const downClientX = event.event instanceof MouseEvent ? event.event.clientX : event.offsetX;
      zr.setCursorStyle('grabbing');

      const onMove = (e: MouseEvent) => {
        showRange(panTimeRange(start, e.clientX - downClientX, perPixel));
      };
      const onUp = (e: MouseEvent) => {
        const dragPixels = e.clientX - downClientX;
        endDrag?.();
        if (!preview && latest.current.range !== start) {
          return;
        }
        if (Math.abs(dragPixels) >= MIN_PAN_DISTANCE) {
          latest.current.onChangeTimeRange(panTimeRange(start, dragPixels, perPixel));
        } else if (preview) {
          showRange(start);
        }
      };
      if (preview) {
        document.addEventListener('mousemove', onMove);
      }
      document.addEventListener('mouseup', onUp);
      endDrag = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        endDrag = undefined;
        if (!chart.isDisposed()) {
          zr.setCursorStyle('grab');
        }
      };
    };

    zr.on('mousemove', onHover);
    zr.on('mousedown', onDown);
    return () => {
      endDrag?.();
      // A disposed chart has no listeners (see `useBrushTimeZoom`).
      if (!chart.isDisposed()) {
        zr.off('mousemove', onHover);
        zr.off('mousedown', onDown);
      }
    };
  }, [chart, preview]);
}
