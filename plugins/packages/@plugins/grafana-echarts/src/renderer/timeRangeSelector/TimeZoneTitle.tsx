import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import React, { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { type TimeZoneDisplayInfo } from './timeZoneUtils';

interface Props {
  title: string | ReactNode;
}

export const TimeZoneTitle = ({ title }: Props) => {
  const styles = useStyles2(getStyles);

  if (!title) {
    return null;
  }

  return <span className={styles.title}>{title}</span>;
};

export const getTimeZoneTitle = (info: Pick<TimeZoneDisplayInfo, 'name'>): string => {
  return info.name.split('/').at(-1)!.replace(/_/g, ' ');
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    title: css({
      fontWeight: theme.typography.fontWeightRegular,
      textOverflow: 'ellipsis',
    }),
  };
};
