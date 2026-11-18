// Reads the Renderer fixture sets of the viz contract, from the installed `@grafana/viz-contract` package.
import { type RenderState } from '@grafana/viz-contract/renderer-api';
import fs from 'node:fs';
import path from 'node:path';
import { PANEL_IDS } from '../renderer/registry';

/** The `fixtures/` directory of the contract package. */
export const FIXTURES_DIR = path.join(path.dirname(require.resolve('@grafana/viz-contract/package.json')), 'fixtures');

/** All fixture sets of the contract, sorted. Only some of them are Renderer sets. */
export const allFixtureSets = (): string[] =>
  fs
    .readdirSync(FIXTURES_DIR)
    .filter((name) => fs.statSync(path.join(FIXTURES_DIR, name)).isDirectory())
    .sort();

/** The `spec.json` of a set, as JSON. Each call gives a new object. */
export const fixtureSpec = (set: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, set, 'spec.json'), 'utf8'));

/** The Renderer sets, sorted: a set is a Renderer set when it has a `state.json` (`fixtures.10`). */
export const fixtureSets = (): string[] =>
  allFixtureSets().filter((name) => fs.existsSync(path.join(FIXTURES_DIR, name, 'state.json')));

/** Makes a viz spec from the panel and the data of a Source result. */
export function fixturePickedSpec(set: string): Record<string, unknown> {
  const { panel, data } = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, set, 'result.json'), 'utf8'));
  return { specVersion: 1, panel, data };
}

/** The list of panel types at the end of the `unsupported-panel-type` message of `states.json`. */
const SUPPORTED_TYPES = /Supported types: .*\.$/;

/**
 * The `state.json` of a set, with one correction: the `unsupported-panel-type` message lists the panel types that
 * this package draws (`PANEL_IDS`). The set of contract 1.10.0 lists the panel types of contract 1.7.0, with no
 * gauge and no stat (https://github.com/grafana/viz-contract/issues/94).
 * Remove the correction when the set and `PANEL_IDS` list the same panel types.
 */
export const fixtureState = (set: string): RenderState => {
  const state: RenderState = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, set, 'state.json'), 'utf8'));
  if (state.error?.code === 'unsupported-panel-type') {
    state.error.message = state.error.message.replace(SUPPORTED_TYPES, `Supported types: ${PANEL_IDS.join(', ')}.`);
  }
  return state;
};
