import {
  type DataFrame,
  FieldColorModeId,
  type FieldConfig,
  FieldType,
  type GrafanaTheme2,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { ThemeContext } from '@grafana/ui';
import { render } from '@testing-library/react';
import React from 'react';
import { SERIES_ZLEVEL } from 'test/canvas';
import { applyTestFieldConfig } from 'test/fieldConfig';
import { getComponent, getSeriesCanvasEvents } from 'test/panel';
import { type PanelOptions } from 'types';

// Shared harness of the gauge canvas and integration suites: it renders the real <Panel /> with the gauge
// family and reads the draw calls of the series layer. The gauge has no axis, so only that layer paints.

/** The options of each gauge render: the series on its own canvas layer, no animation, no legend. */
export const gaugeOptions = (extra: Partial<PanelOptions> = {}): Partial<PanelOptions> => ({
  zLevel: { series: SERIES_ZLEVEL },
  animation: { enabled: false },
  legend: { showLegend: false, displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] },
  ...extra,
});

/**
 * A field config with the range 0 to 100, the color from the thresholds, and three threshold steps: green,
 * orange from 60, red from 80. `extra` replaces keys.
 */
export const gaugeFieldConfig = (extra: FieldConfig = {}): FieldConfig => ({
  min: 0,
  max: 100,
  color: { mode: FieldColorModeId.Thresholds },
  thresholds: {
    mode: ThresholdsMode.Absolute,
    steps: [
      { value: -Infinity, color: 'green' },
      { value: 60, color: 'orange' },
      { value: 80, color: 'red' },
    ],
  },
  ...extra,
});

/**
 * A frame with one number field for each name. The last value of a field is the value of its gauge.
 *
 * The config is on the fields, not in the panel field config: the field config registry of the tests
 * (`test/fieldConfig.ts`) does not apply `min`, `max` or `thresholds` defaults.
 */
export const gaugeFrame = (fields: Record<string, Array<number | null>>, config: FieldConfig = gaugeFieldConfig()) =>
  toDataFrame({
    fields: Object.entries(fields).map(([name, values]) => ({ name, type: FieldType.number, values, config })),
  });

/**
 * Renders the gauge panel. With a `theme`, the panel and the display processors of the fields read that theme and
 * not the default dark theme, as in a host with that theme.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/themes/ThemeContext.tsx
 */
export const renderGauge = async (frames: DataFrame[], options: Partial<PanelOptions> = {}, theme?: GrafanaTheme2) => {
  const data = theme ? { series: applyTestFieldConfig(frames, undefined, theme) } : undefined;
  const panel = getComponent(frames, 'gauge', gaugeOptions(options), data, undefined, 'gauge');
  const { container } = render(theme ? <ThemeContext.Provider value={theme}>{panel}</ThemeContext.Provider> : panel);
  return getSeriesCanvasEvents(container);
};
