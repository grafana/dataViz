// The `series-truncated` cut (`state.10`). The Renderer draws the FIRST `maxSeries` series, in frame order and in
// field order. It does not pick the series with the largest peak values, as `state.10` says (decision 2 of the plan).
import { type DataFrame, FieldType } from '@grafana/data';

/** The families that raise `series-truncated` (decision 2 of the plan). The other families never cut series. */
export const TRUNCATED_FAMILIES = new Set(['cartesian', 'stream']);

/**
 * Keeps the first `max` number fields (series) of the frames, and every field that is not a number field. A frame
 * with no number field left is left out. `omitted` is the number of number fields that are not kept.
 */
export function truncateSeries(series: DataFrame[], max: number): { series: DataFrame[]; omitted: number } {
  let kept = 0;
  let omitted = 0;
  const frames = series.flatMap((frame) => {
    const hadNumbers = frame.fields.some((field) => field.type === FieldType.number);
    const fields = frame.fields.filter((field) => {
      if (field.type !== FieldType.number) {
        return true;
      }
      if (kept < max) {
        kept++;
        return true;
      }
      omitted++;
      return false;
    });
    const hasNumbers = fields.some((field) => field.type === FieldType.number);
    if (hadNumbers && !hasNumbers) {
      return [];
    }
    return [fields.length === frame.fields.length ? frame : { ...frame, fields }];
  });
  return omitted === 0 ? { series, omitted } : { series: frames, omitted };
}
