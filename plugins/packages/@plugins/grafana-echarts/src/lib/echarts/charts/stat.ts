import { type FieldDisplay, ReducerID } from '@grafana/data';
import { BigValueGraphMode } from '@grafana/schema';
import { resolveStatOptions } from 'editor/stat';
import { DEFAULT_CHART_LEGEND } from 'lib/echarts/options/legend';
import { getStatSeries } from 'lib/echarts/options/stat';
import { getNoTooltipOption } from 'lib/echarts/tooltip/option';
import { getDisplayLinks } from 'lib/grafana/dataLinks';
import { resolveFieldDisplays } from 'lib/grafana/fieldDisplays';
import { getStatAccessibleText } from 'lib/grafana/stat/accessibleText';
import { layoutStatCells, resolveStatTextMode } from 'lib/grafana/stat/layout';
import { applyGlobalFieldRange } from 'lib/grafana/stat/range';
import { getStatIssue } from './statIssue';
import { type ChartContext, type ChartModule, type EChartStatOption } from './types';

/**
 * Stat chart family: one cell for each value, with the value as large text, its name, and a sparkline.
 * It is the core Stat panel on the ECharts canvas.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/
 *
 * The data flow has three steps, and this file only composes them:
 * 1. `resolveStatDisplays`: Grafana reduces the frames to one `FieldDisplay` for each value.
 * 2. `layoutStatCells` (`lib/grafana/stat/layout.ts`): the position, size and color of each part, in pixels.
 * 3. `getStatSeries` (`lib/echarts/options/stat.ts`): one `custom` series that draws the cells.
 */
function resolveStatDisplays(ctx: ChartContext): FieldDisplay[] {
  return resolveFieldDisplays({
    frames: applyGlobalFieldRange(ctx.frames, ctx.theme, ctx.timeZone),
    fieldConfig: ctx.fieldConfig,
    reduceOptions: ctx.options.reduceOptions,
    defaultCalc: ReducerID.lastNotNull,
    replaceVariables: ctx.replaceVariables,
    theme: ctx.theme,
    timeZone: ctx.timeZone,
    sparkline: resolveStatOptions(ctx.options).graphMode !== BigValueGraphMode.None,
    percentChange: resolveStatOptions(ctx.options).showPercentChange,
  });
}

export const statChartModule: ChartModule = {
  // The panel has no legend: each cell shows the name of its value.
  legend: { ...DEFAULT_CHART_LEGEND, showLegend: false },

  getDataIssue(ctx) {
    return getStatIssue(resolveStatDisplays(ctx).length, ctx.fieldConfig.defaults.noValue);
  },

  // Core Stat has no tooltip.
  getTooltipOption: getNoTooltipOption,

  // The name and the value of each cell, which core Stat has as DOM text.
  getAccessibleText(ctx) {
    return getStatAccessibleText(resolveStatDisplays(ctx));
  },

  // One supplier for each value, in the order of the data items of the series.
  getDataLinks(ctx) {
    return resolveStatDisplays(ctx).map((display) => () => getDisplayLinks(display));
  },

  buildOption(ctx): EChartStatOption | null {
    const values = resolveStatDisplays(ctx);
    if (values.length === 0) {
      return null;
    }
    const { theme, timeRange, fieldConfig } = ctx;
    const statOptions = resolveStatOptions(ctx.options);
    const options = {
      ...statOptions,
      textMode: resolveStatTextMode(statOptions.textMode, Boolean(fieldConfig.defaults.displayName), ctx.panelTitle),
    };

    return {
      series: [
        getStatSeries({
          count: values.length,
          layout: (width, height) => layoutStatCells({ width, height, values, options, theme, timeRange }),
          fontFamily: theme.typography.fontFamily,
          zlevel: ctx.options.zLevel?.series,
        }),
      ],
    };
  },

  buildLegendItems() {
    return [];
  },
};
