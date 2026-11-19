import { timeHeader } from './timeHeader';
import { type TopLevelFormatterParams } from 'echarts/types/dist/shared';
import { fmtDuration } from 'lib/grafana/timeline/duration';
import { type TimelineLane, type TimelineModel, type TimelineSegment } from 'lib/grafana/timeline/types';
import { type TimelineTooltipContext, type TooltipModel } from 'lib/echarts/tooltip/types';

/** One drawn bar and the lane it belongs to, in series data order. */
export interface TimelineItem {
  lane: TimelineLane;
  laneIndex: number;
  segment: TimelineSegment;
}

/**
 * Per-bar tooltip for the timeline custom series, composed like core's
 * `StateTimelineTooltip` in Single mode: the start–end times in the header, the lane
 * row with the value and its colour swatch, then a "Duration" row. Status history
 * (`samples` mode) shows the sample time and the lane row only (`withDuration` false).
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/state-timeline/StateTimelineTooltip.tsx
 *
 * ECharts hands back the hovered item's `dataIndex` (item trigger), which indexes
 * `items` because the series data is encoded 1:1 from it.
 * https://echarts.apache.org/en/option.html#series-custom.tooltip
 */
export function buildTimelineTooltipModel(
  items: TimelineItem[],
  ctx: TimelineTooltipContext
): (params: TopLevelFormatterParams) => TooltipModel {
  return (params) => {
    const param = Array.isArray(params) ? params[0] : params;
    const item = param?.dataIndex != null ? items[param.dataIndex] : undefined;
    if (!item) {
      return { header: { label: '', value: '' }, rows: [] };
    }
    const { lane, segment } = item;
    const source = { field: lane.field, rowIndex: segment.rowIndex };
    const valueRow = { color: segment.color, label: lane.name, value: segment.text, source };

    if (ctx.mode === 'samples') {
      return { header: timeHeader(segment.start, ctx.timeZone), rows: [valueRow], source };
    }

    return {
      // Core puts a line break after the dash.
      header: timeHeader(segment.start, ctx.timeZone, segment.end),
      rows: [valueRow, { label: 'Duration', value: fmtDuration(segment.end - segment.start) }],
      source,
    };
  };
}

/**
 * The segment of a lane at `time`. Changes mode: the bar from `start` to `end`. Samples
 * mode: the cell of `cellWidth` milliseconds centred on its sample time.
 */
export function findTimelineSegment(lane: TimelineLane, time: number, cellWidth?: number): TimelineSegment | undefined {
  if (cellWidth == null) {
    return lane.segments.find((segment) => segment.start <= time && time < segment.end);
  }
  const half = cellWidth / 2;
  return lane.segments.find((segment) => Math.abs(time - segment.start) <= half);
}

/**
 * The "All" tooltip of the timeline, as core's `StateTimelineTooltip` in Multi mode:
 * the hovered time in the header, then one row per lane with the state at that time.
 * A lane with no state there (a gap) has no row. The `axis` trigger gives the hovered
 * time in `axisValue`, but only the bar nearest to it, so each lane is searched here.
 * https://echarts.apache.org/en/option.html#tooltip.formatter
 */
export function buildTimelineMultiTooltipModel(
  model: TimelineModel,
  ctx: TimelineTooltipContext,
  cellWidth?: number
): (params: TopLevelFormatterParams) => TooltipModel {
  return (params) => {
    const param = Array.isArray(params) ? params[0] : params;
    const time = param && 'axisValue' in param ? Number(param.axisValue) : NaN;
    if (Number.isNaN(time)) {
      return { header: { label: '', value: '' }, rows: [] };
    }
    const rows = model.lanes.flatMap((lane) => {
      const segment = findTimelineSegment(lane, time, cellWidth);
      if (!segment) {
        return [];
      }
      const source = { field: lane.field, rowIndex: segment.rowIndex };
      return [{ color: segment.color, label: lane.name, value: segment.text, source }];
    });
    return { header: timeHeader(time, ctx.timeZone), rows };
  };
}
