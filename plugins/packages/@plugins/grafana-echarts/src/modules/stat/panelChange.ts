// The panel change handler of the stat panel: a switch from core Stat keeps its options and overrides.
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/migration-handler-for-panels
// The mapping is the Stat adapter in lib/grafana/panelChange.
import { type FieldConfigSource, type PanelModel } from '@grafana/data';
import { statAdapter } from 'lib/grafana/panelChange/stat';

/** A plugin version after each migration of core Stat. The last migration is for panels before Grafana 8.0. */
const MIGRATED_PLUGIN_VERSION = '8.0.0';

/**
 * The options after a change from `prevPluginId`. For core Stat, it gives the Stat options, which Grafana does
 * not keep in a type change, and it changes `panel.fieldConfig` in place, as the handler of the cartesian panel
 * (`modules/cartesian/panelChange.ts`). For each other type, it changes nothing.
 *
 * Grafana runs the migration of core Stat when it loads the panel, so the range of an old panel with a percent
 * unit is in `prevFieldConfig`. The handler thus gives the adapter a plugin version that needs no migration.
 */
export function statPanelChangeHandler(
  panel: PanelModel,
  prevPluginId: string,
  prevOptions: Record<string, unknown>,
  prevFieldConfig: FieldConfigSource
): Record<string, unknown> {
  if (prevPluginId !== 'stat') {
    // Scenes keeps the options for an empty result.
    return {};
  }
  const imported = statAdapter.translate({
    type: prevPluginId,
    // A panel that Grafana loaded has no settings that need the migration of core.
    pluginVersion: MIGRATED_PLUGIN_VERSION,
    options: prevOptions,
    fieldConfig: { defaults: { ...prevFieldConfig.defaults }, overrides: prevFieldConfig.overrides },
  });
  Object.assign(panel.fieldConfig, imported.fieldConfig);
  return imported.options;
}
