// The `RefreshRequest` of a time range pick (`refresh.3`), and the moves of the time picker buttons.
import { dateTime, type TimeRange, isDateTime } from '@grafana/data';
import { type RefreshRequest } from './contract/renderer-api';

/**
 * A relative pick keeps its relative text, for example `now-6h` and `now`, so a later refresh moves with the
 * clock. An absolute pick gives epoch milliseconds, as a string.
 * https://grafana.com/docs/grafana/latest/dashboards/use-dashboards/#set-dashboard-time-range
 */
export function toRefreshRequest(range: TimeRange): RefreshRequest {
  const raw = (value: TimeRange['raw']['from'], absolute: TimeRange['from']) =>
    isDateTime(value) ? String(value.valueOf()) : typeof value === 'string' ? value : String(absolute.valueOf());
  return { cause: 'timeRange', from: raw(range.raw.from, range.from), to: raw(range.raw.to, range.to) };
}

const absolute = (from: number, to: number): TimeRange => {
  const start = dateTime(from);
  const end = dateTime(to);
  return { from: start, to: end, raw: { from: start, to: end } };
};

/** The back and forward buttons move the range by half its length, as Grafana does. */
export function shiftTimeRange(range: TimeRange, direction: -1 | 1): TimeRange {
  const from = range.from.valueOf();
  const to = range.to.valueOf();
  const step = ((to - from) / 2) * direction;
  return absolute(from + step, to + step);
}

/** The zoom-out button doubles the range around its center, as Grafana does. */
export function zoomOutTimeRange(range: TimeRange): TimeRange {
  const from = range.from.valueOf();
  const to = range.to.valueOf();
  const half = (to - from) / 2;
  return absolute(from - half, to + half);
}
