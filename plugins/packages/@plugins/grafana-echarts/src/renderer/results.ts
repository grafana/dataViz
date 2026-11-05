import { type QueryResult } from './vizSpec';

/**
 * The entries of `data.results` in the order of `panel.targets` (`spec.11`, `state.18`). A result with no target
 * comes after them, in the key order of `data.results`. A target with no result is left out.
 */
export function orderedResults(
  targetRefIds: readonly string[],
  results: Record<string, QueryResult>
): Array<[refId: string, result: QueryResult]> {
  const keys = Object.keys(results);
  const ordered = [...new Set(targetRefIds)].filter((refId) => keys.includes(refId));
  const rest = keys.filter((refId) => !ordered.includes(refId));
  return [...ordered, ...rest].map((refId) => [refId, results[refId]]);
}
