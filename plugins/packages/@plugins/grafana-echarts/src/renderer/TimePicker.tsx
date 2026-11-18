import { type TimeRange } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';
import { TimeRangePicker } from '@grafana/ui';
import { zoomOutTimeRange } from 'lib/grafana/time/zoomOut';
import React from 'react';
import { type RefreshCause } from './refresh';
import {
  shiftTimeRange,
  type TimeRangeCause,
  toAbsoluteTimeRange,
  toRefreshRequest,
  toTimeRangeRequest,
} from './timeRangeRequest';

const noop = () => {};

interface Props {
  /** `data.range` of the viz spec. */
  value: TimeRange;
  timeZone: TimeZone;
  onRequest: (cause: RefreshCause) => void;
  onPick: (cause: TimeRangeCause) => void;
}

/**
 * The time picker (`refresh.3`). A pick, a move or a zoom out asks the App for new data with `onRefresh`. The time
 * zone comes from the viz spec, so a change of it in the picker does nothing.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/DateTimePickers/TimeRangePicker.tsx
 */
export const TimePicker = ({ value, timeZone, onRequest, onPick }: Props) => {
  const range = toAbsoluteTimeRange(value);
  return (
    <TimeRangePicker
      value={value}
      timeZone={timeZone}
      onChange={(range) => onPick(toRefreshRequest(range))}
      onMoveBackward={() => onRequest(toTimeRangeRequest(shiftTimeRange(range, -1)))}
      onMoveForward={() => onRequest(toTimeRangeRequest(shiftTimeRange(range, 1)))}
      onZoom={() => onRequest(toTimeRangeRequest(zoomOutTimeRange(range)))}
      onChangeTimeZone={noop}
    />
  );
};
