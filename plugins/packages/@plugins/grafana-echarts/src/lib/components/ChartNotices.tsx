import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, Toggletip, Tooltip, useStyles2 } from '@grafana/ui';
import { type ChartNotice } from 'lib/echarts/charts/types';
import React from 'react';

interface Props {
  notices: ChartNotice[];
  /** The corner of the badge. The default is the top right, as the notices of the Grafana panel header. */
  corner?: 'top-left' | 'top-right';
}

/**
 * Panel-corner advisories for renders where the chart had to change the user's
 * data to draw it (today: the sankey cycle policy — see
 * `relationsChartModule.getNotices`).
 *
 * Mirrors what core's `PanelHeaderNotices` looks like — a hoverable severity icon,
 * not body text — because Grafana's real panel-chrome notice slot is not reachable
 * from a panel plugin: `PanelNoticesRenderer` builds it from
 * `sceneGraph.getData(model).useState()`, i.e. `DataFrame.meta.notices` on the
 * scene's data object, which the panel is handed read-only. Writing there would
 * mean mutating a prop and would not re-render the chrome anyway. So the badge is
 * rendered by the panel, pinned to the top-right of the viz area, and reads the
 * same as a chrome notice.
 *
 * @todo use the PanelContext notice API added in 13.3 and delete this
 */
export const ChartNotices: React.FC<Props> = ({ notices, corner = 'top-right' }) => {
  const styles = useStyles2(getStyles, corner);

  if (notices.length === 0) {
    return null;
  }

  const iconFor = (severity: ChartNotice['severity']) => (
    <Icon
      name={severity === 'warning' ? 'exclamation-triangle' : 'info-circle'}
      size="sm"
      className={severity === 'warning' ? styles.warning : styles.info}
    />
  );

  if (notices.length === 1) {
    const [notice] = notices;
    return (
      <div className={styles.wrapper}>
        <Tooltip content={notice.text} theme="info">
          {/* `tabIndex` so the notice is reachable (and its tooltip openable) by keyboard. */}
          <span className={styles.item} tabIndex={0} role="note" aria-label={notice.text}>
            {iconFor(notice.severity)}
          </span>
        </Tooltip>
      </div>
    );
  }

  // Two or more notices: one badge that opens the full list on click.
  // Toggletip: https://developers.grafana.com/ui/latest/index.html?path=/docs/overlays-toggletip--docs
  const label = `${notices.length} notices`;
  const list = (
    <ul className={styles.list} aria-label={label}>
      {notices.map((notice) => (
        <li key={`${notice.severity}:${notice.text}`} className={styles.listItem}>
          {iconFor(notice.severity)}
          <span>{notice.text}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={styles.wrapper}>
      <Toggletip content={list} placement="bottom-end" closeButton={false}>
        <button type="button" className={styles.button} aria-label={label}>
          {iconFor(notices.some((n) => n.severity === 'warning') ? 'warning' : 'info')}
        </button>
      </Toggletip>
      {/* Each text stays readable without a click, for screen readers. */}
      {notices.map((notice) => (
        <span
          key={`${notice.severity}:${notice.text}`}
          className={styles.srOnly}
          role="note"
          aria-label={notice.text}
        />
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, corner: NonNullable<Props['corner']>) => ({
  // Absolute so the badge overlays the chart rather than taking layout from it —
  // the panel body is sized by VizLayout and any reserved strip would shrink the
  // plot. `pointer-events: none` on the strip keeps chart hover working around
  // the icons, which re-enable it for themselves.
  wrapper: css({
    position: 'absolute',
    top: theme.spacing(0.5),
    ...(corner === 'top-left' ? { left: theme.spacing(0.5) } : { right: theme.spacing(0.5) }),
    display: 'flex',
    gap: theme.spacing(0.5),
    pointerEvents: 'none',
    zIndex: 1,
  }),
  item: css({
    pointerEvents: 'auto',
    display: 'inline-flex',
    cursor: 'help',
  }),
  button: css({
    pointerEvents: 'auto',
    display: 'inline-flex',
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
  }),
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  listItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  // Visually hidden, but in the accessibility tree.
  srOnly: css({
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
  }),
  warning: css({
    color: theme.colors.warning.text,
  }),
  info: css({
    color: theme.colors.info.text,
  }),
});
