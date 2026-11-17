import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
import {
  GAUGE_BAR_WIDTH_FACTOR_DEFAULT,
  GAUGE_BAR_WIDTH_FACTOR_MAX,
  GAUGE_BAR_WIDTH_FACTOR_MIN,
  GAUGE_CALC_DEFAULT,
  GAUGE_SHAPE_DEFAULT,
  GAUGE_SHOW_THRESHOLD_MARKERS_DEFAULT,
  GAUGE_TEXT_MODE_DEFAULT,
} from 'editor/gauge';
import { type GaugeShape, type GaugeTextMode } from 'editor/types';
import { type GaugeValue, resolveGaugeValues } from 'lib/echarts/converters/gauge';
import { createBaseOptions } from 'lib/echarts/options/base';
import { type GaugeItem, type GaugeStyle, getGaugeAngles, getGaugeSeries } from 'lib/echarts/options/gauge';
import { DEFAULT_CHART_LEGEND } from 'lib/echarts/options/legend';
import { applyPercentUnitRange, resolveFieldDisplays } from 'lib/grafana/fieldDisplays';
import {
  GAUGE_CELL_SPACING,
  layoutGaugeGeometry,
  layoutGaugeText,
  resolveGaugeTextParts,
} from 'lib/grafana/gauge/layout';
import { layoutRepeaterCells, type RepeaterCell } from 'lib/grafana/repeater/layout';
import { type PanelOptions } from 'types';
import { getGaugeIssue } from './gaugeIssue';
import { type BaseOptionParts, type ChartContext, type ChartModule, type EChartGaugeSeriesOption } from './types';

// Gauge chart family: one gauge for each value of the panel, all in one ECharts instance.
//
// The data flow has four steps, and this file only joins them:
// 1. Grafana reduces the frames to values (`resolveFieldDisplays`).
// 2. The values become the plain gauge model (`resolveGaugeValues`).
// 3. The panel is split into cells, and each gauge gets its pixel layout (`layoutRepeaterCells`, `layoutGauge*`).
// 4. The model and the layout become ECharts gauge series (`getGaugeSeries`).

/** The gauge options of the panel, with the defaults applied. */
interface GaugeRenderOptions {
  shape: GaugeShape;
  barWidthFactor: number;
  textMode: GaugeTextMode;
  showThresholdMarkers: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function resolveRenderOptions(options: PanelOptions): GaugeRenderOptions {
  return {
    shape: options.shape ?? GAUGE_SHAPE_DEFAULT,
    barWidthFactor: clamp(
      options.barWidthFactor ?? GAUGE_BAR_WIDTH_FACTOR_DEFAULT,
      GAUGE_BAR_WIDTH_FACTOR_MIN,
      GAUGE_BAR_WIDTH_FACTOR_MAX
    ),
    textMode: options.textMode ?? GAUGE_TEXT_MODE_DEFAULT,
    showThresholdMarkers: options.showThresholdMarkers ?? GAUGE_SHOW_THRESHOLD_MARKERS_DEFAULT,
  };
}

/** The gauge model of the panel data. */
export function resolveGaugeModel(ctx: ChartContext): GaugeValue[] {
  const displays = resolveFieldDisplays({
    frames: applyPercentUnitRange(ctx.frames, ctx.theme),
    fieldConfig: ctx.fieldConfig,
    reduceOptions: ctx.options.reduceOptions,
    defaultCalc: GAUGE_CALC_DEFAULT,
    replaceVariables: ctx.replaceVariables,
    theme: ctx.theme,
    timeZone: ctx.timeZone,
  });
  return resolveGaugeValues(displays, ctx.theme);
}

/** The colors of core Gauge. https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/RadialGauge/RadialBar.tsx */
function resolveGaugeStyle(theme: GrafanaTheme2, showValue: boolean): GaugeStyle {
  return {
    trackColor: colorManipulator.emphasize(theme.components.panel.background, 0.07),
    valueTextColor: theme.colors.text.primary,
    // The name is the second text when the value shows, and the main text when it does not.
    nameTextColor: showValue ? theme.colors.text.secondary : theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily,
  };
}

const longest = (texts: string[]) => texts.reduce((a, b) => (b.length > a.length ? b : a), '');

/** The layout of each gauge in its cell. All gauges get the same font sizes. */
function layoutGaugeItems(
  values: GaugeValue[],
  cells: RepeaterCell[],
  render: GaugeRenderOptions,
  fontFamily: string
): GaugeItem[] {
  const valueText = longest(values.map((value) => value.text));
  const nameText = longest(values.map((value) => value.name));

  return values.map((value, index) => {
    const cell = cells[index];
    // A gauge with no threshold step has no band to show.
    const showBand = render.showThresholdMarkers && value.thresholds.length > 0;
    const geometry = layoutGaugeGeometry(cell.width, cell.height, render.shape, render.barWidthFactor, showBand);
    const parts = resolveGaugeTextParts(render.textMode, values.length, value.hasDisplayName);
    return {
      value,
      center: [cell.x + geometry.centerX, cell.y + geometry.centerY],
      geometry,
      text: layoutGaugeText({ geometry, shape: render.shape, parts, valueText, nameText, fontFamily }),
    };
  });
}

export const gaugeChartModule: ChartModule = {
  // A gauge shows its name in its center, so the panel has no legend.
  legend: { ...DEFAULT_CHART_LEGEND, showLegend: false },

  getDataIssue(ctx) {
    return getGaugeIssue(ctx.frames);
  },

  // Core Gauge has no tooltip.
  getTooltipOption: () => ({ show: false }),

  buildOption(ctx: ChartContext, { plotWidth, plotHeight }: BaseOptionParts): EChartGaugeSeriesOption | null {
    const values = resolveGaugeModel(ctx);
    const cells = layoutRepeaterCells(plotWidth ?? 0, plotHeight ?? 0, values.length, GAUGE_CELL_SPACING);
    // No value, or no space to draw in.
    if (cells.length === 0) {
      return null;
    }

    const render = resolveRenderOptions(ctx.options);
    // The display name of a field changes only whether the name shows, so one answer is correct for all gauges.
    const showValue = resolveGaugeTextParts(render.textMode, values.length, false).showValue;
    const style = resolveGaugeStyle(ctx.theme, showValue);
    const context = { angles: getGaugeAngles(render.shape), style, zlevel: ctx.options.zLevel?.series };

    return {
      ...createBaseOptions(),
      series: layoutGaugeItems(values, cells, render, style.fontFamily).flatMap((item) =>
        getGaugeSeries(item, context)
      ),
    };
  },

  buildLegendItems: () => [],
};
