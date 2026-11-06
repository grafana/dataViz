// The props of `Panel` for a viz spec, made as Grafana makes them for a panel JSON (`spec.10`).
import {
  applyFieldOverrides,
  createTheme,
  EventBusSrv,
  getPanelOptionsWithDefaults,
  type GrafanaTheme2,
} from '@grafana/data';
import { type PanelComponentProps } from 'lib/components/types';
import { type PanelOptions } from 'types';
import { withoutCallOuts } from './callOuts';
import { isObject } from './parseSpec';
import { type PanelEntry } from './panels';
import { toSpecData } from './toPanelData';
import { type VizSpec } from './vizSpec';

const themes = new Map<VizSpec['theme'], GrafanaTheme2>();

/**
 * The Grafana theme of `spec.theme` (`renderer.11`).
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/themes/createTheme.ts
 */
export function themeOf(mode: VizSpec['theme']): GrafanaTheme2 {
  let theme = themes.get(mode);
  if (!theme) {
    theme = createTheme({ colors: { mode } });
    themes.set(mode, theme);
  }
  return theme;
}

/**
 * Narrows the output of `getPanelOptionsWithDefaults` to the panel options type. The option builders of the plugin
 * make the object, and Grafana gives the same object to the panel with no other check. Not every panel has each
 * option of `PanelOptions` (the geo panel has no legend), as in Grafana.
 */
const isPanelOptions = (options: unknown): options is PanelOptions => isObject(options);

const identity = (value: string) => value;
const noop = () => {};

/** `Panel` props with no size. The size comes from `el` when the Renderer draws. */
export type SpecPanelProps = Omit<PanelComponentProps, 'width' | 'height'>;

/**
 * The options and field config get the defaults of the plugin, as in Grafana (`getPanelOptionsWithDefaults`).
 * Then the field overrides are applied to the frames, as `VizPanel.applyFieldConfig` does in Grafana.
 * The panel gets no data links (`toSpecData` also removes them from the frames), no ad-hoc filter (`onAddAdHocFilter` is not set) and a time range change that does
 * nothing (`renderer.12`, `renderer.14`).
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/panel/getPanelOptionsWithDefaults.ts
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/field/fieldOverrides.ts
 */
export function toPanelProps(spec: VizSpec, entry: PanelEntry): SpecPanelProps {
  const theme = themeOf(spec.theme);
  const { options, fieldConfig } = getPanelOptionsWithDefaults({
    plugin: entry.plugin,
    currentOptions: spec.panel.options,
    currentFieldConfig: withoutCallOuts(spec.panel.fieldConfig),
    isAfterPluginChange: false,
  });
  if (!isPanelOptions(options)) {
    throw new Error(`The options of ${spec.panel.type} are not an object`);
  }
  const data = toSpecData(spec, entry);
  const series = applyFieldOverrides({
    data: data.series,
    fieldConfig,
    fieldConfigRegistry: entry.plugin.fieldConfigRegistry,
    replaceVariables: identity,
    theme,
    timeZone: spec.timeZone,
  });
  return {
    id: 1,
    title: '',
    family: entry.family,
    data: { ...data, series },
    timeRange: data.timeRange,
    timeZone: spec.timeZone,
    options,
    fieldConfig,
    transparent: false,
    renderCounter: 0,
    eventBus: new EventBusSrv(),
    replaceVariables: identity,
    onOptionsChange: noop,
    onFieldConfigChange: noop,
    onChangeTimeRange: noop,
  };
}
