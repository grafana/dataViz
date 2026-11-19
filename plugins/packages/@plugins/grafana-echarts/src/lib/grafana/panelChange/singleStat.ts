// The options that a single-value panel (stat, gauge) keeps in a change from each other panel type, as core.
// Core: `sharedSingleStatPanelChangedHandler` in
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/SingleStatShared/SingleStatBaseOptions.ts

/** The options of `SingleStatBaseOptions` that core keeps: the reduction of the data, and the orientation. */
const KEPT_OPTION_KEYS = ['reduceOptions', 'orientation'];

/**
 * A copy of each kept option that the options of the previous panel have. The result is empty when they have
 * none. Core Gauge and core Bar gauge have the two options, with the same values as the single-value panels.
 * Core has more rules for the Angular Singlestat and Graph panels, which Grafana does not have now: this
 * function does not have them.
 */
export function keepSingleStatOptions(prevOptions: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    KEPT_OPTION_KEYS.filter((key) => prevOptions[key] !== undefined).map((key) => [
      key,
      structuredClone(prevOptions[key]),
    ])
  );
}
