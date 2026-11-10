import { PanelPlugin } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';
import { seriesTypePath } from 'editor/constants';
import { MULTIVARIATE_SERIES_TYPE_OPTIONS } from 'editor/radar';
import { type EChartsFieldConfig } from 'editor/types';
import { makeLazyPanel } from 'lib/components/LazyPanel';
import { addAnimationOption } from 'lib/grafana/editor/common/animation';
import { addEditorModeOption } from 'lib/grafana/editor/common/editor-mode';
import { STANDARD_FIELD_OPTIONS } from 'lib/grafana/editor/common/fieldConfig';
import { addCommonLegendAndTooltip } from 'lib/grafana/editor/common/legend-and-tooltip';
import { addParallelLayoutOptions } from 'lib/grafana/editor/parallel/layout';
import { addParallelLineOpacityOptions } from 'lib/grafana/editor/parallel/line-opacity';
import { addParallelLineWidthOptions } from 'lib/grafana/editor/parallel/line-width';
import { addParallelSmoothOptions } from 'lib/grafana/editor/parallel/smooth';
import { addRadarFillAreaOptions } from 'lib/grafana/editor/radar/fill-area';
import { addRadarLineWidthOptions } from 'lib/grafana/editor/radar/line-width';
import { addRadarShapeOptions } from 'lib/grafana/editor/radar/shape-select';
import { addRadarSplitNumberOptions } from 'lib/grafana/editor/radar/split-number';
import { addRadarSymbolSizeOptions } from 'lib/grafana/editor/radar/symbol-size';
import { type PanelOptions } from 'types';
import { multivariateSuggestionsSupplier } from './suggestions';

// Initialize i18n before the option builders below call `t()`. Every module is
// its own webpack entry (see getEntries in .config/bundler/utils.ts), so
// Grafana can load this panel without any other module having run.
declare const __PLUGIN_ID__: string;

initPluginTranslations(__PLUGIN_ID__);

// Multivariate family panel: radar and parallel coordinates, both built from the
// multivariate model (each number field -> one axis, each row -> one polygon or line).
// The "Chart type" picker toggles between them over the same frames; the shared
// Panel resolves the multivariate chart module, which dispatches on the selected
// seriesType.
export const plugin = new PanelPlugin<PanelOptions, EChartsFieldConfig>(makeLazyPanel('multivariate'))
  .useFieldConfig({
    standardOptions: STANDARD_FIELD_OPTIONS,
    // Register `custom.hideFrom` so the legend visibility toggle's `byName`
    // override is saved. Each polygon or line is a row, so the chart reads the
    // hidden row names from that override (see `lib/grafana/fields/seriesConfig.ts`).
    useCustomConfig: (builder) => {
      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder) => {
    // Editor mode (Default / Advanced) — registered first so it renders at the
    // top. The radar shape/style options gate on Advanced; "Fill area" is
    // Default-tier. See docs/options-modes.md.
    addEditorModeOption(builder);

    // "Chart type" picker: registered because the family now hosts more than one
    // render type (radar + parallel coordinates). It toggles the panel-level
    // `seriesType` over the same frames; the radar and parallel option groups gate
    // on the selection (`isRadarSelected` / `isParallelSelected`) so only the
    // active type's options are shown. See parity.md.
    if (MULTIVARIATE_SERIES_TYPE_OPTIONS.length > 1) {
      builder.addRadio({
        path: seriesTypePath,
        name: 'Chart type',
        description: 'The chart that shows the fields of each row.',
        category: ['Multivariate'],
        defaultValue: 'radar',
        settings: { options: MULTIVARIATE_SERIES_TYPE_OPTIONS },
      });
    }

    // Radar options (Fill area = Default tier; shape / line width / symbol size /
    // rings = Advanced), gated on `isRadarSelected`. Each render helper omits its
    // ECharts key at the default (see options/radar.ts).
    addRadarFillAreaOptions(builder);
    addRadarShapeOptions(builder);
    addRadarLineWidthOptions(builder);
    addRadarSymbolSizeOptions(builder);
    addRadarSplitNumberOptions(builder);

    // Parallel options (Smooth = Default tier; layout / line width / line opacity
    // = Advanced), gated on `isParallelSelected`. Each helper omits its ECharts key
    // at the default (see options/parallel.ts).
    addParallelSmoothOptions(builder);
    addParallelLayoutOptions(builder);
    addParallelLineWidthOptions(builder);
    addParallelLineOpacityOptions(builder);

    // The family has no per-point fast path, so it registers the shared animation
    // switch directly rather than the cartesian `addPerformanceOptions` bundle
    // (whose Show points / Downsampling levers would be inert here).
    addAnimationOption(builder);

    // Single/Hidden only: a hover already lists every axis of one polygon/polyline,
    // so "All" has nothing to add. Matches `singleTooltipOnly` on
    // `multivariateChartModule`, which clamps the mode at render time.
    // No legend calcs: a calc over the axes of one row mixes their units.
    addCommonLegendAndTooltip(builder, { includeLegendCalcs: false, singleTooltipOnly: true });
    return builder;
  })
  // Advertise fitness for multi-metric numeric data (opts in via `"suggestions": true`).
  .setSuggestionsSupplier(multivariateSuggestionsSupplier);
