/** The height of the Refresh and time picker bar, in px. The chart gets the height of `el` minus this height. */
export const TOOLBAR_HEIGHT_PX = 40;

/**
 * The height of the title above the chart, in px (`renderer.17`). It is the panel header height of Grafana:
 * `theme.spacing.gridSize * theme.components.panel.headerHeight`, 8 × 4. The chart gets the height of `el` minus
 * this height.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/PanelChrome/PanelChrome.tsx
 */
export const TITLE_HEIGHT_PX = 32;

/**
 * The space around the chart of a family that draws to the edge of its canvas, in px. It is the padding of a panel
 * in Grafana: `theme.spacing.gridSize * theme.components.panel.padding`, 8 × 1. The other families keep their own
 * space inside the canvas (the ECharts `grid`), so they get none.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/PanelChrome/PanelChrome.tsx
 */
const CHART_PADDING_PX: Record<string, number> = { gauge: 8 };

/** The space around the chart of `family`, in px. */
export const chartPadding = (family: string): number => CHART_PADDING_PX[family] ?? 0;
