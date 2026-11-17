import { PanelPlugin, ReducerID } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';
import { type EChartsFieldConfig } from 'editor/types';
import { makeLazyPanel } from 'lib/components/LazyPanel';
import { addStandardDataReduceOptions } from 'lib/grafana/editor/common/standardReducer';
import { STAT_FIELD_OPTIONS } from 'lib/grafana/editor/stat/standardOptions';
import { addStatStyleOptions } from 'lib/grafana/editor/stat/styles';
import { type PanelOptions } from 'types';
import { statSuggestionsSupplier } from './suggestions';

// Initialize i18n before the option builders below call `t()`. Every module is
// its own webpack entry (see getEntries in .config/bundler/utils.ts), so
// Grafana can load this panel without any other module having run.
declare const __PLUGIN_ID__: string;

initPluginTranslations(__PLUGIN_ID__);

// Stat family panel: one cell for each value, with the value as large text, its name and a sparkline. It is
// the core Stat panel on the ECharts canvas, with the option names of core Stat.
// https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/
//
// `stat` is the family's only render type, so there is no "Chart type" picker: the shared Panel's `'Auto'`
// resolver returns it for this family. The panel has no legend and no tooltip, as core Stat.
export const plugin = new PanelPlugin<PanelOptions, EChartsFieldConfig>(makeLazyPanel('stat'))
  .useFieldConfig({ standardOptions: STAT_FIELD_OPTIONS })
  .setPanelOptions((builder) => {
    // "Value options": the reducer for each field, or one value for each row. Core Stat's default is the last
    // value that is not null.
    addStandardDataReduceOptions(builder, true, ReducerID.lastNotNull);
    // "Text size": the font size of the name ("Title") and of the value. Unset fits the text to its cell.
    // https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/#text-size
    commonOptionsBuilder.addTextSizeOptions(builder, { withTitle: true, withValue: true });
    addStatStyleOptions(builder);
    return builder;
  })
  // The cells go to the edges of the panel, as in core Stat.
  .setNoPadding()
  // Advertise fitness for data with a number field (opts in via `"suggestions": true`).
  .setSuggestionsSupplier(statSuggestionsSupplier);
