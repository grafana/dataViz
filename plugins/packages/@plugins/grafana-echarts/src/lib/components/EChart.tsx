import { type AbsoluteTimeRange, type FieldConfigSource } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/schema';
import { usePanelContext } from '@grafana/ui';
import { timeAtPixel } from 'lib/echarts/annotationGestures';
import { isMultiValueSeriesType } from 'lib/echarts/charts/narrowing';
import { type ChartContext, type ChartModule } from 'lib/echarts/charts/types';
import { type EChartsType, init } from 'lib/echarts/echarts';
import { hasTimeAxis, hasTimeBrush } from 'lib/echarts/options/panelOption';
import { collectProximitySeries } from 'lib/echarts/tooltip/proximity';
import React, {
  type MutableRefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type PanelOptions } from 'types';
import { type InteractedRelationsView } from 'lib/echarts/relations/options/view';
import { AnnotationEditor } from './annotations/AnnotationEditor';
import { type PlacedAnnotationDraft, useAnnotationGestures } from './hooks/useAnnotationGestures';
import { useTreemapDrillDown } from './hooks/useTreemapDrillDown';
import { useBrushTimeZoom } from './hooks/useBrushTimeZoom';
import { useTimeAxisPan } from './hooks/useTimeAxisPan';
import { useDoubleClickZoomOut } from './hooks/useDoubleClickZoomOut';
import { TimeZoomOutContext } from './TimeZoomOutContext';
import { ChartInitContext } from './chartInitContext';
import { useChartOption } from './hooks/useChartOption';
import { useChartResize } from './hooks/useChartResize';
import { useRelationsPersistence } from './hooks/useRelationsPersistence';
import { EChartsTooltip } from './tooltip/EChartsTooltip';
import { useEChartsTooltip } from './tooltip/useEChartsTooltip';

interface Props {
  chartContext: ChartContext;
  chartModule: ChartModule;
  /** True when the panel renders a Grafana DOM legend instead of ECharts' native legend. */
  isGrafanaLegend: boolean;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
  /**
   * Write-backs for interactions that are edits rather than view state — a dragged
   * node's position and, when asked for, the panned/zoomed view. Bound here rather
   * than in `Panel` because they need the live instance, which is this component's
   * state; `Panel` holds only a ref. See `useRelationsPersistence`.
   */
  onFieldConfigChange: (fieldConfig: FieldConfigSource) => void;
  onOptionsChange: (options: PanelOptions) => void;
  /** Chart-area size allocated by VizLayout. */
  width: number;
  height: number;
  /**
   * Filled with the ECharts instance for the panel's siblings — the Grafana DOM
   * legend is rendered by `VizLayout`, outside this component, and its hover
   * emphasis has to dispatch onto this chart (see `useLegendHighlight`).
   */
  instanceRef?: MutableRefObject<EChartsType | null>;
  /** Keeps an interacted Relations view while empty states replace this chart. */
  relationsViewRef: MutableRefObject<InteractedRelationsView | undefined>;
}

/**
 * Owns the ECharts instance and its React lifecycle: init/dispose, option
 * rebuilds, resize, and the time-axis brush handler. Rendered inside
 * VizLayout's render prop so it receives the chart-area size.
 */
