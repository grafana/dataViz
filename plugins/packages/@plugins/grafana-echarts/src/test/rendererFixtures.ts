// Reads the Renderer fixture sets of the viz contract, from the installed `@grafana/viz-contract` package.
import { type RenderState } from '@grafana/viz-contract/renderer-api';
import fs from 'node:fs';
import path from 'node:path';

/** The `fixtures/` directory of the contract package. */
export const FIXTURES_DIR = path.join(path.dirname(require.resolve('@grafana/viz-contract/package.json')), 'fixtures');

/** All fixture sets of the contract, sorted. Only some of them are Renderer sets. */
export const allFixtureSets = (): string[] =>
  fs
    .readdirSync(FIXTURES_DIR)
    .filter((name) => fs.statSync(path.join(FIXTURES_DIR, name)).isDirectory())
    .sort();

/** The Renderer sets, sorted: a set is a Renderer set when it has a `state.json` (`fixtures.10`). */
export const fixtureSets = (): string[] =>
  allFixtureSets().filter((name) => fs.existsSync(path.join(FIXTURES_DIR, name, 'state.json')));

/** The `spec.json` of a set, as JSON. Each call gives a new object. */
export const fixtureSpec = (set: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, set, 'spec.json'), 'utf8'));

/** The `state.json` of a set. */
export const fixtureState = (set: string): RenderState =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, set, 'state.json'), 'utf8'));
