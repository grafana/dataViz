import { type TimeRange } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';
import { TimeRangePicker } from '@grafana/ui';
import React from 'react';
import { type RefreshRequest } from './contract/renderer-api';
import { shiftTimeRange, toRefreshRequest, zoomOutTimeRange } from './timeRangeRequest';

const noop = () => {};

interface Props {
  /** `data.range` of the viz spec. */
  value: TimeRange;
  timeZone: TimeZone;
  onRequest: (request: RefreshRequest) => void;
}

/**
 * The time picker (`refresh.3`). A pick, a move or a zoom out asks the App for new data with `onRefresh`. The time
 * zone comes from the viz spec, so a change of it in the picker does nothing.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/DateTimePickers/TimeRangePicker.tsx
 */
export const TimePicker = ({ value, timeZone, onRequest }: Props) => (
  <TimeRangePicker
    value={value}
    timeZone={timeZone}
    onChange={(range) => onRequest(toRefreshRequest(range))}
    onMoveBackward={() => onRequest(toRefreshRequest(shiftTimeRange(value, -1)))}
    onMoveForward={() => onRequest(toRefreshRequest(shiftTimeRange(value, 1)))}
    onZoom={() => onRequest(toRefreshRequest(zoomOutTimeRange(value)))}
    onChangeTimeZone={noop}
  />
);
