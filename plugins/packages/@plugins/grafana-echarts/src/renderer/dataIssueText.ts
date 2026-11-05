import { t } from '@grafana/i18n';
import { type PanelDataErrorViewProps } from '@grafana/runtime';

/**
 * The text of the error view that a panel shows for a data issue. With a `needs*` flag, the panel gives no message,
 * and Grafana gives its own text for the missing field type.
 * https://github.com/grafana/grafana/blob/main/public/app/features/panel/components/PanelDataErrorView.tsx
 */
export function dataIssueText(props: PanelDataErrorViewProps): string {
  if (props.message) {
    return props.message;
  }
  if (props.needsTimeField) {
    return t('renderer.data-issue.needs-time-field', 'Data is missing a time field');
  }
  if (props.needsNumberField) {
    return t('renderer.data-issue.needs-number-field', 'Data is missing a number field');
  }
  if (props.needsStringField) {
    return t('renderer.data-issue.needs-string-field', 'Data is missing a string field');
  }
  return t('renderer.data-issue.cannot-visualize', 'Cannot visualize data');
}
