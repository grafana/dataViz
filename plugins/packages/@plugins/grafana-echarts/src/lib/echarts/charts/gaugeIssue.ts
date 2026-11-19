import { type DataFrame } from '@grafana/data';
import { isNumberField } from 'lib/grafana/narrowing';
import { findNumericTextField } from './dataShape';
import { type ChartDataIssue } from './types';

// Core gives this text when the frame has no field that the gauge can use.
// https://github.com/grafana/grafana/blob/main/public/app/features/panel/components/PanelDataErrorView.tsx
const CORE_TEXT = 'Cannot visualize data.';

/** The fix steps for each gauge data issue. */
export const GAUGE_ISSUE_MESSAGES = {
  'number-as-text': (name: string) =>
    `${CORE_TEXT} Field "${name}" has numbers as text. Add a Convert field type transformation to make it a number field.`,
  'number-field-missing': `${CORE_TEXT} Add a number field. Each number field is one gauge.`,
};

const hasNumberField = (frames: DataFrame[]) =>
  frames.some((frame) => frame.fields.some((field) => isNumberField(field) && field.values.length > 0));

/**
 * The data issue of the frames of a gauge panel, with the steps to fix it, else `undefined`.
 * Data plane: https://grafana.com/developers/dataplane/numeric
 */
export function getGaugeIssue(frames: DataFrame[]): ChartDataIssue | undefined {
  if (hasNumberField(frames)) {
    return undefined;
  }
  const textField = findNumericTextField(frames);
  return textField
    ? {
        reason: 'number-as-text',
        message: GAUGE_ISSUE_MESSAGES['number-as-text'](textField.name),
        needsNumberField: true,
      }
    : { reason: 'number-field-missing', message: GAUGE_ISSUE_MESSAGES['number-field-missing'], needsNumberField: true };
}
