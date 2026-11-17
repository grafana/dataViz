import { type VisualizationSuggestionsSupplier } from '@grafana/data';
import { seriesTypePath } from 'editor/constants';
import { gaugeShapePath, gaugeShowThresholdMarkersPath } from 'editor/gauge';
import { scoreGauge } from 'lib/echarts/charts/fitness';
import { previewCardOptions } from 'lib/echarts/charts/suggestionCards';
import { type PanelOptions } from 'types';

// Visualization Suggestions for the gauge family: one gauge for each number field, as an arc or as a circle.
// The data gate is `scoreGauge` (see charts/fitness.ts).
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-suggestions-support
export const gaugeSuggestionsSupplier: VisualizationSuggestionsSupplier<PanelOptions> = (dataSummary) => {
  const score = scoreGauge(dataSummary);
  if (score == null) {
    return;
  }

  // The threshold band is too thin to read on a card, so the preview does not draw it. Core does the same.
  const cardOptions = previewCardOptions({ options: { [gaugeShowThresholdMarkersPath]: false } });

  return [
    { name: 'Gauge', score, options: { [seriesTypePath]: 'gauge', [gaugeShapePath]: 'gauge' }, cardOptions },
    { name: 'Circular gauge', score, options: { [seriesTypePath]: 'gauge', [gaugeShapePath]: 'circle' }, cardOptions },
  ];
};
