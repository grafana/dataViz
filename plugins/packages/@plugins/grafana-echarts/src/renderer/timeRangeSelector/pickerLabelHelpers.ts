import { css } from '@emotion/css';
import { dateMath, rangeUtil, type GrafanaTheme2, type TimeOption, type TimeRange } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';

export const formattedRange = (value: TimeRange, timeZone?: TimeZone, quickRanges?: TimeOption[]) => {
  const adjustedTimeRange = {
    to: dateMath.isMathString(value.raw.to) ? value.raw.to : value.to,
    from: dateMath.isMathString(value.raw.from) ? value.raw.from : value.from,
  };
  return rangeUtil.describeTimeRange(adjustedTimeRange, timeZone, quickRanges);
};

export const getLabelStyles = (theme: GrafanaTheme2) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  return {
    container: css({
      display: 'flex',
      alignItems: 'baseline',
      whiteSpace: 'nowrap',
      columnGap: theme.spacing(0.75),
    }),
    utc: css({
      color: visualRefreshEnabled ? theme.colors.tertiary.text : theme.colors.warning.text,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
};
