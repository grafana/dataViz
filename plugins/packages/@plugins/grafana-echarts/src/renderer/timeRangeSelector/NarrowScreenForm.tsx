import { css } from '@emotion/css';
import { type GrafanaTheme2, isDateTime, type TimeOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
import { TimePickerTitle } from './TimePickerTitle';
import { TimeRangeContent } from './TimeRangeContent';
import { TimeRangeList } from './TimeRangeList';
import { mapOptionToTimeRange } from './mapper';
import { getFocusStyles } from './mixins';
import { type NarrowScreenFormProps } from './selectorTypes';

export const NarrowScreenForm = (props: NarrowScreenFormProps) => {
  const { value, hideQuickRanges, onChange, timeZone, historyOptions = [], showHistory, onError, weekStart } = props;
  const styles = useStyles2(getNarrowScreenStyles);
  const isAbsolute = isDateTime(value.raw.from) || isDateTime(value.raw.to);
  const [collapsedFlag, setCollapsedFlag] = useState(!isAbsolute);
  const collapsed = hideQuickRanges ? false : collapsedFlag;

  const onChangeTimeOption = (timeOption: TimeOption) => {
    return onChange(mapOptionToTimeRange(timeOption, timeZone));
  };

  return (
    <fieldset>
      <div className={styles.header}>
        <button
          type={'button'}
          className={styles.expandButton}
          onClick={() => {
            if (!hideQuickRanges) {
              setCollapsedFlag(!collapsed);
            }
          }}
          data-testid={selectors.components.TimePicker.absoluteTimeRangeTitle}
          aria-expanded={!collapsed}
          aria-controls="expanded-timerange"
        >
          <TimePickerTitle>
            <Trans i18nKey="time-picker.absolute.title">Absolute time range</Trans>
          </TimePickerTitle>
          {!hideQuickRanges && <Icon name={!collapsed ? 'angle-up' : 'angle-down'} />}
        </button>
      </div>
      {!collapsed && (
        <div className={styles.body} id="expanded-timerange">
          <div className={styles.form}>
            <TimeRangeContent
              value={value}
              onApply={onChange}
              timeZone={timeZone}
              isFullscreen={false}
              onError={onError}
              weekStart={weekStart}
            />
          </div>
          {showHistory && (
            <TimeRangeList
              title={t('time-picker.absolute.recent-title', 'Recently used absolute ranges')}
              options={historyOptions}
              onChange={onChangeTimeOption}
              placeholderEmpty={null}
            />
          )}
        </div>
      )}
    </fieldset>
  );
};

export const getNarrowScreenStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    padding: '7px 9px 7px 9px',
  }),
  expandButton: css({
    backgroundColor: 'transparent',
    border: 'none',
    display: 'flex',
    width: '100%',

    '&:focus-visible': getFocusStyles(theme),
  }),
  body: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  form: css({
    padding: '7px 9px 7px 9px',
  }),
});
