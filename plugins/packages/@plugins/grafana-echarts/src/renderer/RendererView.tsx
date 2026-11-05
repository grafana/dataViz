import { type GrafanaTheme2 } from '@grafana/data';
import { ThemeContext } from '@grafana/ui';
import { Panel } from 'lib/components/Panel';
import React from 'react';
import { type SpecPanelProps } from './toPanelProps';

interface Props {
  theme: GrafanaTheme2;
  panel: SpecPanelProps;
  width: number;
  height: number;
}

/**
 * The chart of a viz spec: `Panel` with the theme of the spec. `useTheme2` of `@grafana/ui` reads `ThemeContext`.
 * Not `plugin.panel`: that adds the tag search and the error view of Grafana (see `lib/components/LazyPanel.tsx`).
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/themes/ThemeContext.tsx
 */
export const RendererView = ({ theme, panel, width, height }: Props) => (
  <ThemeContext.Provider value={theme}>
    <div style={{ width, height }}>
      <Panel {...panel} width={width} height={height} />
    </div>
  </ThemeContext.Provider>
);
