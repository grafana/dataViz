import { PanelPlugin } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import { GAUGE_CALC_DEFAULT } from 'editor/gauge';
import { makeLazyPanel } from 'lib/components/LazyPanel';
import { addStandardDataReduceOptions } from 'lib/grafana/editor/common/standardReducer';
import { addGaugeBarWidthOptions } from 'lib/grafana/editor/gauge/bar-width';
import { addGaugeShapeOptions } from 'lib/grafana/editor/gauge/shape';
import { addGaugeTextModeOptions } from 'lib/grafana/editor/gauge/text-mode';
import { addGaugeThresholdMarkerOptions } from 'lib/grafana/editor/gauge/threshold-markers';
import { type PanelOptions } from 'types';
import { gaugeSuggestionsSupplier } from './suggestions';

// Initialize i18n before the option builders below call `t()`. See `modules/part-to-whole/module.tsx`.
declare const __PLUGIN_ID__: string;

initPluginTranslations(__PLUGIN_ID__);

// Gauge family panel: one gauge for each value. The option names and the defaults are those of the core Gauge
// panel. `modules/gauge/parity.md` lists the core options and their status.
// https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/gauge/
export const plugin = new PanelPlugin<PanelOptions>(makeLazyPanel('gauge'))
  // The standard field options with the Grafana defaults, as core Gauge: the color comes from the thresholds.
  .useFieldConfig({})
  .setPanelOptions((builder) => {
    // Show / Limit / Calculation / Fields. `resolveFieldDisplays` reads them.
    addStandardDataReduceOptions(builder, true, GAUGE_CALC_DEFAULT);
    addGaugeShapeOptions(builder);
    addGaugeBarWidthOptions(builder);
    addGaugeTextModeOptions(builder);
    addGaugeThresholdMarkerOptions(builder);
    return builder;
  })
  .setSuggestionsSupplier(gaugeSuggestionsSupplier);
