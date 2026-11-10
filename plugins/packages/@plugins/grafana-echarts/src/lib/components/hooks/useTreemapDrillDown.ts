import { type ECElementEvent } from 'echarts/core';
import { type EChartsType } from 'lib/echarts/echarts';
import { treemapDrillDownNodeId, treemapRootNodeId, zoomTreemapToNode } from 'lib/echarts/treemapDrillDown';
import { type RefObject, useEffect, useRef } from 'react';

/**
 * Drill down in a treemap: a click on a parent node zooms to it. A leaf click is left to the
 * tooltip pin (`useEChartsTooltip`). A `null` chart binds no listener.
 * Returns the node id of the view root, which `useChartOption` sets again after each option
 * update. The root is view-only state (contract 4.5 item 6).
 * https://echarts.apache.org/en/api.html#events.Mouse%20events
 */
export function useTreemapDrillDown(chart: EChartsType | null): RefObject<string | undefined> {
  const rootRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!chart) {
      return;
    }
    const onClick = (params: ECElementEvent) => {
      const id = treemapDrillDownNodeId(params);
      if (id !== undefined && params.seriesIndex != null) {
        zoomTreemapToNode(chart, params.seriesIndex, id);
      }
    };
    // Header and breadcrumb clicks both dispatch this action.
    // https://echarts.apache.org/en/api.html#events.treemapRootToNode
    const onRoot = (payload: unknown) => {
      rootRef.current = treemapRootNodeId(payload);
    };
    chart.on('click', onClick);
    chart.on('treemapRootToNode', onRoot);
    return () => {
      // A disposed chart has no listeners (see `useBrushTimeZoom`).
      if (!chart.isDisposed()) {
        chart.off('click', onClick);
        chart.off('treemapRootToNode', onRoot);
      }
    };
  }, [chart]);
  return rootRef;
}
