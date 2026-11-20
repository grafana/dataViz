import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import React, { memo, type PropsWithChildren } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    text: css({
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      margin: 0,
      display: 'flex',
    }),
  };
};

export const TimePickerTitle = memo<PropsWithChildren<{}>>(({ children }) => {
  const styles = useStyles2(getStyles);

  return <h3 className={styles.text}>{children}</h3>;
});

TimePickerTitle.displayName = 'TimePickerTitle';
