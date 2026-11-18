// Typed access to the registries of the `@grafana/viz-contract` package. Messages and constants come from here only
// (design decision 2 of the plan). https://github.com/grafana/viz-contract
import constants from '@grafana/viz-contract/registry/constants.json';
import panelTypes from '@grafana/viz-contract/registry/panel-types.json';

/** The error codes of the viz spec checks (`state.3`), in the order of the checks. */
export const SPEC_ERROR_CODES = [
  'invalid-spec',
  'unsupported-spec-version',
  'unsupported-panel-type',
  'all-queries-failed',
] as const;
export type SpecErrorCode = (typeof SPEC_ERROR_CODES)[number];

/** Every error code of `states.json` (`state.3`, `state.5`). */
export type ErrorCode = SpecErrorCode | 'panel-error' | 'render-error';

/** These contract panels do not ship in this package yet (#257). */
export const PENDING_PANEL_IDS = new Set(['grafana-echartsgauge-panel', 'grafana-echartsstat-panel']);

/** The panel ids that the Renderer draws, in the registry order. */
export const PANEL_IDS: readonly string[] = panelTypes.panels
  .map((panel) => panel.id)
  .filter((id) => !PENDING_PANEL_IDS.has(id));

/** The `panel-types.json` row of a panel id. */
export const panelType = (id: string) => panelTypes.panels.find((panel) => panel.id === id);

/** Chart height when the height of `el` is 0 (`renderer.10`). */
export const DEFAULT_HEIGHT_PX: number = constants.defaultHeightPx.value;
/** Most series that the Renderer draws (`state.19`). */
export const MAX_SERIES: number = constants.maxSeries.value;
/** Time before a refresh with no result fails (`refresh.5`). */
export const REFRESH_TIMEOUT_MS: number = constants.refreshTimeoutMs.value;
/** Time before an annotation save with no result stops being busy (`renderer.56`). */
export const ANNOTATE_TIMEOUT_MS: number = constants.annotateTimeoutMs.value;
