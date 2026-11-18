import { type ChartFamily } from './autoSeriesType';

/**
 * True for a family that draws each update of a query that streams. The other families draw nothing until the
 * query is done, so a chart with a layout (relations) does not make its layout again for each part of the
 * response.
 *
 * The stat family draws each update, as core Stat: a live data source streams with no end, and the panel
 * shows the last value. Its cells have fixed positions, so an update changes only the texts and the sparklines.
 * https://grafana.com/docs/grafana/latest/setup-grafana/set-up-grafana-live/
 */
export const drawsWhileStreaming = (family: ChartFamily): boolean => family === 'stat';
