// The props of `Panel` for a viz spec, made as Grafana makes them for a panel JSON (`spec.10`).
import {
  applyFieldOverrides,
  createTheme,
  EventBusSrv,
  getPanelOptionsWithDefaults,
  type GrafanaTheme2,
} from '@grafana/data';
import { type AnnotateRequest } from '@grafana/viz-contract/renderer-api';
import { seriesTypePath } from 'editor/constants';
import { resolveSeriesType } from 'lib/echarts/charts/autoSeriesType';
import { isMultiValueSeriesType } from 'lib/echarts/charts/narrowing';
import { resolveChartModule } from 'lib/echarts/charts/registry';
import { hasAnnotationAxis } from 'lib/echarts/options/panelOption';
import { type PanelComponentProps } from 'lib/components/types';
import { applyLegendOverrides, type LegendOverrides, readLegendChange } from 'lib/grafana/fields/seriesConfig';
import { type PanelOptions } from 'types';
import { withoutCallOuts } from './callOuts';
import { isObject } from './parseSpec';
import { type PanelEntry } from './panels';
import { MAX_SERIES } from './registry';
import { savedAnnotationsFrame } from './savedAnnotations';
import { toSpecData } from './toPanelData';
import { TRUNCATED_FAMILIES, truncateSeries } from './truncateSeries';
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

/**
 * The legend changes of the user: the state to draw with, and where one new change goes (`renderer.34`,
 * `renderer.35`). The owner of the hook merges the change into the state.
 */
export interface LegendHook {
  overrides?: LegendOverrides;
  onChange: (change: LegendOverrides) => void;
}

/** `Panel` props with no size. The size comes from `el` when the Renderer draws. */
export type SpecPanelProps = Omit<PanelComponentProps, 'width' | 'height'>;

/**
 * The options and field config get the defaults of the plugin, as in Grafana (`getPanelOptionsWithDefaults`).
 * Then the field overrides are applied to the frames, as `VizPanel.applyFieldConfig` does in Grafana.
 * The Renderer removes links and actions from the spec and frames. Only the Renderer can add Ask in chat (`renderer.12`).
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/panel/getPanelOptionsWithDefaults.ts
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/field/fieldOverrides.ts
 */
export const toPanelProps = (spec: VizSpec, entry: PanelEntry): SpecPanelProps => preparePanel(spec, entry).props;

/**
 * `toPanelProps`, and the number of series that the `series-truncated` cut leaves out (`state.19`). The cut runs
 * before the field overrides, only for the families of `TRUNCATED_FAMILIES`. A candlestick or boxplot is not cut: it
 * draws one series from several number fields of the first frame, as `PanelContent` resolves the series type.
 * `savedAnnotations` draw with the annotations of the viz spec (`renderer.63`). `timeAxis` is true if the chart has
 * a time axis for the Add annotation UI (`renderer.49`).
 */
export function preparePanel(
  spec: VizSpec,
  entry: PanelEntry,
  legend?: LegendHook,
  savedAnnotations: readonly AnnotateRequest[] = []
): { props: SpecPanelProps; omittedSeries: number; timeAxis: boolean } {
  const theme = themeOf(spec.theme);
  const { options, fieldConfig: specFieldConfig } = getPanelOptionsWithDefaults({
    plugin: entry.plugin,
    currentOptions: spec.panel.options,
    currentFieldConfig: withoutCallOuts(spec.panel.fieldConfig),
    isAfterPluginChange: false,
  });
  // `renderer.35`: the legend changes of the user win over the overrides of the viz spec.
  const fieldConfig = legend?.overrides ? applyLegendOverrides(specFieldConfig, legend.overrides) : specFieldConfig;
  if (!isPanelOptions(options)) {
    throw new Error(`The options of ${spec.panel.type} are not an object`);
  }
  const data = toSpecData(spec, entry);
  const seriesType = resolveSeriesType(options[seriesTypePath], data.series, entry.family);
  const multiValue = isMultiValueSeriesType(seriesType);
  const cut =
    TRUNCATED_FAMILIES.has(entry.family) && !multiValue
      ? truncateSeries(data.series, MAX_SERIES)
      : { series: data.series, omitted: 0 };
  const series = applyFieldOverrides({
    data: cut.series,
    fieldConfig,
    fieldConfigRegistry: entry.plugin.fieldConfigRegistry,
    replaceVariables: identity,
    theme,
    timeZone: spec.timeZone,
  });
  const annotations =
    savedAnnotations.length > 0 ? [...data.annotations, savedAnnotationsFrame(savedAnnotations)] : data.annotations;
  const props: SpecPanelProps = {
    id: 1,
    title: '',
    family: entry.family,
    data: { ...data, series, annotations },
    timeRange: data.timeRange,
    timeZone: spec.timeZone,
    options,
    fieldConfig,
    transparent: false,
    renderCounter: 0,
    eventBus: new EventBusSrv(),
    replaceVariables: identity,
    onOptionsChange: noop,
    // `renderer.34`: a legend action gives the new field config. The viz spec does not change.
    onFieldConfigChange: (next) => {
      const change = readLegendChange(next, fieldConfig);
      // A write that is not a legend change (the positions of a relations drag) does not draw again. A new draw sets
      // the positions of the viz spec, and the dragged node goes back.
      if (change.hide !== undefined || change.colors.size > 0) {
        legend?.onChange(change);
      }
    },
    onChangeTimeRange: noop,
  };
  // The same test as the chart makes for its Add annotation UI (`EChart`).
  const timeAxis = hasAnnotationAxis({ frames: series, seriesType, options }, resolveChartModule(seriesType));
  return { props, omittedSeries: cut.omitted, timeAxis };
}
