import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React from 'react';
import { TITLE_HEIGHT_PX } from './layout';

interface Props {
  /** `panel.title` of the viz spec. */
  title: string;
}

/**
 * `panel.title` above the chart, as the panel header of Grafana shows it (`renderer.17`): an `h6` line, cut with `…`
 * when it is wider than `el`, and the full title in the `title` attribute for hover. React puts the title in a text
 * node, so markup in it shows as text.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/PanelChrome/PanelChrome.tsx
 */
export const RendererTitle = ({ title }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.header}>
      <h2 className={styles.text} title={title}>
        {title}
      </h2>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    alignItems: 'center',
    height: TITLE_HEIGHT_PX,
    padding: theme.spacing(0, 1),
  }),
  // `minWidth: 0` lets the flex item get narrower than its text, so the ellipsis shows.
  text: css({
    ...theme.typography.h6,
    minWidth: 0,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
