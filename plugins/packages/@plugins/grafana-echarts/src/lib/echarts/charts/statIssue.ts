import { type ChartDataIssue } from './types';

// Core gives this text when the frame has no field that the panel can use.
// https://github.com/grafana/grafana/blob/main/public/app/features/panel/components/PanelDataErrorView.tsx
const CORE_TEXT = 'Cannot visualize data.';

/** The fix steps for each stat data issue. */
export const STAT_ISSUE_MESSAGES = {
  'no-values': `${CORE_TEXT} Add a number field. To show text fields, set Value options > Fields to All Fields.`,
};

/**
 * The data issue of a stat panel that has frames but no value, else `undefined`.
 * `noValue` is the "No value" standard option. Core Stat shows its text in place of the values, so the issue
 * view shows it too, in place of the fix steps.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/#no-value
 */
export function getStatIssue(valueCount: number, noValue: string | undefined): ChartDataIssue | undefined {
  if (valueCount > 0) {
    return undefined;
  }
  return noValue
    ? { reason: 'no-values', message: noValue }
    : { reason: 'no-values', message: STAT_ISSUE_MESSAGES['no-values'], needsNumberField: true };
}
