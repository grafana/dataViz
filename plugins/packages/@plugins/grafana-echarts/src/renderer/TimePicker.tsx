import { type TimeRange } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';
import { TimeRangePicker } from './timeRangeSelector/TimeRangePicker';
import React from 'react';
import { type TimeRangeCause, toRefreshRequest } from './timeRangeRequest';

const noop = () => {};

interface Props {
  /** `data.range` of the viz spec. */
  value: TimeRange;
  timeZone: TimeZone;
  onPick: (cause: TimeRangeCause) => void;
}

/**
 * The time picker (`refresh.3`). A selection asks the App for new data with `onRefresh`. The time
 * zone comes from the viz spec, so a change of it in the picker does nothing.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/DateTimePickers/TimeRangePicker.tsx
 */
export const TimePicker = ({ value, timeZone, onPick }: Props) => {
  return (
    <TimeRangePicker
      compactDesign="tabs"
      hideHistory
      hideTimeZone
      hideFiscalYear
      value={value}
      timeZone={timeZone}
      onChange={(picked) => onPick(toRefreshRequest(picked))}
      onChangeTimeZone={noop}
    />
  );
};
