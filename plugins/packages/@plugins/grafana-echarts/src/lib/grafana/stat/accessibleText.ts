// The text of the stat panel for assistive tools. Core Stat draws each cell as DOM text, which a screen reader
// reads. A canvas has no text, so the chart element gets this text as its accessible name. This file has no
// ECharts code.
// https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/img_role
import { type FieldDisplay, formattedValueToString } from '@grafana/data';
import { formatPercentChange, hasPercentChange } from './percentChange';

/**
 * One value as text: its name, its value with the prefix and the suffix, and its percent change when the panel
 * shows one. The text has the name and the value in each text mode, as core, which gives the part that a text
 * mode hides as a tooltip of the cell.
 */
function describeValue({ display, name }: FieldDisplay): string {
  const title = display.title || name;
  const value = formattedValueToString(display);
  const change = hasPercentChange(display.percentChange)
    ? `, change ${formatPercentChange(display.percentChange)}`
    : '';
  return `${title ? `${title}: ` : ''}${value}${change}`;
}

/** The accessible name of the panel: each value in the order of the cells. `undefined` for no value. */
export function getStatAccessibleText(values: FieldDisplay[]): string | undefined {
  return values.length > 0 ? values.map(describeValue).join('; ') : undefined;
}
