import { type TimeRange, type TimeOption } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';
import { TimeRangePicker } from './timeRangeSelector/TimeRangePicker';
import React from 'react';
import { type TimeRangeCause, toRefreshRequest } from './timeRangeRequest';

// Presets for the embedded renderer. Custom durations remain available through search.
const quickRanges: TimeOption[] = [
  { from: 'now-5m', to: 'now', display: '5 minutes' },
  { from: 'now-15m', to: 'now', display: '15 minutes' },
  { from: 'now-30m', to: 'now', display: '30 minutes' },
  { from: 'now-1h', to: 'now', display: '1 hour' },
  { from: 'now-3h', to: 'now', display: '3 hours' },
  { from: 'now-6h', to: 'now', display: '6 hours' },
  { from: 'now-12h', to: 'now', display: '12 hours' },
  { from: 'now-24h', to: 'now', display: '24 hours' },
  { from: 'now-2d', to: 'now', display: '2 days' },
  { from: 'now-7d', to: 'now', display: '7 days' },
  { from: 'now-30d', to: 'now', display: '30 days' },
];

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
      quickRanges={quickRanges}
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
