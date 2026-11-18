import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React from 'react';
import { ResetTimeRangeButton } from './ResetTimeRangeButton';

interface Props {
  onClick: () => void;
}

/** Reset in the top-right corner of the chart, for a Renderer with no toolbar. It must be in a positioned parent. */
export const ChartResetTimeRangeButton = ({ onClick }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.corner}>
      <ResetTimeRangeButton onClick={onClick} />
    </div>
  );
};

// https://grafana.com/developers/saga/styling/theme
const getStyles = (theme: GrafanaTheme2) => ({
  corner: css({
    position: 'absolute',
    top: theme.spacing(0.5),
    // Left of the notices of the panel, which are in the top-right corner (`ChartNotices`).
    right: theme.spacing(4),
  }),
});
