import { ReducerID, type SelectableValue } from '@grafana/data';
import { type GaugeSeriesType, type GaugeShape, type GaugeTextMode } from 'editor/types';

// Editor constants of the gauge family. The option paths and the defaults are those of the core Gauge panel,
// so the options of a core panel keep their meaning.
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/gauge/panelcfg.cue

/** The series types that the gauge family routes on. */
export const gaugeSeriesTypes: GaugeSeriesType[] = ['gauge'];

/** The editor category of the gauge options. */
export const gaugeCategoryName = 'Gauge';

/** The default reducer, as core Stat and Gauge. */
export const GAUGE_CALC_DEFAULT: string = ReducerID.lastNotNull;

export const gaugeShapePath = 'shape';
export const GAUGE_SHAPE_DEFAULT: GaugeShape = 'gauge';
export const gaugeShapeOptions: Array<SelectableValue<GaugeShape>> = [
  { value: 'circle', label: 'Circle', icon: 'circle' },
  { value: 'gauge', label: 'Arc', icon: 'tachometer-empty' },
];

export const gaugeBarWidthFactorPath = 'barWidthFactor';
export const GAUGE_BAR_WIDTH_FACTOR_DEFAULT = 0.5;
export const GAUGE_BAR_WIDTH_FACTOR_MIN = 0.1;
export const GAUGE_BAR_WIDTH_FACTOR_MAX = 1;

export const gaugeTextModePath = 'textMode';
export const GAUGE_TEXT_MODE_DEFAULT: GaugeTextMode = 'auto';
export const gaugeTextModeOptions: Array<SelectableValue<GaugeTextMode>> = [
  { value: 'auto', label: 'Auto' },
  { value: 'value_and_name', label: 'Value and name' },
  { value: 'value', label: 'Value' },
  { value: 'name', label: 'Name' },
  { value: 'none', label: 'None' },
];

export const gaugeShowThresholdMarkersPath = 'showThresholdMarkers';
export const GAUGE_SHOW_THRESHOLD_MARKERS_DEFAULT = true;
