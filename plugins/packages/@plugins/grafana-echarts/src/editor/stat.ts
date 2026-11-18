import { type SelectableValue, VizOrientation } from '@grafana/data';
import {
  BigValueColorMode,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
  PercentChangeColorMode,
} from '@grafana/schema';
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

export const statOrientationPath = 'orientation';
export const statTextModePath = 'textMode';
export const statColorModePath = 'colorMode';
export const statGraphModePath = 'graphMode';
export const statWideLayoutPath = 'wideLayout';
export const statJustifyModePath = 'justifyMode';
export const statShowPercentChangePath = 'showPercentChange';
export const statPercentChangeColorModePath = 'percentChangeColorMode';

export const STAT_ORIENTATION_DEFAULT = VizOrientation.Auto;
export const STAT_TEXT_MODE_DEFAULT = BigValueTextMode.Auto;
export const STAT_COLOR_MODE_DEFAULT = BigValueColorMode.Value;
export const STAT_GRAPH_MODE_DEFAULT = BigValueGraphMode.Area;
export const STAT_WIDE_LAYOUT_DEFAULT = true;
export const STAT_JUSTIFY_MODE_DEFAULT = BigValueJustifyMode.Auto;
export const STAT_SHOW_PERCENT_CHANGE_DEFAULT = false;
export const STAT_PERCENT_CHANGE_COLOR_MODE_DEFAULT = PercentChangeColorMode.Standard;

/**
 * How the cells are put in the panel. Auto: a grid. Horizontal: one cell for each row of the panel. Vertical:
 * one cell for each column of the panel.
 */
export const statOrientationOptions: Array<SelectableValue<VizOrientation>> = [
  { value: VizOrientation.Auto, label: 'Auto' },
  { value: VizOrientation.Horizontal, label: 'Horizontal' },
  { value: VizOrientation.Vertical, label: 'Vertical' },
];

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

/**
 * The color of the percent change. Standard: green for an increase and red for a decrease. Inverted: the
 * opposite. Same as Value: the color of the value text.
 */
export const statPercentChangeColorModeOptions: Array<SelectableValue<PercentChangeColorMode>> = [
  { value: PercentChangeColorMode.Standard, label: 'Standard' },
  { value: PercentChangeColorMode.Inverted, label: 'Inverted' },
  { value: PercentChangeColorMode.SameAsValue, label: 'Same as Value' },
];

/** The stat options with their defaults applied. */
export interface StatRenderOptions {
  orientation: VizOrientation;
  textMode: BigValueTextMode;
  colorMode: BigValueColorMode;
  graphMode: BigValueGraphMode;
  wideLayout: boolean;
  justifyMode: BigValueJustifyMode;
  /** The font size in pixels of the name and of the value. Unset fits the text to its cell. */
  titleSize?: number;
  valueSize?: number;
  /** The change from the first value to the last value of a series, in percent, is shown with the value. */
  showPercentChange: boolean;
  percentChangeColorMode: PercentChangeColorMode;
  /** The font size in pixels of the percent change. Unset gives a size from the size of the value. */
  percentSize?: number;
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
    orientation: options.orientation ?? STAT_ORIENTATION_DEFAULT,
    textMode: statTextModeOptions.find(({ value }) => value === options.textMode)?.value ?? STAT_TEXT_MODE_DEFAULT,
    colorMode,
    graphMode: options.graphMode ?? STAT_GRAPH_MODE_DEFAULT,
    wideLayout: options.wideLayout ?? STAT_WIDE_LAYOUT_DEFAULT,
    justifyMode: options.justifyMode ?? STAT_JUSTIFY_MODE_DEFAULT,
    // A size of 0 is not set, as in core.
    titleSize: options.text?.titleSize || undefined,
    valueSize: options.text?.valueSize || undefined,
    showPercentChange: options.showPercentChange ?? STAT_SHOW_PERCENT_CHANGE_DEFAULT,
    percentChangeColorMode: options.percentChangeColorMode ?? STAT_PERCENT_CHANGE_COLOR_MODE_DEFAULT,
    percentSize: options.text?.percentSize || undefined,
  };
}
