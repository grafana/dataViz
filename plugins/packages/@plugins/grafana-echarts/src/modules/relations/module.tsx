import { PanelPlugin } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import { seriesTypePath } from 'editor/constants';

import { makeLazyPanel } from 'lib/components/LazyPanel';
import { addEditorModeOption } from 'lib/grafana/editor/common/editor-mode';

import { addAnimationOption } from 'lib/grafana/editor/common/animation';
import { addCommonLegendAndTooltip } from 'lib/grafana/editor/common/legend-and-tooltip';
import { describeOption } from 'lib/grafana/editor/common/describeOption';
import { removeOption } from 'lib/grafana/editor/common/removeOption';
import { addRelationsChordOptions } from 'lib/grafana/editor/relations/chord';
import { addRelationsCustomConfig } from 'lib/grafana/editor/relations/fieldConfig';
import { addRelationsForceOptions } from 'lib/grafana/editor/relations/force';
import { addRelationsInteractionOptions } from 'lib/grafana/editor/relations/interaction';
import { addRelationsLabelOptions } from 'lib/grafana/editor/relations/labels';
import { addRelationsLayoutOptions } from 'lib/grafana/editor/relations/layout';
import { addRelationsLinkOptions } from 'lib/grafana/editor/relations/links';
import { addRelationsPerformanceOptions } from 'lib/grafana/editor/relations/performance';
import { addRelationsSankeyOptions } from 'lib/grafana/editor/relations/sankey';
import { addRelationsStatOptions } from 'lib/grafana/editor/relations/stats';
import { addRelationsTimelineOptions } from 'lib/grafana/editor/relations/timeline';
import { setSystemTransformations } from 'lib/grafana/panelDataTransformations';
import { type PanelOptions } from 'types';
import { relationsDataTransformations } from './dataTransformations';
import { relationsPresetsSupplier } from './presets';
import { relationsSuggestionsSupplier } from './suggestions';

import {
  relationsCategoryName,
  relationsLayoutCategoryName,
  relationsSeriesTypeOptions,
} from 'editor/relations/constants';
import {
  RELATIONS_DISABLED_FIELD_OPTIONS,
  RELATIONS_FIELD_OPTIONS,
} from 'lib/grafana/editor/relations/standardOptions';
import { type EChartsRelationsFieldConfig } from 'editor/relations/types';
import { isGraphVariant } from 'editor/relations/variants';
// Initialize i18n before `addRelationsStatOptions` calls `t()`.
declare const __PLUGIN_ID__: string;

initPluginTranslations(__PLUGIN_ID__);

/**
 * Users see this under the radio, and Grafana Assistant reads it as the panel's data hint, so keep it short.
 * Full contract: docs/relations-data-sources.md and data-plane/graph-wide.md.
 */
const CHART_TYPE_DESCRIPTION =
  'Graph for service maps, Sankey for weighted flow without cycles (up to 100 nodes and 12 levels), ' +
  'chord for dense pairwise traffic. Each numeric field is one edge between its endpoint labels';

/** Shared legend and tooltip builders register these without descriptions. */
const LEGEND_AND_TOOLTIP_DESCRIPTIONS: Record<string, string> = {
  'legend.showLegend': 'Show a legend entry for each node',
  'legend.displayMode': 'List or table legend',
  'legend.placement': 'Where the legend sits relative to the chart',
  'legend.width': 'Legend width in px when placed on the right',
  'legend.overflow': 'Truncate or wrap long legend items',
  'tooltip.mode': 'Show a tooltip for the hovered node or edge, or hide tooltips',
  'tooltip.maxWidth': 'Maximum tooltip width in px',
  'tooltip.maxHeight': 'Maximum tooltip height in px',
};

// Graph, sankey, and chord share one field-based node and link model.
const relationsPlugin = new PanelPlugin<PanelOptions, EChartsRelationsFieldConfig>(makeLazyPanel('relations'))
  .useFieldConfig({
    standardOptions: RELATIONS_FIELD_OPTIONS,
    disableStandardOptions: RELATIONS_DISABLED_FIELD_OPTIONS,
    useCustomConfig: addRelationsCustomConfig,
  })
  .setPanelOptions((builder) => {
    // Registration order sets the editor order.
    if (relationsSeriesTypeOptions.length > 1) {
      builder.addRadio({
        path: seriesTypePath,
        name: 'Chart type',
        description: CHART_TYPE_DESCRIPTION,
        category: [relationsCategoryName],
        defaultValue: 'graph',
        settings: { options: relationsSeriesTypeOptions },
      });
    }

    // The time slider hides the reducer because it selects one row.
    addRelationsTimelineOptions(builder);
    addRelationsStatOptions(builder);

    addRelationsLabelOptions(builder);

    addRelationsLayoutOptions(builder);
    addRelationsForceOptions(builder);
    // ECharts ignores the root animation option for graph series.
    addAnimationOption(builder, {
      category: [relationsLayoutCategoryName],
      showIf: (options) => !isGraphVariant(options),
    });

    addRelationsInteractionOptions(builder);
    addRelationsLinkOptions(builder);
    addRelationsSankeyOptions(builder);
    addRelationsChordOptions(builder);

    // A relations tooltip contains one node or edge.
    addCommonLegendAndTooltip(builder, { singleTooltipOnly: true, includeLegendCalcs: false });

    // These options require the unavailable multi-tooltip mode.
    removeOption(builder, 'tooltip.sort');
    removeOption(builder, 'tooltip.hideZeros');
    for (const [path, description] of Object.entries(LEGEND_AND_TOOLTIP_DESCRIPTIONS)) {
      describeOption(builder, path, description);
    }

    // Keep editor mode last in the Relations section.
    addEditorModeOption(builder, [relationsCategoryName]);

    // Keep performance controls at the bottom of the options pane.
    addRelationsPerformanceOptions(builder);
    return builder;
  })
  .setSuggestionsSupplier(relationsSuggestionsSupplier)
  // Grafana shows panel presets in the panel editor.
  // https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/stat/presets.ts
  // https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/#feature-toggles-that-are-enabled-by-default
  .setPresetsSupplier(relationsPresetsSupplier);

/**
 * Convert row frames before Grafana applies field overrides.
 * https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/panel-data-transformations
 */
export const plugin = setSystemTransformations(relationsPlugin, relationsDataTransformations);
