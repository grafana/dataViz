import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GAUGE_SHOW_THRESHOLD_MARKERS_DEFAULT, gaugeCategoryName, gaugeShowThresholdMarkersPath } from 'editor/gauge';
import { type PanelOptions } from 'types';

/** The "Show thresholds" switch, as core Gauge. It shows the threshold band outside the value bar. */
export function addGaugeThresholdMarkerOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addBooleanSwitch({
    path: gaugeShowThresholdMarkersPath,
    name: t('gauge.threshold-markers.name', 'Show thresholds'),
    category: [gaugeCategoryName],
    defaultValue: GAUGE_SHOW_THRESHOLD_MARKERS_DEFAULT,
  });
}
