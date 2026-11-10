import { type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import { frameToMultivariate } from 'lib/echarts/converters/multivariate';
import { isNumberField, isTimeField } from 'lib/grafana/narrowing';
import { getFieldShapeIssue, getTextNumberIssue } from './dataShape';
import { type ChartDataIssue } from './types';

/**
 * The fix that the too-few-axes message names:
 * - `merge`: more than one frame has a number field, for example one table query for each metric. The chart
 *   reads one frame, so the Merge transformation joins the queries.
 * - `transpose`: one frame with no time field has enough rows to give the axes, so it has one row for each axis.
 * - `add`: neither, so the query needs more number fields.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/
 */
type TooFewAxesFix = 'merge' | 'transpose' | 'add';

const TOO_FEW_AXES_FIX: Record<TooFewAxesFix, string> = {
  merge: 'To join the queries into one frame, add the Merge transformation.',
  transpose: 'To use one row for each axis, add the Transpose transformation.',
  add: 'Add number fields to the query.',
};

/** The fix steps for each multivariate data issue (#928). */
export const MULTIVARIATE_ISSUE_MESSAGES = {
  'too-few-axes': (chart: 'radar' | 'parallel', min: number, fix: TooFewAxesFix = 'add') =>
    `${chart === 'radar' ? 'Radar' : 'Parallel coordinates'} needs ${min} or more number fields. Each number field is one axis. ${TOO_FEW_AXES_FIX[fix]}`,
  'all-values-empty': 'All values are empty. Check the query, or the time range.',
};

// The fewest axes that draw a shape: a radar polygon needs 3, a parallel line needs 2.
const MIN_AXES = { radar: 3, parallel: 2 };

/**
 * The data issue of a multivariate frame, with the steps to fix it, else `undefined`.
 * The chart reads one axis for each number field and one polygon or line for each row.
 * Data plane: https://grafana.com/developers/dataplane/numeric
 */
export function getMultivariateIssue(
  frames: DataFrame[],
  theme: GrafanaTheme2,
  chart: 'radar' | 'parallel'
): ChartDataIssue | undefined {
  const shape = getFieldShapeIssue(frames, { number: true });
  if (shape) {
    return getTextNumberIssue(frames) ?? shape;
  }
  const model = frameToMultivariate(frames, theme, undefined);
  if (!model) {
    return undefined;
  }
  if (model.items.every(({ values }) => values.every((value) => value == null))) {
    return { reason: 'all-values-empty', message: MULTIVARIATE_ISSUE_MESSAGES['all-values-empty'] };
  }
  const min = MIN_AXES[chart];
  if (model.axes.length < min) {
    return {
      reason: 'too-few-axes',
      message: MULTIVARIATE_ISSUE_MESSAGES['too-few-axes'](chart, min, fixFor(frames, model.items.length, min)),
    };
  }
  return undefined;
}

/** The fix for too few axes; see `TooFewAxesFix`. */
function fixFor(frames: DataFrame[], rows: number, min: number): TooFewAxesFix {
  const numericFrames = frames.filter((frame) => frame.fields.some(isNumberField));
  if (numericFrames.length > 1) {
    return 'merge';
  }
  // A time series has one row for each timestamp, and Transpose would make each timestamp an axis.
  const hasTime = numericFrames.some((frame) => frame.fields.some(isTimeField));
  return !hasTime && rows >= min ? 'transpose' : 'add';
}
