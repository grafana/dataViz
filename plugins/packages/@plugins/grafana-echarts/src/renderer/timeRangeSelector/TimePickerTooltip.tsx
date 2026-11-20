import { dateTimeFormat, type TimeRange } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { type TimeZone } from '@grafana/schema';
import { Stack, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
import { getLabelStyles } from './pickerLabelHelpers';
import { TimeZoneDescription } from './TimeZoneDescription';
import { getTimeZoneTitle } from './TimeZoneTitle';
import { getTimeZoneDisplayInfo } from './timeZoneUtils';

export const TimePickerTooltip = ({ timeRange, timeZone }: { timeRange: TimeRange; timeZone?: TimeZone }) => {
  const styles = useStyles2(getLabelStyles);
  const [now] = useState(Date.now);

  // Get timezone info only if timeZone is provided
  const timeZoneInfo = timeZone ? getTimeZoneDisplayInfo(timeZone, now) : undefined;

  return (
    <Stack alignItems="center" direction="column" gap={0}>
      <div className="text-center">
        {dateTimeFormat(timeRange.from, { timeZone })}
        <div className="text-center">
          <Trans i18nKey="time-picker.range-picker.to">to</Trans>
        </div>
        {dateTimeFormat(timeRange.to, { timeZone })}
      </div>
      <div className={styles.container}>
        <span className={styles.utc}>{timeZoneInfo ? getTimeZoneTitle(timeZoneInfo) : ''}</span>
        <TimeZoneDescription info={timeZoneInfo} />
      </div>
    </Stack>
  );
};
