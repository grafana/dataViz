import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { BigValueTextMode } from '@grafana/schema';
import {
  STAT_COLOR_MODE_DEFAULT,
  STAT_GRAPH_MODE_DEFAULT,
  STAT_JUSTIFY_MODE_DEFAULT,
  STAT_PERCENT_CHANGE_COLOR_MODE_DEFAULT,
  STAT_SHOW_PERCENT_CHANGE_DEFAULT,
  STAT_TEXT_MODE_DEFAULT,
  STAT_WIDE_LAYOUT_DEFAULT,
  statCategoryName,
  statColorModeOptions,
  statColorModePath,
  statGraphModeOptions,
  statGraphModePath,
  statJustifyModeOptions,
  statJustifyModePath,
  statPercentChangeColorModeOptions,
  statPercentChangeColorModePath,
  statShowPercentChangePath,
  statTextModeOptions,
  statTextModePath,
  statWideLayoutPath,
} from 'editor/stat';
import { type PanelOptions } from 'types';

/**
 * Register the "Stat styles" options, in the order and with the names of core Stat. `resolveStatOptions` reads
 * them, and `layoutStatCells` applies them.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/stat/module.tsx
 * https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/#stat-styles
 */
export function addStatStyleOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  const category = [statCategoryName];

  builder.addSelect({
    path: statTextModePath,
    name: 'Text mode',
    description: 'Control if name and value is displayed or just name',
    category,
    defaultValue: STAT_TEXT_MODE_DEFAULT,
    settings: { options: statTextModeOptions },
  });

  // Core shows this option only for the "Value and name" mode.
  builder.addRadio({
    path: statWideLayoutPath,
    name: 'Wide layout',
    category,
    defaultValue: STAT_WIDE_LAYOUT_DEFAULT,
    settings: {
      options: [
        { value: true, label: 'On' },
        { value: false, label: 'Off' },
      ],
    },
    showIf: (options) => options.textMode === BigValueTextMode.ValueAndName,
  });

  builder.addSelect({
    path: statColorModePath,
    name: 'Color mode',
    category,
    defaultValue: STAT_COLOR_MODE_DEFAULT,
    settings: { options: statColorModeOptions },
  });

  builder.addRadio({
    path: statGraphModePath,
    name: 'Graph mode',
    description: 'Stat panel graph / sparkline mode',
    category,
    defaultValue: STAT_GRAPH_MODE_DEFAULT,
    settings: { options: statGraphModeOptions },
  });

  builder.addRadio({
    path: statJustifyModePath,
    name: 'Text alignment',
    category,
    defaultValue: STAT_JUSTIFY_MODE_DEFAULT,
    settings: { options: statJustifyModeOptions },
  });

  // Core shows this option only when the panel shows a calculation, and not one value for each row.
  builder.addBooleanSwitch({
    path: statShowPercentChangePath,
    name: 'Show percent change',
    category,
    defaultValue: STAT_SHOW_PERCENT_CHANGE_DEFAULT,
    showIf: (options) => !options.reduceOptions?.values,
  });

  builder.addSelect({
    path: statPercentChangeColorModePath,
    name: 'Percent change color mode',
    category,
    defaultValue: STAT_PERCENT_CHANGE_COLOR_MODE_DEFAULT,
    settings: { options: statPercentChangeColorModeOptions },
    showIf: (options) => Boolean(options.showPercentChange),
  });
}
