// The `RefreshRequest` of a time range pick (`refresh.3`), and the moves of the time picker buttons.
import { type AbsoluteTimeRange, type TimeRange, isDateTime } from '@grafana/data';
import { type RefreshCause } from './refresh';
import { type SpecTimeRange } from './vizSpec';

export type TimeRangeCause = Extract<RefreshCause, { cause: 'timeRange' }>;

export function toTimeRangeRequest({ from, to }: SpecTimeRange): TimeRangeCause {
  const serialize = (value: string | number) => (typeof value === 'number' ? String(Math.round(value)) : value);
  return { cause: 'timeRange', from: serialize(from), to: serialize(to) };
}

/**
 * A relative pick keeps its relative text, for example `now-6h` and `now`, so a later refresh moves with the
 * clock. An absolute pick gives epoch milliseconds, as a string.
 * https://grafana.com/docs/grafana/latest/dashboards/use-dashboards/#set-dashboard-time-range
 */
export function toRefreshRequest(range: TimeRange): TimeRangeCause {
  const raw = (value: TimeRange['raw']['from'], absolute: TimeRange['from']) =>
    isDateTime(value) ? String(value.valueOf()) : typeof value === 'string' ? value : String(absolute.valueOf());
  return { cause: 'timeRange', from: raw(range.raw.from, range.from), to: raw(range.raw.to, range.to) };
}

export function toAbsoluteTimeRange({ from, to }: TimeRange): AbsoluteTimeRange {
  return { from: from.valueOf(), to: to.valueOf() };
}

/** The back and forward buttons move the range by half its length, as Grafana does. */
export function shiftTimeRange({ from, to }: AbsoluteTimeRange, direction: -1 | 1): AbsoluteTimeRange {
  const step = ((to - from) / 2) * direction;
  return { from: from + step, to: to + step };
}
