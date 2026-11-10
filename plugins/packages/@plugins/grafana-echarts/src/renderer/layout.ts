/** The height of the Refresh and time picker bar, in px. The chart gets the height of `el` minus this height. */
export const TOOLBAR_HEIGHT_PX = 40;

/**
 * The height of the title above the chart, in px (`renderer.17`). It is the panel header height of Grafana:
 * `theme.spacing.gridSize * theme.components.panel.headerHeight`, 8 × 4. The chart gets the height of `el` minus
 * this height.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/PanelChrome/PanelChrome.tsx
 */
export const TITLE_HEIGHT_PX = 32;
