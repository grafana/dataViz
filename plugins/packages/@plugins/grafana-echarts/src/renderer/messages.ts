// Builds the messages of errors and notices from the patterns of the registries (`state.6`).
import notices from '@grafana/viz-contract/registry/notices.json';
import states from '@grafana/viz-contract/registry/states.json';
import { type ErrorCode } from './registry';

type Values = Record<string, string | number>;

/**
 * Replaces each `<name>` of `pattern` with `values[name]`. A value is not scanned again, so a value that contains
 * `<…>` (a label or an error text) stays as it is. A placeholder with no value stays in the text.
 */
export function fillPattern(pattern: string, values: Values): string {
  return pattern.replace(/<([^<>]+)>/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder
  );
}

/** The message pattern of a code of `states.json` (`errors` and `refresh`). */
function statePattern(code: string): string {
  const row = [...states.errors, ...states.refresh].find((item) => item.code === code);
  if (!row) {
    throw new Error(`${code} is not a code of states.json`);
  }
  return row.message;
}

/** The message of an error code (`state.6`). */
export const errorMessage = (code: ErrorCode, values: Values): string => fillPattern(statePattern(code), values);

/** The message of a refresh code of `states.json` (`refresh.5`). */
export const refreshMessage = (
  code: 'refresh-failed' | 'refresh-failed-no-detail' | 'refresh-timeout',
  values: Values = {}
) => fillPattern(statePattern(code), values);

/** The message of a notice code of `notices.json` (`state.7`). */
export function noticeMessage(code: string, values: Values): string {
  const row = notices.notices.find((item) => item.code === code);
  if (!row) {
    throw new Error(`${code} is not a code of notices.json`);
  }
  return fillPattern(row.message, values);
}
