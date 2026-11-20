import { css } from '@emotion/css';
import { type GrafanaTheme2, type TimeOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import React from 'react';
import { EmptyRecentList } from './EmptyRecentList';
import { TimePickerTitle } from './TimePickerTitle';
import { TimeRangeContent } from './TimeRangeContent';
import { TimeRangeList } from './TimeRangeList';
import { mapOptionToTimeRange } from './mapper';
import { type FullScreenFormProps } from './selectorTypes';

export const FullScreenForm = (props: FullScreenFormProps) => {
  const {
    onChange,
    value,
    timeZone,
    fiscalYearStartMonth,
    isReversed,
    historyOptions,
    onError,
    weekStart,
    calendarAnchor,
  } = props;
  const styles = useStyles2(getFullScreenStyles, props.hideQuickRanges);
  const onChangeTimeOption = (timeOption: TimeOption) => {
    return onChange(mapOptionToTimeRange(timeOption, timeZone));
  };

  return (
    <>
      <div className={styles.container}>
        <div className={styles.title} data-testid={selectors.components.TimePicker.absoluteTimeRangeTitle}>
          <TimePickerTitle>
            <Trans i18nKey="time-picker.absolute.title">Absolute time range</Trans>
          </TimePickerTitle>
        </div>
        <TimeRangeContent
          value={value}
          timeZone={timeZone}
          fiscalYearStartMonth={fiscalYearStartMonth}
          onApply={onChange}
          isFullscreen={true}
          calendarAnchor={calendarAnchor}
          isReversed={isReversed}
          onError={onError}
          weekStart={weekStart}
        />
      </div>
      {props.showHistory && (
        <div className={styles.recent}>
          <TimeRangeList
            title={t('time-picker.absolute.recent-title', 'Recently used absolute ranges')}
            options={historyOptions || []}
            onChange={onChangeTimeOption}
            placeholderEmpty={<EmptyRecentList />}
          />
        </div>
      )}
    </>
  );
};

export const getFullScreenStyles = (theme: GrafanaTheme2, hideQuickRanges?: boolean) => ({
  container: css({
    paddingTop: '9px',
    paddingLeft: '11px',
    paddingRight: !hideQuickRanges ? '20%' : '11px',
  }),
  title: css({
    marginBottom: '11px',
  }),
  recent: css({
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    paddingTop: theme.spacing(1),
  }),
});
