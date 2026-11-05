// Fills the two registries that Grafana core fills before it loads a panel plugin. Outside Grafana both are empty:
// the option builders throw when they add an option with an editor id that is not there, and
// `plugin.fieldConfigRegistry` has no standard properties, so `applyFieldOverrides` drops the defaults and the
// overrides. The Renderer and the tests call `fillStandardRegistries` before they load a `module.tsx`.
// Grafana core registers the editors in `getAllOptionEditors`:
// https://github.com/grafana/grafana/blob/main/public/app/core/components/OptionsUI/registry.tsx
import {
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
 * Sets the init function of a registry. `setInit` throws when the registry is already initialized: Grafana core,
 * or an earlier call, filled it. That registry stays as it is.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/utils/Registry.ts
 */
function setInitOnce<T extends { id: string }>(registry: { setInit: (init: () => T[]) => void }, init: () => T[]) {
  try {
    registry.setInit(init);
  } catch {
    // Already initialized.
  }
}

/** Fills the standard editor and field config registries of `@grafana/data`, when they are not filled yet. */
export function fillStandardRegistries(): void {
  setInitOnce(standardEditorsRegistry, () =>
    EDITOR_IDS.map((id): StandardEditorsRegistryItem => ({ id, name: id, editor: noEditor }))
  );
  // `PanelPlugin.useFieldConfig` copies these items into `plugin.fieldConfigRegistry`, with the plugin's own defaults.
  setInitOnce(standardFieldConfigEditorRegistry, () => standardFieldConfigRegistry.list());
}
