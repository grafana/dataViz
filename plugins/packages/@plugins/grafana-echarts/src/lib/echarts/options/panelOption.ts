import { TooltipDisplayMode } from '@grafana/schema';
import { debug, LOG_LEVELS } from 'development';
import { type ECBasicOption } from 'echarts/types/dist/shared';
import { partToWholeSeriesTypes } from 'editor/pie';
import { panelTypeToAxis } from 'lib/echarts/axes/converters';
import { isHierarchySeriesType, isMultivariateSeriesType, isRelationsSeriesType } from 'lib/echarts/charts/narrowing';
import { resolveChartModule } from 'lib/echarts/charts/registry';
import { type BaseOptionParts, type ChartContext, type ChartModule } from 'lib/echarts/charts/types';
import { framesHaveTimeField } from 'lib/echarts/converters/frames';
import { isHistogramPanel } from 'lib/echarts/converters/histogram';
import { applyEditorModeDefaults } from 'lib/echarts/options/editorMode';
import { resolveAnimation } from 'lib/echarts/performance/resolvers';
import { getTimeBrushOption } from 'lib/echarts/timeBrush';
import { NOOP_TOOLTIP_SINK } from 'lib/echarts/tooltip/model';
import { type TooltipSink } from 'lib/echarts/tooltip/types';
import { getCrosshairAxisPointer, getNoTooltipOption } from 'lib/echarts/tooltip/option';
import { buildPanelTooltip } from 'lib/echarts/tooltip/panelTooltip';
import { stripHiddenValueFields } from 'lib/grafana/fields/fieldConfig';

/**
 * Assemble the full ECharts option a panel feeds to `setOption`.
 *
 * This is the React-free counterpart to `Panel.tsx`: it resolves the chart
 * module, builds its option, and layers on the tooltip and (for non-category
 * axes) crosshair axisPointer. Keeping the assembly here isolates the ECharts
 * option shape from the component (per AGENTS.md) and lets tests snapshot the
 * exact option the panel renders.
 *
 * Returns `null` when no chart module matches the series type or the module
 * derives no chart from the data, so the caller can leave the panel empty. A
 * response the family cannot read *at all* is a different case: the module throws
 * with an explanation, because a blank panel would hide a fixable problem (see
 * `frameToRelationsGraph`).
 */
