import { css } from '@emotion/css';
import { type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import React from 'react';
import { type RefreshRequest } from './contract/renderer-api';
import { TOOLBAR_HEIGHT_PX } from './layout';
import { RefreshButton } from './RefreshButton';
import { type RefreshStatus } from './refresh';
import { TimePicker } from './TimePicker';

interface Props {
  status: RefreshStatus;
  /** `data.range` of the viz spec. With no valid viz spec, there is no range and no time picker. */
  timeRange?: TimeRange;
  timeZone: TimeZone;
  onRequest: (request: RefreshRequest) => void;
}

/**
 * The bar with the time picker and the Refresh button (`refresh.1`). While a refresh is busy, both are disabled
 * (`refresh.4`): the pickers have no `disabled` prop, so a disabled `fieldset` disables their buttons.
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/fieldset#disabled
 */
export const RendererToolbar = ({ status, timeRange, timeZone, onRequest }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.bar}>
      <span className={styles.message} role="status" title={status.message}>
        {status.message}
      </span>
      <fieldset className={styles.controls} disabled={status.busy} aria-busy={status.busy}>
        {timeRange && <TimePicker value={timeRange} timeZone={timeZone} onRequest={onRequest} />}
        <RefreshButton busy={status.busy} onRequest={onRequest} />
      </fieldset>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    height: TOOLBAR_HEIGHT_PX,
    padding: theme.spacing(0, 0.5),
  }),
  message: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: theme.colors.warning.text,
  }),
  // `flex: none`: the controls keep their own width, and the message gets the rest.
  controls: css({
    display: 'flex',
    flex: 'none',
    gap: theme.spacing(1),
    margin: 0,
    padding: 0,
    border: 'none',
  }),
});
