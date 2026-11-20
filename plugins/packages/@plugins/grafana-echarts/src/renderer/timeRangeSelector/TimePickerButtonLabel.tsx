import { rangeUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React, { memo } from 'react';
import { formattedRange, getLabelStyles } from './pickerLabelHelpers';
import { type TimeRangePickerProps } from './TimeRangePicker';

export const TimePickerButtonLabel = memo<LabelProps>(({ hideText, value, timeZone, quickRanges }) => {
  const styles = useStyles2(getLabelStyles);

  if (hideText) {
    return null;
  }

  return (
    <span className={styles.container} aria-live="polite" aria-atomic="true">
      <span>{formattedRange(value, timeZone, quickRanges)}</span>
      <span className={styles.utc}>{rangeUtil.describeTimeRangeAbbreviation(value, timeZone)}</span>
    </span>
  );
});

export type LabelProps = Pick<TimeRangePickerProps, 'hideText' | 'value' | 'timeZone' | 'quickRanges'>;

TimePickerButtonLabel.displayName = 'TimePickerButtonLabel';
