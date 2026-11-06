// The Renderer draws no data links and no actions (`renderer.12`). They come from two places: the field config of
// the panel, and the field config of the frames. A backend can put links in a frame (Azure Monitor adds "View query
// in Azure Portal"), and the schema accepts any frame field config from the App. Both are removed before
// `applyFieldOverrides`, which makes `getLinks` from `field.config.links`.
import { type DataFrame, type FieldConfig, type FieldConfigSource } from '@grafana/data';

/** The field config properties that call out of the chart: data links and actions. */
const CALL_OUT_PROPERTIES = new Set(['links', 'actions']);

const withoutCallOutKeys = (config: FieldConfig): FieldConfig =>
  Object.fromEntries(Object.entries(config).filter(([key]) => !CALL_OUT_PROPERTIES.has(key)));

/** `fieldConfig` of the panel with no data links and no actions, in the defaults and in the overrides. */
export function withoutCallOuts(fieldConfig: FieldConfigSource): FieldConfigSource {
  const overrides = fieldConfig.overrides.map((override) => ({
    ...override,
    properties: (override.properties ?? []).filter((property) => !CALL_OUT_PROPERTIES.has(property.id)),
  }));
  return { defaults: withoutCallOutKeys(fieldConfig.defaults), overrides };
}

/** `frame` with no data links and no actions in the config of its fields. */
export function frameWithoutCallOuts(frame: DataFrame): DataFrame {
  return {
    ...frame,
    fields: frame.fields.map((field) => ({ ...field, config: withoutCallOutKeys(field.config) })),
  };
}
