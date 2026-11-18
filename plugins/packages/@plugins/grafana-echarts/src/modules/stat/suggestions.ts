import { ReducerID, type VisualizationSuggestionsSupplier } from '@grafana/data';
import { seriesTypePath } from 'editor/constants';
import { type EChartsFieldConfig } from 'editor/types';
import { scoreStat } from 'lib/echarts/charts/fitness';
import { previewCardOptions } from 'lib/echarts/charts/suggestionCards';
import { STAT_PREVIEW_MAX_SERIES } from 'lib/echarts/charts/suggestionLimits';
import { type PanelOptions } from 'types';

// Visualization Suggestions for the stat family: one card, for data with a number field. Each number field
// becomes one cell with its last value. The data gate is `scoreStat` (see charts/fitness.ts).
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-suggestions-support
export const statSuggestionsSupplier: VisualizationSuggestionsSupplier<PanelOptions, EChartsFieldConfig> = (
  dataSummary
) => {
  const score = scoreStat(dataSummary);
  if (score == null) {
    return;
  }

  return [
    {
      name: 'Stat',
      score,
      options: { [seriesTypePath]: 'stat', reduceOptions: { values: false, calcs: [ReducerID.lastNotNull] } },
      cardOptions: previewCardOptions({ maxSeries: STAT_PREVIEW_MAX_SERIES }),
    },
  ];
};
