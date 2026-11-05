// The notices of the Renderer (`state.7` to `state.11`): first the notices that the Renderer raises, then the
// notices of the viz spec.
import { type ChartNotice } from 'lib/echarts/charts/types';
import { type Notice } from './contract/renderer-api';
import { fillPattern, noticeMessage } from './messages';
import { MAX_SERIES } from './registry';
import { orderedResults } from './results';
import { isUnitId } from './units';
import { type VizSpec } from './vizSpec';

/**
 * The `series-truncated` message of the Renderer. It is not the `notices.json` message ("series with the smallest
 * peak values are not shown"): the Renderer draws the first `maxSeries` series, not the largest ones (decision 2 of
 * the plan, `state.10`). The follow-up issue "Renderer: choose the best series and add a show-all control for
 * series-truncated" changes the cut, and then this message goes back to the registry one.
 */
export const SERIES_TRUNCATED_PATTERN = '<omitted> series are not shown. The first <maxSeries> series are drawn.';

/** The notices that the Renderer raises, in the order of `notices.json`. `omittedSeries` comes from the cut. */
export function rendererNotices(spec: VizSpec, omittedSeries: number): Notice[] {
  const notices: Notice[] = [];

  // `query-failed`: one notice for each entry with an error, when another entry has no error. When each entry has
  // an error, the state is `all-queries-failed` and there are no notices.
  const results = orderedResults(spec.panel.targetRefIds, spec.data.results);
  const failed = results.filter(([, result]) => result.error !== undefined);
  if (failed.length > 0 && failed.length < results.length) {
    for (const [refId, result] of failed) {
      notices.push({
        code: 'query-failed',
        message: noticeMessage('query-failed', { refId, error: result.error ?? '' }),
      });
    }
  }

  const unit = spec.panel.fieldConfig.defaults.unit;
  if (typeof unit === 'string' && unit !== '' && !isUnitId(unit)) {
    notices.push({ code: 'unit-unknown', message: noticeMessage('unit-unknown', { unit }) });
  }

  if (omittedSeries > 0) {
    notices.push({
      code: 'series-truncated',
      message: fillPattern(SERIES_TRUNCATED_PATTERN, { omitted: omittedSeries, maxSeries: MAX_SERIES }),
    });
  }

  return notices;
}

/** The notices that the chart shows: the notices of the Renderer, then the notices of the viz spec (`state.7`). */
export const allNotices = (spec: VizSpec, omittedSeries: number): Notice[] => [
  ...rendererNotices(spec, omittedSeries),
  ...spec.notices,
];

/** The notice codes that show as a warning. The other codes (`unit-unknown`, the notices of the App) are info. */
const WARNING_CODES = new Set(['query-failed', 'series-truncated', 'geo-map-tiles', 'geo-offline-file']);

/** The notices as the badge of `ChartNotices` shows them. */
export const toChartNotices = (notices: Notice[]): ChartNotice[] =>
  notices.map((notice) => ({ severity: WARNING_CODES.has(notice.code) ? 'warning' : 'info', text: notice.message }));
