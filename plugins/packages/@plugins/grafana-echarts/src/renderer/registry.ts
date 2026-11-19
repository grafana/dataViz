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

/**
 * The panel types of the contract that this package does not have. A viz spec for one of them gives
 * `unsupported-panel-type`. The stat panel is not in this package yet: remove its id when its module is added.
 */
export const PANEL_TYPES_NOT_IN_PACKAGE: ReadonlySet<string> = new Set(['grafana-echartsstat-panel']);

/** The panel ids that the Renderer draws (`panel-types.json`), in the registry order. */
export const PANEL_IDS: readonly string[] = panelTypes.panels
  .map((panel) => panel.id)
  .filter((id) => !PANEL_TYPES_NOT_IN_PACKAGE.has(id));

/** The `panel-types.json` row of a panel id. */
export const panelType = (id: string) => panelTypes.panels.find((panel) => panel.id === id);

/** Chart height when the height of `el` is 0 (`renderer.10`). */
export const DEFAULT_HEIGHT_PX: number = constants.defaultHeightPx.value;
/** Most series that the Renderer draws (`state.19`). */
export const MAX_SERIES: number = constants.maxSeries.value;
/** Time before a refresh with no result fails (`refresh.5`). */
export const REFRESH_TIMEOUT_MS: number = constants.refreshTimeoutMs.value;
