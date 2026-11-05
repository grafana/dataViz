import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

/**
 * The view of the `no-data` state: "No data", or the `noValue` text of the field config, as Grafana does.
 * https://github.com/grafana/grafana/blob/main/public/app/features/panel/components/PanelDataErrorView.tsx
 */
export const NoDataView = ({ noValue }: { noValue?: string }) => {
  const styles = useStyles2(getStyles);
  return <div className={styles.view}>{noValue ?? t('renderer.no-data', 'No data')}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  view: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    color: theme.colors.text.secondary,
  }),
});
