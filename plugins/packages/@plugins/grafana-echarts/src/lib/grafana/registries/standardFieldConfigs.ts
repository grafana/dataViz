import {
  booleanOverrideProcessor,
  dataLinksOverrideProcessor,
  displayNameOverrideProcessor,
  type Field,
  type FieldConfig,
  FieldConfigOptionsRegistry,
  type FieldConfigPropertyItem,
  FieldType,
  identityOverrideProcessor,
  numberOverrideProcessor,
  stringOverrideProcessor,
  ThresholdsMode,
  thresholdsOverrideProcessor,
  valueMappingsOverrideProcessor,
} from '@grafana/data';

/** The fields of a standard property that are not the same for all properties. */
type Property = Pick<FieldConfigPropertyItem, 'id' | 'name' | 'process'> &
  Partial<
    Pick<
      FieldConfigPropertyItem,
      'description' | 'settings' | 'shouldApply' | 'showIf' | 'defaultValue' | 'category' | 'hideFromDefaults'
    >
  > & {
    /** The editor id of Grafana core. Nothing here renders the editor. */
    editorId: string;
  };

const isNumber = (field: Field) => field.type === FieldType.number;

const noEditor = () => null;

const property = ({ editorId: _editorId, ...config }: Property): FieldConfigPropertyItem => {
  const editor = noEditor;
  return {
    path: config.id,
    editor,
    override: editor,
    shouldApply: () => true,
    category: ['Standard options'],
    ...config,
  };
};

/**
 * The standard field config properties of Grafana core, in the same order, with the same processors, names,
 * categories and settings. Outside Grafana, the standard registry of `@grafana/data` is empty, and
 * `applyFieldOverrides` then drops every default and override (for example the unit). Grafana core fills that
 * registry in `getAllStandardFieldConfigs`:
 * https://github.com/grafana/grafana/blob/1f7cc66eb4f/public/app/core/components/OptionsUI/registry.tsx
 *
 * A plugin can replace the default, the settings or `hideFromDefaults` of a property in `useFieldConfig`
 * (for example the color mode). `actions` is not here: its processor is not exported.
 * The `custom.*` properties of each panel are not here: they come from the panel's `module.tsx`.
 */
export const standardFieldConfigRegistry = new FieldConfigOptionsRegistry(() => [
  property({
    id: 'unit',
    name: 'Unit',
    editorId: 'unit',
    process: stringOverrideProcessor,
    settings: { placeholder: 'none' },
  }),
  property({
    id: 'min',
    name: 'Min',
    description: 'Leave empty to calculate based on all values',
    editorId: 'number',
    process: numberOverrideProcessor,
    settings: { placeholder: 'auto' },
    shouldApply: isNumber,
  }),
  property({
    id: 'max',
    name: 'Max',
    description: 'Leave empty to calculate based on all values',
    editorId: 'number',
    process: numberOverrideProcessor,
    settings: { placeholder: 'auto' },
    shouldApply: isNumber,
  }),
  property({
    id: 'fieldMinMax',
    name: 'Field min/max',
    description: 'Calculate min max per field',
    editorId: 'boolean',
    process: booleanOverrideProcessor,
    shouldApply: isNumber,
    showIf: (defaults: FieldConfig) => defaults.min === undefined || defaults.max === undefined,
  }),
  property({
    id: 'decimals',
    name: 'Decimals',
    editorId: 'number',
    process: numberOverrideProcessor,
    settings: { placeholder: 'auto', min: 0, max: 15, integer: true },
    shouldApply: isNumber,
  }),
  property({
    id: 'displayName',
    name: 'Display name',
    description: 'Change the field or series name',
    editorId: 'text',
    process: displayNameOverrideProcessor,
    settings: { placeholder: 'none', expandTemplateVars: true },
  }),
  property({
    id: 'color',
    name: 'Color scheme',
    editorId: 'fieldColor',
    process: identityOverrideProcessor,
    settings: { byValueSupport: true, preferThresholdsMode: true },
  }),
  property({
    id: 'noValue',
    name: 'No value',
    description: 'What to show when there is no value',
    editorId: 'text',
    process: stringOverrideProcessor,
    settings: { placeholder: '-' },
  }),
  property({
    id: 'links',
    name: 'Data links',
    editorId: 'links',
    process: dataLinksOverrideProcessor,
    settings: { showOneClick: false },
    category: ['Data links and actions'],
  }),
  property({
    id: 'mappings',
    name: 'Value mappings',
    description: 'Modify the display text based on input value',
    editorId: 'mappings',
    process: valueMappingsOverrideProcessor,
    settings: {},
    defaultValue: [],
    shouldApply: (field) => field.type !== FieldType.time,
    category: ['Value mappings'],
  }),
  property({
    id: 'thresholds',
    name: 'Thresholds',
    editorId: 'thresholds',
    process: thresholdsOverrideProcessor,
    settings: {},
    defaultValue: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 80, color: 'red' },
      ],
    },
    category: ['Thresholds'],
  }),
  property({
    id: 'filterable',
    name: 'Filterable',
    editorId: 'boolean',
    process: booleanOverrideProcessor,
    settings: {},
    hideFromDefaults: true,
  }),
]);
