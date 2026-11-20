import { css, cx } from '@emotion/css';
import { type GrafanaTheme2, isValidGrafanaDuration, rangeUtil, type TimeOption } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FilterInput, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState } from 'react';
import { CompactTimePickerContent } from './CompactTimePickerContent';
import { FullScreenForm } from './FullScreenForm';
import { NarrowScreenForm } from './NarrowScreenForm';
import { TimePickerFooter } from './TimePickerFooter';
import { TimeRangeList } from './TimeRangeList';
import { mapOptionToTimeRange } from './mapper';
import { getQuickOptions } from './options';
import { mapToHistoryOptions, useTimeOption } from './selectorHelpers';
import { type PropsWithScreenSize } from './selectorTypes';

export const TimeRangeSelectorWithScreenSize = (props: PropsWithScreenSize) => {
  const {
    quickOptions = getQuickOptions(),
    isReversed,
    isFullscreen,
    hideQuickRanges,
    timeZone,
    fiscalYearStartMonth,
    value,
    onChange,
    history,
    showHistory,
    className,
    hideTimeZone,
    onChangeTimeZone,
    onChangeFiscalYearStartMonth,
  } = props;
  const isHistoryEmpty = !history?.length;
  const isContainerTall =
    (isFullscreen && showHistory) || (!isFullscreen && ((showHistory && !isHistoryEmpty) || !hideQuickRanges));
  const styles = useStyles2(getStyles, isReversed, hideQuickRanges, isContainerTall, isFullscreen);
  const historyOptions = mapToHistoryOptions(history, timeZone);
  const baseTimeOption = useTimeOption(value.raw, quickOptions);
  const [searchTerm, setSearchQuery] = useState('');
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLDivElement | null>(null);

  const { filteredQuickOptions, customTimeOption } = useMemo(() => {
    const filtered = quickOptions.filter((o) => o.display.toLowerCase().includes(searchTerm.toLowerCase()));
    const customTimeOption = isValidGrafanaDuration(searchTerm) && rangeUtil.describeTextRange(searchTerm);

    if (customTimeOption) {
      const alreadyExists = filtered.some((o) => o.from === customTimeOption.from && o.to === customTimeOption.to);

      if (!alreadyExists) {
        return { filteredQuickOptions: [customTimeOption, ...filtered], customTimeOption };
      }
    }

    return { filteredQuickOptions: filtered, customTimeOption: undefined };
  }, [searchTerm, quickOptions]);

  const timeOption = customTimeOption || baseTimeOption;

  const onChangeTimeOption = (timeOption: TimeOption) => {
    return onChange(mapOptionToTimeRange(timeOption));
  };

  if (!isFullscreen && props.compactDesign === 'tabs') {
    return (
      <CompactTimePickerContent
        {...props}
        quickOptions={filteredQuickOptions}
        timeOption={timeOption}
        searchTerm={searchTerm}
        onSearch={setSearchQuery}
        historyOptions={historyOptions}
      />
    );
  }

  return (
    <div id="TimeRangeSelector" ref={setCalendarAnchor} className={cx(styles.container, className)}>
      <div className={styles.body}>
        {(!isFullscreen || !hideQuickRanges) && (
          <div className={styles.rightSide}>
            <div className={styles.timeRangeFilter}>
              <FilterInput
                width={0}
                value={searchTerm}
                onChange={setSearchQuery}
                escapeRegex={false}
                placeholder={t('time-picker.content.filter-placeholder', 'Search quick ranges')}
              />
            </div>
            <div className={styles.scrollContent}>
              {!isFullscreen && <NarrowScreenForm {...props} historyOptions={historyOptions} />}
              {!hideQuickRanges && (
                <TimeRangeList options={filteredQuickOptions} onChange={onChangeTimeOption} value={timeOption} />
              )}
            </div>
          </div>
        )}
        {isFullscreen && (
          <div className={styles.leftSide}>
            <FullScreenForm {...props} historyOptions={historyOptions} calendarAnchor={calendarAnchor} />
          </div>
        )}
      </div>
      {!hideTimeZone && isFullscreen && (
        <TimePickerFooter
          hideFiscalYear={props.hideFiscalYear}
          timeZone={timeZone}
          fiscalYearStartMonth={fiscalYearStartMonth}
          onChangeTimeZone={onChangeTimeZone}
          onChangeFiscalYearStartMonth={onChangeFiscalYearStartMonth}
        />
      )}
    </div>
  );
};

export const getStyles = (
  theme: GrafanaTheme2,
  isReversed?: boolean,
  hideQuickRanges?: boolean,
  isContainerTall?: boolean,
  isFullscreen?: boolean
) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  return {
    container: css({
      background: theme.colors.background.elevated,
      boxShadow: visualRefreshEnabled ? theme.shadows.z2 : theme.shadows.z3,
      width: `${isFullscreen ? '546px' : '262px'}`,
      borderRadius: theme.shape.radius.lg,
      border: `1px solid ${theme.colors.border.weak}`,
      [`${isReversed ? 'left' : 'right'}`]: 0,
      display: 'flex',
      flexDirection: 'column',
    }),
    body: css({
      display: 'flex',
      flexDirection: 'row-reverse',
      height: `${isContainerTall ? '381px' : '217px'}`,
      maxHeight: '100vh',
    }),
    leftSide: css({
      display: 'flex',
      flexDirection: 'column',
      borderRight: `${isReversed ? 'none' : `1px solid ${theme.colors.border.weak}`}`,
      width: `${!hideQuickRanges ? '60%' : '100%'}`,
      overflow: 'auto',
      scrollbarWidth: 'thin',
      order: isReversed ? 1 : 0,
    }),
    rightSide: css({
      width: `${isFullscreen ? '40%' : '100%'}; !important`,
      borderRight: isReversed ? `1px solid ${theme.colors.border.weak}` : 'none',
      display: 'flex',
      flexDirection: 'column',
    }),
    timeRangeFilter: css({
      padding: theme.spacing(1),
    }),
    spacing: css({
      marginTop: '16px',
    }),
    scrollContent: css({
      overflowY: 'auto',
      scrollbarWidth: 'thin',
    }),
  };
};
