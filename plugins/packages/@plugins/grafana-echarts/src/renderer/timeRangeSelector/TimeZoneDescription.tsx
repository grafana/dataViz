import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { type TimeZoneDisplayInfo } from './timeZoneUtils';

interface Props {
  info?: Pick<TimeZoneDisplayInfo, 'abbreviation'>;
}

export const TimeZoneDescription = ({ info }: Props) => {
  const styles = useStyles2(getStyles);

  if (!info || !info.abbreviation) {
    return null;
  }

  return <div className={styles.description}>{info.abbreviation}</div>;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    description: css({
      fontWeight: 'normal',
      fontSize: theme.typography.size.sm,
      color: theme.colors.text.secondary,
      whiteSpace: 'normal',
      textOverflow: 'ellipsis',
    }),
  };
};
