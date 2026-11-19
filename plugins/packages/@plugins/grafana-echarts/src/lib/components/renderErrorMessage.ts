import { type ChartFamily } from 'lib/echarts/charts/autoSeriesType';

// The name of the chart kind of each family, for the error message.
const CHART_NAMES: Record<ChartFamily, string> = {
  cartesian: 'cartesian chart',
  heatmap: 'heatmap',
  'part-to-whole': 'part-to-whole chart',
  multivariate: 'multivariate chart',
  hierarchy: 'hierarchy chart',
  relations: 'relations chart',
  stream: 'stream chart',
  geo: 'geo map',
  gauge: 'gauge',
  timeline: 'state timeline',
  'status-history': 'status history',
};

/**
 * The message for a render error (viz contract 4.4, row 9). The Grafana panel and the standalone renderer show it.
 * The raw error text goes to the console only.
 */
export const renderErrorMessage = (family: ChartFamily) => `This data can't be shown as a ${CHART_NAMES[family]}.`;
