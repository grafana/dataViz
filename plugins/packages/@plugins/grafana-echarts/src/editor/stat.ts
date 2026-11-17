import { type SelectableValue } from '@grafana/data';
import { BigValueColorMode, BigValueGraphMode, BigValueJustifyMode, BigValueTextMode } from '@grafana/schema';
import { type StatSeriesType } from 'editor/types';
import { type PanelOptions } from 'types';

/**
 * Stat family editor constants. The option paths, values and defaults are the ones of core Stat:
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/stat/panelcfg.cue
 * https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/
 */

/** The family's routing type. It is not an ECharts series type: see `StatSeriesType`. */
export const statSeriesTypes: StatSeriesType[] = ['stat'];

/** The editor category of the stat options, as core Stat names it. */
export const statCategoryName = 'Stat styles';

export const statTextModePath = 'textMode';
export const statColorModePath = 'colorMode';
export const statGraphModePath = 'graphMode';
export const statWideLayoutPath = 'wideLayout';
export const statJustifyModePath = 'justifyMode';

export const STAT_TEXT_MODE_DEFAULT = BigValueTextMode.Auto;
export const STAT_COLOR_MODE_DEFAULT = BigValueColorMode.Value;
export const STAT_GRAPH_MODE_DEFAULT = BigValueGraphMode.Area;
export const STAT_WIDE_LAYOUT_DEFAULT = true;
export const STAT_JUSTIFY_MODE_DEFAULT = BigValueJustifyMode.Auto;

export const statTextModeOptions: Array<SelectableValue<BigValueTextMode>> = [
  { value: BigValueTextMode.Auto, label: 'Auto' },
  { value: BigValueTextMode.Value, label: 'Value' },
  { value: BigValueTextMode.ValueAndName, label: 'Value and name' },
  { value: BigValueTextMode.Name, label: 'Name' },
  { value: BigValueTextMode.None, label: 'None' },
];

/** The color modes that the panel draws: all the color modes of core Stat. */
export const statColorModeOptions: Array<SelectableValue<BigValueColorMode>> = [
  { value: BigValueColorMode.None, label: 'None' },
  { value: BigValueColorMode.Value, label: 'Value' },
  { value: BigValueColorMode.Background, label: 'Background Gradient' },
  { value: BigValueColorMode.BackgroundSolid, label: 'Background Solid' },
];

export const statGraphModeOptions: Array<SelectableValue<BigValueGraphMode>> = [
  { value: BigValueGraphMode.None, label: 'None' },
  { value: BigValueGraphMode.Area, label: 'Area' },
];

/** "Text alignment" in the editor. The automatic mode puts a value with no name at the center of its cell. */
export const statJustifyModeOptions: Array<SelectableValue<BigValueJustifyMode>> = [
  { value: BigValueJustifyMode.Auto, label: 'Auto' },
  { value: BigValueJustifyMode.Center, label: 'Center' },
];

/** The stat options with their defaults applied. */
export interface StatRenderOptions {
  textMode: BigValueTextMode;
  colorMode: BigValueColorMode;
  graphMode: BigValueGraphMode;
  wideLayout: boolean;
  justifyMode: BigValueJustifyMode;
}

/**
 * The stat options of the panel, with the default for each option that is not set. A color mode that the panel
 * does not know gives the default color mode.
 */
export function resolveStatOptions(options: PanelOptions): StatRenderOptions {
  const colorMode = statColorModeOptions.some((option) => option.value === options.colorMode)
    ? (options.colorMode ?? STAT_COLOR_MODE_DEFAULT)
    : STAT_COLOR_MODE_DEFAULT;
  return {
    textMode: options.textMode ?? STAT_TEXT_MODE_DEFAULT,
    colorMode,
    graphMode: options.graphMode ?? STAT_GRAPH_MODE_DEFAULT,
    wideLayout: options.wideLayout ?? STAT_WIDE_LAYOUT_DEFAULT,
    justifyMode: options.justifyMode ?? STAT_JUSTIFY_MODE_DEFAULT,
  };
}
