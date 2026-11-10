import { createTheme, FieldType, toDataFrame } from '@grafana/data';
import { getMultivariateIssue, MULTIVARIATE_ISSUE_MESSAGES } from './multivariateIssue';

const theme = createTheme();

/** `rows` rows of `axes` number fields, named by a string field. */
const frame = (axes: number, rows = 2, value: (row: number) => number | null = (row) => row) =>
  toDataFrame({
    fields: [
      { name: 'host', type: FieldType.string, values: Array.from({ length: rows }, (_, i) => `h${i}`) },
      ...Array.from({ length: axes }, (_, axis) => ({
        name: `m${axis}`,
        type: FieldType.number,
        values: Array.from({ length: rows }, (_, i) => value(i)),
      })),
    ],
  });

describe('getMultivariateIssue', () => {
  it('needs 3 number fields for radar and 2 for parallel', () => {
    expect(getMultivariateIssue([frame(2)], theme, 'radar')).toEqual({
      reason: 'too-few-axes',
      message: MULTIVARIATE_ISSUE_MESSAGES['too-few-axes']('radar', 3),
    });
    expect(getMultivariateIssue([frame(2)], theme, 'parallel')).toBeUndefined();
    expect(getMultivariateIssue([frame(1, 1)], theme, 'parallel')?.message).toBe(
      MULTIVARIATE_ISSUE_MESSAGES['too-few-axes']('parallel', 2)
    );
  });

  it('tells to add number fields when the rows cannot give the axes', () => {
    expect(getMultivariateIssue([frame(2)], theme, 'radar')?.message).toBe(
      'Radar needs 3 or more number fields. Each number field is one axis. Add number fields to the query.'
    );
  });

  // Key/value data (one row for each metric) has enough rows to give the axes.
  it('names the Transpose transformation for data with one row for each axis', () => {
    expect(getMultivariateIssue([frame(1, 4)], theme, 'radar')?.message).toBe(
      'Radar needs 3 or more number fields. Each number field is one axis. To use one row for each axis, add the Transpose transformation.'
    );
  });

  // Three Prometheus instant table queries with no Merge: three frames, each with one `Value #X` field. The chart
  // reads the first frame only, and Transpose would draw one metric across the hosts.
  it('names the Merge transformation when more than one frame has a number field', () => {
    const query = (refId: string) =>
      toDataFrame({
        refId,
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 1, 1] },
          { name: 'instance', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: `Value #${refId}`, type: FieldType.number, values: [1, 2, 3] },
        ],
      });

    expect(getMultivariateIssue([query('A'), query('B'), query('C')], theme, 'radar')?.message).toBe(
      'Radar needs 3 or more number fields. Each number field is one axis. To join the queries into one frame, add the Merge transformation.'
    );
  });

  // Transpose would make each timestamp an axis.
  it('does not name Transpose for a time series', () => {
    const series = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
        { name: 'Value', type: FieldType.number, values: [1, 2, 3, 4, 5] },
      ],
    });

    expect(getMultivariateIssue([series], theme, 'radar')?.message).toBe(
      MULTIVARIATE_ISSUE_MESSAGES['too-few-axes']('radar', 3, 'add')
    );
  });

  it('gives the empty issue when all values are null', () => {
    expect(getMultivariateIssue([frame(3, 2, () => null)], theme, 'radar')).toEqual({
      reason: 'all-values-empty',
      message: MULTIVARIATE_ISSUE_MESSAGES['all-values-empty'],
    });
  });

  it('names a field with numbers as text', () => {
    const text = toDataFrame({ fields: [{ name: 'v', type: FieldType.string, values: ['1', '2', '3'] }] });
    expect(getMultivariateIssue([text], theme, 'radar')?.reason).toBe('number-field-has-text');
  });

  it('gives no issue for a valid radar frame', () => {
    expect(getMultivariateIssue([frame(3)], theme, 'radar')).toBeUndefined();
  });
});
