import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { TextLink, useStyles2 } from '@grafana/ui';
import React, { memo } from 'react';

export const EmptyRecentList = memo(() => {
  const styles = useStyles2(getEmptyListStyles);
  const emptyRecentListText = t(
    'time-picker.content.empty-recent-list-info',
    "It looks like you haven't used this time picker before. As soon as you enter some time intervals, recently used intervals will appear here."
  );

  return (
    <div className={styles.container}>
      <div>
        <span>{emptyRecentListText}</span>
      </div>
      <Trans i18nKey="time-picker.content.empty-recent-list-docs">
        <div>
          <TextLink href="https://grafana.com/docs/grafana/latest/dashboards/time-range-controls" external>
            Read the documentation
          </TextLink>
          <span> to find out more about how to enter custom time ranges.</span>
        </div>
      </Trans>
    </div>
  );
});

export const getEmptyListStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: '12px',
    margin: '12px',

    'a, span': {
      fontSize: '13px',
    },
  }),
});

EmptyRecentList.displayName = 'EmptyRecentList';
