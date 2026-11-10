import { type EChartsType } from 'lib/echarts/echarts';
import { type AnnotationDraft, draftFromRange, isAnnotationGesture, timeAtPixel } from 'lib/echarts/annotationGestures';
import { type BrushEndEvent, brushEndToTimeRange } from 'lib/echarts/timeBrush';
import { type RefObject, useEffect, useRef } from 'react';

/** A draft and the window position where its editor opens. */
export interface PlacedAnnotationDraft extends AnnotationDraft {
  position: { x: number; y: number };
}

/** The part of a ZRender pointer event that this hook reads. `event` is the DOM event. */
interface ZrPointerEvent {
  offsetX: number;
  offsetY: number;
  event?: { ctrlKey?: boolean; metaKey?: boolean };
}

const hasModifier = (event: ZrPointerEvent): boolean =>
  isAnnotationGesture({ ctrlKey: event.event?.ctrlKey === true, metaKey: event.event?.metaKey === true });

/**
 * Ctrl/cmd + click adds a point annotation and ctrl/cmd + drag adds a region, as core
 * `TooltipPlugin2` does. The drag is the time brush of the chart: `useBrushTimeZoom` reads the
 * returned ref and does not zoom on it. The ref is set on every press, also when `onDraft` is
 * `null`, because core never zooms on a ctrl/cmd drag.
 *
 * `onDraft` is `null` when the user cannot add annotations (`PanelContext.canAddAnnotations`)
 * or the chart has no time axis.
 * https://echarts.apache.org/en/api.html#events.brushEnd
 * https://echarts.apache.org/en/api.html#zrender
 */
export function useAnnotationGestures(
  chart: EChartsType | null,
  containerRef: RefObject<HTMLElement | null>,
  onDraft: ((draft: PlacedAnnotationDraft) => void) | null
): RefObject<boolean> {
  const gestureRef = useRef(false);
  const onDraftRef = useRef(onDraft);
  useEffect(() => {
    onDraftRef.current = onDraft;
  }, [onDraft]);

  useEffect(() => {
    if (chart == null) {
      return;
    }
    const zr = chart.getZr();
    // Where the last press and release were, in canvas pixels. The editor of a region opens
    // at the release.
    let release: ZrPointerEvent | null = null;

    const toWindow = ({ offsetX, offsetY }: ZrPointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      return { x: (rect?.left ?? 0) + offsetX, y: (rect?.top ?? 0) + offsetY };
    };

    const onMouseDown = (event: ZrPointerEvent) => {
      gestureRef.current = hasModifier(event);
      release = event;
    };
    const onMouseUp = (event: ZrPointerEvent) => {
      release = event;
    };

    const onClick = (event: ZrPointerEvent) => {
      const draft = onDraftRef.current;
      if (draft == null || !hasModifier(event)) {
        return;
      }
      const time = timeAtPixel(chart, event.offsetX, event.offsetY);
      if (time != null) {
        draft({ from: time, to: time, position: toWindow(event) });
      }
    };

    const onBrushEnd = (event: BrushEndEvent) => {
      const draft = onDraftRef.current;
      if (draft == null || !gestureRef.current || release == null) {
        return;
      }
      // A zero-width brush is a click, which `onClick` handles.
      const range = brushEndToTimeRange(event);
      if (range != null) {
        draft({ ...draftFromRange(range.from, range.to), position: toWindow(release) });
      }
    };

    zr.on('mousedown', onMouseDown);
    zr.on('mouseup', onMouseUp);
    zr.on('click', onClick);
    // The brush event types are not public; see the comment in lib/echarts/timeBrush.ts.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    chart.on('brushEnd', onBrushEnd as (...args: unknown[]) => void);
    return () => {
      // EChart disposes the instance first on unmount, and dispose drops the listeners.
      if (!chart.isDisposed()) {
        zr.off('mousedown', onMouseDown);
        zr.off('mouseup', onMouseUp);
        zr.off('click', onClick);
        chart.off('brushEnd', onBrushEnd);
      }
    };
  }, [chart, containerRef]);

  return gestureRef;
}
