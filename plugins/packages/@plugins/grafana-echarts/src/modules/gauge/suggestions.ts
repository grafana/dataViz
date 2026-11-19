import {
  FieldColorModeId,
  type FieldConfigSource,
  FieldType,
  type PanelDataSummary,
  type VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { seriesTypePath } from 'editor/constants';
import {
  GAUGE_CALC_DEFAULT,
  gaugeBarWidthFactorPath,
  gaugeShapePath,
  gaugeShowThresholdMarkersPath,
} from 'editor/gauge';
import { scoreGauge } from 'lib/echarts/charts/fitness';
import { previewCardOptions } from 'lib/echarts/charts/suggestionCards';
import { GAUGE_MAX_VALUES } from 'lib/echarts/charts/suggestionLimits';
import { type PanelOptions } from 'types';

/** The bar of a suggested gauge is thinner than the default, as core. */
const SUGGESTION_BAR_WIDTH_FACTOR = 0.3;

/**
 * True for a table: one frame with a string field and not more than `GAUGE_MAX_VALUES` rows. Each row is then one
 * gauge, as core (`shouldUseRawValues`).
 */
const isSmallTable = (summary: PanelDataSummary): boolean =>
  summary.hasFieldType(FieldType.string) && summary.frameCount === 1 && summary.rowCountTotal <= GAUGE_MAX_VALUES;

// Visualization Suggestions for the gauge family, as an arc or as a circle. The data gate and the score are
// `scoreGauge` (see charts/fitness.ts). The options are those of the core suggestions, without `sparkline`, which
// this panel does not have (see parity.md).
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/gauge/suggestions.ts
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-suggestions-support
export const gaugeSuggestionsSupplier: VisualizationSuggestionsSupplier<PanelOptions> = (dataSummary) => {
  const score = scoreGauge(dataSummary);
  if (score == null) {
    return;
  }

  const rawValues = isSmallTable(dataSummary);
  // A table gives one gauge for each row. Other data gives one gauge for each number field, with its last value.
  // https://github.com/grafana/grafana/blob/main/public/app/features/panel/suggestions/utils.ts
  const reduceOptions = rawValues ? { values: true, calcs: [] } : { values: false, calcs: [GAUGE_CALC_DEFAULT] };
  // The rows of a table have no thresholds of their own, so each gauge gets a color of the palette.
  const fieldConfig: FieldConfigSource = {
    defaults: rawValues ? { color: { mode: FieldColorModeId.PaletteClassic } } : {},
    overrides: [],
  };
  const options = {
    [seriesTypePath]: 'gauge' as const,
    [gaugeBarWidthFactorPath]: SUGGESTION_BAR_WIDTH_FACTOR,
    [gaugeShowThresholdMarkersPath]: false,
    reduceOptions,
  };
  const cardOptions = previewCardOptions();

  return [
    { name: 'Gauge', score, fieldConfig, options: { ...options, [gaugeShapePath]: 'gauge' }, cardOptions },
    { name: 'Circular gauge', score, fieldConfig, options: { ...options, [gaugeShapePath]: 'circle' }, cardOptions },
  ];
};
