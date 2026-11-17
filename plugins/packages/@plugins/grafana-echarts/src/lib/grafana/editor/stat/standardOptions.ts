import { type FieldColorConfigSettings, FieldColorModeId, FieldConfigProperty } from '@grafana/data';
import { STANDARD_FIELD_OPTIONS } from 'lib/grafana/editor/common/fieldConfig';

/**
 * The Color settings of core Stat, which are the Grafana defaults: by-value color schemes, and the
 * thresholds scheme first in the picker. There is no "Color series by", because a cell shows one value.
 * https://grafana.com/developers/plugin-tools/reference/field-config
 */
const STAT_COLOR_SETTINGS: FieldColorConfigSettings = {
  byValueSupport: true,
  preferThresholdsMode: true,
};

/**
 * The standard field options of the stat family. The Color default is `thresholds`, as in core Stat, so a
 * new panel draws each value in the color of its threshold.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/#color-scheme
 */
export const STAT_FIELD_OPTIONS = {
  ...STANDARD_FIELD_OPTIONS,
  [FieldConfigProperty.Color]: {
    settings: STAT_COLOR_SETTINGS,
    defaultValue: { mode: FieldColorModeId.Thresholds },
  },
};
