import { type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import { frameToMultivariate } from 'lib/echarts/converters/multivariate';
import { getFieldShapeIssue, getTextNumberIssue } from './dataShape';
import { type ChartDataIssue } from './types';

/** The fix steps for each multivariate data issue (#928). */
export const MULTIVARIATE_ISSUE_MESSAGES = {
  // `transpose`: the frame has enough rows to give the axes, so the Transpose
  // transformation fixes data that has one row for each axis.
  // https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/#transpose
  'too-few-axes': (chart: 'radar' | 'parallel', min: number, transpose = false) =>
    `${chart === 'radar' ? 'Radar' : 'Parallel coordinates'} needs ${min} or more number fields. Each number field is one axis.` +
    (transpose
      ? ' To use one row for each axis, add the Transpose transformation.'
      : ' Add number fields to the query.'),
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
    const transpose = model.items.length >= min;
    return { reason: 'too-few-axes', message: MULTIVARIATE_ISSUE_MESSAGES['too-few-axes'](chart, min, transpose) };
  }
  return undefined;
}
