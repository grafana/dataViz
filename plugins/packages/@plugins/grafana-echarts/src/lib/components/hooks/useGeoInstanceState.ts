import { type ChartFamily } from 'lib/echarts/charts/autoSeriesType';
import { type EChartsType } from 'lib/echarts/echarts';
import { readLiveGeoView } from 'lib/echarts/geo/liveView';
import { toLiveMapView } from 'lib/echarts/geo/view';
import { type GeoInstanceState } from 'lib/grafana/geo/view';
import { usePanelContext } from '@grafana/ui';
import { type RefObject, useEffect } from 'react';

/**
 * Give the view editor the live map view of a geo panel, as core Geomap gives its OpenLayers map. The panel
 * context `onInstanceStateChange` sets the state, and Grafana passes it to the editor as `context.instanceState`.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/GeomapPanel.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/overview-panelchrome--docs
 */
export function useGeoInstanceState(chartRef: RefObject<EChartsType | null>, family: ChartFamily | undefined): void {
  const { onInstanceStateChange } = usePanelContext();
  useEffect(() => {
    if (family !== 'geo' || !onInstanceStateChange) {
      return;
    }
    const state: GeoInstanceState = {
      readMapView: () => {
        const chart = chartRef.current;
        if (!chart || chart.isDisposed()) {
          return undefined;
        }
        // https://echarts.apache.org/en/api.html#echartsInstance.getWidth
        return toLiveMapView(readLiveGeoView(chart), { width: chart.getWidth(), height: chart.getHeight() });
      },
    };
    onInstanceStateChange(state);
  }, [chartRef, family, onInstanceStateChange]);
}
