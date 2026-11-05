import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

/**
 * The error message in place of the chart (`states.json`: "an error message in place of the chart"). Each line of
 * the message is one line on screen. The text is React text, so a hostile label stays text.
 */
export const RendererErrorView = ({ message }: { message: string }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.view} role="alert">
      {message.split('\n').map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  view: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
    width: '100%',
    height: '100%',
    padding: theme.spacing(1),
    color: theme.colors.text.secondary,
    textAlign: 'center',
    overflow: 'auto',
  }),
});
