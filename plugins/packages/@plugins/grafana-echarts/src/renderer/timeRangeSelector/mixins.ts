import { type GrafanaTheme2 } from '@grafana/data';

export function getFocusStyles(theme: GrafanaTheme2, inset?: boolean) {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  const boxShadowPlacement = inset ? (visualRefreshEnabled ? 1 : 2) : visualRefreshEnabled ? 3 : 4;
  const boxShadow = inset
    ? `inset 0 0 0px ${boxShadowPlacement}px ${theme.colors.accent.main}`
    : `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px ${boxShadowPlacement}px ${theme.colors.accent.main}`;

  return {
    // transparent dotted outline is set to show focus when forced-colors are active
    outline: '2px dotted transparent',
    outlineOffset: `${inset ? '-2px' : '2px'}`,
    boxShadow: boxShadow,
    transitionTimingFunction: `cubic-bezier(0.19, 1, 0.22, 1)`,
    transitionDuration: '0.2s',
    transitionProperty: 'box-shadow',
  };
}
