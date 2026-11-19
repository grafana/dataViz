// The adapter of the core Stat panel: it changes Stat settings into the settings of the ECharts stat panel.
// Core panel: https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/
// Core options: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/stat/panelcfg.cue
import type { FieldConfigSource, MatcherConfig } from '@grafana/data';

import capabilityFile from './capabilities/stat.json';
import { toCapability } from './capabilityFile';
import type { CoreOverride, CorePanel, ImportAdapter } from './types';

const TARGET = 'grafana-echartsstat-panel';

/** The options of core Stat. The stat panel has each of them with the same path and the same values. */
const OPTION_KEYS = [
  'reduceOptions',
  'orientation',
  'textMode',
  'wideLayout',
  'colorMode',
  'graphMode',
  'justifyMode',
  'showPercentChange',
  'percentChangeColorMode',
  'text',
];

/** The standard field options: the stat panel keeps all of them (`STAT_FIELD_OPTIONS`). Core Stat has no `custom`. */
const STANDARD_KEYS = [
  'color',
  'decimals',
  'displayName',
  'fieldMinMax',
  'filterable',
  'links',
  'mappings',
  'max',
  'min',
  'noValue',
  'thresholds',
  'unit',
];

/** The status of each Stat setting, from capabilities/stat.json. */
export const statCapability = toCapability(capabilityFile);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A field matcher: https://grafana.com/docs/grafana/latest/panels-visualizations/configure-overrides/ */
const isMatcher = (value: unknown): value is MatcherConfig => isObject(value) && typeof value.id === 'string';

/** A copy of each present key of `from` in `keys`. */
const pick = (from: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((key) => from[key] !== undefined).map((key) => [key, structuredClone(from[key])]));

/** The overrides with the standard properties. An override with no such property is left out. */
const translateOverrides = (overrides: CoreOverride[]): FieldConfigSource['overrides'] =>
  overrides.flatMap((override) => {
    const properties = (override.properties ?? [])
      .filter((property) => STANDARD_KEYS.includes(property.id))
      .map((property) => ({ id: property.id, value: structuredClone(property.value) }));
    return isMatcher(override.matcher) && properties.length > 0
      ? [{ matcher: structuredClone(override.matcher), properties }]
      : [];
  });

/** The range that core gave to a field with a percent unit before Grafana 8.0. */
const PERCENT_UNIT_MAX: Record<string, number> = { percent: 100, percentunit: 1 };

/** The plugin version of a panel with no `pluginVersion`, as the migration of core. */
const OLDEST_PLUGIN_VERSION = '6.1';

/**
 * The `min` and `max` of a panel that Grafana saved before 8.0, as the migration of core Stat: a field with the
 * unit `percent` or `percentunit` gets the range of its unit, for each of the two that is not a number. Grafana
 * 8.0 removed this range from the panel, so the migration writes it to panels that had it.
 * Core: `sharedSingleStatMigrationHandler` in
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/SingleStatShared/SingleStatBaseOptions.ts
 */
const translatePercentRange = (panel: CorePanel, defaults: Record<string, unknown>) => {
  const version = typeof panel.pluginVersion === 'string' ? panel.pluginVersion : '';
  const unitMax = PERCENT_UNIT_MAX[String(defaults.unit)];
  if (parseFloat(version || OLDEST_PLUGIN_VERSION) >= 8 || unitMax === undefined) {
    return {};
  }
  return {
    ...(typeof defaults.min === 'number' ? {} : { min: 0 }),
    ...(typeof defaults.max === 'number' ? {} : { max: unitMax }),
  };
};

/** Makes the stat panel from a core Stat panel. It does not change `panel`. */
const translate = (panel: CorePanel) => {
  const defaults = isObject(panel.fieldConfig?.defaults) ? panel.fieldConfig.defaults : {};
  const options = isObject(panel.options) ? panel.options : {};
  const overrides = Array.isArray(panel.fieldConfig?.overrides) ? panel.fieldConfig.overrides : [];

  return {
    type: TARGET,
    options: pick(options, OPTION_KEYS),
    fieldConfig: {
      defaults: { ...pick(defaults, STANDARD_KEYS), ...translatePercentRange(panel, defaults) },
      overrides: translateOverrides(overrides),
    },
  };
};

export const statAdapter: ImportAdapter = { capability: statCapability, translate };