export function buildPanelChartOption(
  rawCtx: ChartContext,
  { isGrafanaLegend, plotWidth, plotHeight, tooltipSink }: BaseOptionParts & { tooltipSink?: TooltipSink }
): ECBasicOption | null {
  const chartModule = resolveChartModule(rawCtx.seriesType);
  if (!chartModule) {
    debug('Invalid chart module', LOG_LEVELS.error, rawCtx);
    return null;
  }

  // Normalize options by editor mode for every family (before both the series
  // build and the `animation` read below) so Default mode renders the plain
  // chart regardless of any stored Advanced values. The dispatch is identity for
  // families with no Advanced tier, so this is a no-op for them (see
  // `applyEditorModeDefaults`). This generalizes what was the pie-only
  // `applyPartToWholeEditorModeDefaults`, which also closes the cartesian
  // normalization gap noted in `docs/performance.md`.
  const options = applyEditorModeDefaults(rawCtx.seriesType, rawCtx.options);

  // The React overlay's sink, threaded onto the context so per-series formatters
  // (pie/hierarchy/heatmap) emit through the same channel as the top-level one.
  const sink = tooltipSink ?? NOOP_TOOLTIP_SINK;

  // Drop value fields hidden via the legend visibility toggle before building.
  //
  // These families opt out and hide their own marks instead, for different reasons:
  //
  // - **part-to-whole** (pie/funnel slices — see `resolvePieSlices`) because its
  //   legend rows are frame *rows*, so the override names categories and never
  //   matches a field. Stripping would be actively wrong, not merely useless: the
  //   `byNames` matcher is in *exclude* mode, so a list of category names marks
  //   every real numeric field hidden and the stat column that sizes and colours
  //   the chart would be deleted.
  // - **hierarchy** (treemap/sunburst) for the same reason: its legend rows are
  //   top-level node names. It drops hidden roots in `toTreeData`.
  // - **multivariate** (radar/parallel) for the same reason as part-to-whole: its
  //   legend rows are frame rows, and its number fields are the axes. It drops
  //   hidden rows in `radarToEChartsOption` / `parallelToEChartsOption`.
  // - **relations** (graph/sankey/chord) because deleting a mark's column destroys
  //   the information its reader needs. A node's field carries the fact that it was
  //   hidden; remove the field and `frameToGraphWide` simply *re-derives* the node
  //   from the edges that still name it, so the node comes back. Hiding a node also
  //   has to take its incident edges with it, which is a graph question a
  //   column-level strip cannot express. Both happen in `withoutHiddenMarks`, off
  //   each mark's own `custom.hideFrom.viz`.
  //
  // Editor-mode normalization already ran generically above
  // (`applyEditorModeDefaults`), so both branches use the normalized `options`.
  // - **histogram** mode of the cartesian panel, because a hidden field still counts for the automatic
  //   bucket size, as core. The histogram hides the bars of the field (see `buildHistogramOption`).
  const hidesItsOwnMarks =
    partToWholeSeriesTypes.includes(rawCtx.seriesType) ||
    isRelationsSeriesType(rawCtx.seriesType) ||
    isHierarchySeriesType(rawCtx.seriesType) ||
    isMultivariateSeriesType(rawCtx.seriesType) ||
    isHistogramPanel(rawCtx.options);
  const ctx: ChartContext = hidesItsOwnMarks
    ? { ...rawCtx, tooltipSink: sink, options }
    : { ...rawCtx, tooltipSink: sink, options, frames: stripHiddenValueFields(rawCtx.frames, rawCtx.fieldConfig) };

  // Axis type is data-driven for the cartesian family: Numeric frames render on a category axis, which changes the tooltip trigger and drops the time crosshair.
  const hasTimeField = framesHaveTimeField(ctx.frames);
  const axisType = panelTypeToAxis(ctx, hasTimeField);
  const { option: tooltipOption, mode: tooltipMode } = buildPanelTooltip(ctx, chartModule, axisType);

  // No option means "nothing to draw from this data" — an empty response, or one
  // whose shape carries no chart. Every other family already falls back to the
  // no-data view for that, so this does too rather than throwing.
  const echartOption = chartModule.buildOption(ctx, { isGrafanaLegend, plotWidth, plotHeight });
  if (!echartOption) {
    debug('No chart option resolved', LOG_LEVELS.debug, ctx);
    return null;
  }

  const isPreview = options.isPreview === true;
  const previewSeries =
    isPreview && Array.isArray(echartOption.series)
      ? echartOption.series.map((series) => ({
          ...series,
          // Preview cards must not react to pointer events.
          // https://echarts.apache.org/en/option.html#series-silent
          silent: true,
          // https://echarts.apache.org/en/option.html#series-emphasis.disabled
          emphasis: { disabled: true },
        }))
      : undefined;

  // Only cartesian-grid charts (non-category axes) have an axis to draw the crosshair on.
  // @todo clean up nested ternary
  const axisPointer =
    axisType !== 'category'
      ? tooltipMode === TooltipDisplayMode.None
        ? getNoTooltipOption()
        : getCrosshairAxisPointer()
      : undefined;

  // The cursor is armed programmatically in useChartOption after `setOption`.
  const isTimeAxis = hasTimeBrush(ctx, chartModule, hasTimeField, axisType);

  return {
    ...echartOption,
    ...(previewSeries ? { series: previewSeries } : {}),
    tooltip: isPreview ? { show: false } : (chartModule.getTooltipOption?.(ctx) ?? tooltipOption),
    // Animation is opt-in and off by default for every family — density thresholds
    // were tried and could not fire early enough to help. See `resolveAnimation`.
    animation: isPreview ? false : resolveAnimation(ctx.options),
    ...(!isPreview && axisPointer ? { axisPointer } : {}),
    ...(!isPreview && isTimeAxis ? { brush: getTimeBrushOption(ctx.theme) } : {}),
  };
}

/**
 * Whether the chart has the time brush: drag-to-zoom, and the ctrl/cmd gestures that add an
 * annotation. It is only meaningful on a time axis, where the brush selection maps to an
 * absolute time range the dashboard can adopt. Families whose time axis is not a cartesian grid
 * axis opt out (see `ChartModule.disableTimeBrush`).
 */
export function hasTimeBrush(
  ctx: ChartContext,
  chartModule: ChartModule,
  hasTimeField = framesHaveTimeField(ctx.frames),
  axisType = panelTypeToAxis(ctx, hasTimeField)
): boolean {
  return hasTimeAxis(ctx, hasTimeField, axisType) && !chartModule.disableTimeBrush;
}

/** Whether the chart has a time x axis. A double click on such a chart zooms the time range out. */
export function hasTimeAxis(
  ctx: ChartContext,
  hasTimeField = framesHaveTimeField(ctx.frames),
  axisType = panelTypeToAxis(ctx, hasTimeField)
): boolean {
  return hasTimeField && axisType === 'time';
}