export const EChart: React.FC<Props> = ({
  chartContext,
  chartModule,
  isGrafanaLegend,
  onChangeTimeRange,
  onFieldConfigChange,
  onOptionsChange,
  width,
  height,
  instanceRef,
  relationsViewRef,
}) => {
  const panelDOMRef = useRef<HTMLDivElement>(null);
  const isPreview = chartContext.options.isPreview === true;
  // The chart instance is created on mount (see the layout effect below) and
  // held in state so the option/resize/brush hooks re-run once it exists.
  const [chart, setChart] = useState<EChartsType | null>(null);
  const resizeStrategy = useMemo(
    () => chartModule.getResizeStrategy?.(chartContext) ?? 'immediate',
    // The chart dependency recalculates the strategy when the ECharts instance changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chart, chartContext, chartModule]
  );
  const getSettledResizeOption = useCallback(
    (plotWidth: number, plotHeight: number) =>
      chartModule.getSettledResizeOption?.(chartContext, { plotWidth, plotHeight }),
    [chartContext, chartModule]
  );

  const tooltipMode = chartContext.options.tooltip?.mode ?? TooltipDisplayMode.Single;

  // Per-series values enabling Grafana-parity proximity hover; `undefined` for
  // the families and modes that keep ECharts' native hit-testing.
  const proximitySeries = useMemo(
    () => (isPreview ? undefined : collectProximitySeries(chartContext.frames, chartContext.seriesType, tooltipMode)),
    [chartContext.frames, chartContext.seriesType, isPreview, tooltipMode]
  );

  // React tooltip overlay: ECharts' (invisible) tooltip formatter feeds hovered
  // content to this controller's `sink`; the controller tracks cursor/show/hide
  // and the `EChartsTooltip` renders it with `@grafana/ui`'s VizTooltip. The
  // chart mount node doubles as the coordinate origin for cursor positions.
  // `tooltipSink`/`reportTooltipTrigger` are stable across renders.
  const {
    sink: tooltipSink,
    reportTrigger: reportTooltipTrigger,
    state: tooltipState,
    dismiss: dismissTooltip,
  } = useEChartsTooltip(isPreview ? null : chart, panelDOMRef, { series: proximitySeries });

  const onChartInit = useContext(ChartInitContext);
  useLayoutEffect(() => {
    const dom = panelDOMRef.current;
    if (!dom) {
      return;
    }

    // Do not pass `useDirtyRect: true` here. It was tried and reverted: it
    // corrupts the initial draw (line paths and gridlines missing from the region
    // a resize exposes) because the resize effect below fires while the load
    // animation is still running, and zrender's dirty regions are stale by then.
    // It also measured as no gain — `setOption` runs with `notMerge`, so every
    // repaint invalidates everything and there is no partial repaint to skip.
    // See docs/performance.md and `pnpm run bench:dirty-rect`.
    // https://echarts.apache.org/en/api.html#echarts.init
    const instance = init(dom);
    onChartInit(instance);
    setChart(instance);
    if (instanceRef) {
      instanceRef.current = instance;
    }

    return () => {
      instance.dispose();
      setChart(null);
      if (instanceRef) {
        instanceRef.current = null;
      }
    };
  }, [instanceRef, onChartInit]);

  const treemapRootRef = useTreemapDrillDown(isPreview ? null : chart);
  useChartOption(chart, chartContext, {
    isGrafanaLegend,
    plotWidth: width,
    plotHeight: height,
    tooltipSink,
    reportTooltipTrigger,
    relationsViewRef,
    treemapRootRef,
  });

  useChartResize(chart, width, height, {
    enabled: !isPreview,
    strategy: resizeStrategy,
    getSettledOption: getSettledResizeOption,
  });
  // Add an annotation from the chart, as core Time series: ctrl/cmd + click or drag, or the
  // tooltip's "Add annotation" button. Only when the dashboard lets the user add annotations
  // and the x-axis is a time axis (candlestick and boxplot use a category axis).
  // https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/annotate-visualizations/#add-annotations
  const { canAddAnnotations } = usePanelContext();
  const [annotationDraft, setAnnotationDraft] = useState<PlacedAnnotationDraft | null>(null);
  const timeAxis = useMemo(
    () => !isPreview && hasTimeBrush(chartContext, chartModule) && !isMultiValueSeriesType(chartContext.seriesType),
    [chartContext, chartModule, isPreview]
  );
  const canAnnotate = timeAxis && canAddAnnotations?.() === true;
  const openAnnotationEditor = useCallback(
    (draft: PlacedAnnotationDraft) => {
      dismissTooltip();
      setAnnotationDraft(draft);
    },
    [dismissTooltip]
  );
  const closeAnnotationEditor = useCallback(() => setAnnotationDraft(null), []);
  const annotationGestureRef = useAnnotationGestures(
    isPreview ? null : chart,
    panelDOMRef,
    canAnnotate ? openAnnotationEditor : null
  );
  // The button adds a point at the pinned cursor, as core (`u.posToVal(u.cursor.left)`). The
  // position is read from a ref, so the callback does not change on each mouse move.
  const tooltipPositionRef = useRef(tooltipState.position);
  useEffect(() => {
    tooltipPositionRef.current = tooltipState.position;
  }, [tooltipState.position]);
  const annotateFromTooltip = useCallback(() => {
    const position = tooltipPositionRef.current;
    const rect = panelDOMRef.current?.getBoundingClientRect();
    if (chart == null || position == null || rect == null) {
      return;
    }
    const time = timeAtPixel(chart, position.x - rect.left, position.y - rect.top);
    if (time != null) {
      openAnnotationEditor({ from: time, to: time, position });
    }
  }, [chart, openAnnotationEditor]);

  useBrushTimeZoom(isPreview ? null : chart, onChangeTimeRange, annotationGestureRef);
  // Pan with a drag of the x-axis labels, on the same time axes as the annotations (viz contract 26.2, rule 1).
  const axisRange = useMemo(
    () => ({ from: chartContext.timeRange.from.valueOf(), to: chartContext.timeRange.to.valueOf() }),
    [chartContext.timeRange]
  );
  useTimeAxisPan(timeAxis ? chart : null, axisRange, onChangeTimeRange);
  // A double click zooms the time range out, as core. The stream family has a time axis but no time brush.
  const zoomOut = useContext(TimeZoomOutContext);
  const zoomOutAxis = useMemo(
    () => !isPreview && hasTimeAxis(chartContext) && !isMultiValueSeriesType(chartContext.seriesType),
    [chartContext, isPreview]
  );
  useDoubleClickZoomOut(
    zoomOutAxis && zoomOut !== null ? chart : null,
    axisRange,
    onChangeTimeRange,
    zoomOut ?? undefined
  );
  useRelationsPersistence(isPreview ? null : chart, { chartContext, onFieldConfigChange, onOptionsChange });

  return (
    <>
      <div ref={panelDOMRef} style={{ width, height }} />
      {!isPreview && (
        <EChartsTooltip
          state={tooltipState}
          dismiss={dismissTooltip}
          annotate={canAnnotate ? annotateFromTooltip : undefined}
          mode={tooltipMode}
          maxWidth={chartContext.options.tooltip?.maxWidth}
          maxHeight={chartContext.options.tooltip?.maxHeight}
        />
      )}
      {annotationDraft != null && (
        <AnnotationEditor draft={annotationDraft} timeZone={chartContext.timeZone} dismiss={closeAnnotationEditor} />
      )}
    </>
  );
};
