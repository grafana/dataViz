// Fills the two registries that Grafana core fills before it loads a panel plugin. Outside Grafana both are empty:
// the option builders throw when they add an option with an editor id that is not there, and
// `plugin.fieldConfigRegistry` has no standard properties, so `applyFieldOverrides` drops the defaults and the
// overrides. The Renderer and the tests call `fillStandardRegistries` before they load a `module.tsx`.
// Grafana core registers the editors in `getAllOptionEditors`:
// https://github.com/grafana/grafana/blob/main/public/app/core/components/OptionsUI/registry.tsx
import {
  type Registry,
  type RegistryItem,
  type StandardEditorsRegistryItem,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import { standardFieldConfigRegistry } from './standardFieldConfigs';

/** The editor ids that the `module.tsx` files use. Nothing here renders an editor, so each one is empty. */
const EDITOR_IDS = [
  'select',
  'radio',
  'boolean',
  'number',
  'text',
  'slider',
  'color',
  'unit',
  'thresholds',
  'mappings',
  'links',
  'fieldColor',
  'stats-picker',
  'multiSelect',
  'custom',
  'strings',
  'timezone',
  'interval',
  'field-name',
  'dashboard-uid',
  'reduce',
  'multi-select',
];

const noEditor = () => null;

/**
 * Registers each item that the registry does not have. `getIfExists` runs the init function of the registry first,
 * so the items of the host (Grafana core calls `setInit` at boot) stay, and only the missing ids are added.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/utils/Registry.ts
 */
function registerMissing<T extends RegistryItem>(registry: Registry<T>, items: T[]) {
  for (const item of items) {
    if (!registry.getIfExists(item.id)) {
      registry.register(item);
    }
  }
}

/** Adds the standard editors and field config properties to the registries of `@grafana/data`, when they are missing. */
export function fillStandardRegistries(): void {
  registerMissing(
    standardEditorsRegistry,
    EDITOR_IDS.map((id): StandardEditorsRegistryItem => ({ id, name: id, editor: noEditor }))
  );
  // `PanelPlugin.useFieldConfig` copies these items into `plugin.fieldConfigRegistry`, with the plugin's own defaults.
  registerMissing(standardFieldConfigEditorRegistry, standardFieldConfigRegistry.list());
}
