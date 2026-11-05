// Reads the fixture sets of the viz contract copy in `src/renderer/contract/fixtures/`.
import fs from 'node:fs';
import path from 'node:path';
import { type RenderState } from 'renderer/contract/renderer-api';

const FIXTURES_DIR = path.join(__dirname, '..', 'renderer', 'contract', 'fixtures');

/** The names of the fixture sets, sorted. */
export const fixtureSets = (): string[] =>
  fs
    .readdirSync(FIXTURES_DIR)
    .filter((name) => fs.statSync(path.join(FIXTURES_DIR, name)).isDirectory())
    .sort();

/** The `spec.json` of a set, as JSON. Each call gives a new object. */
export const fixtureSpec = (set: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, set, 'spec.json'), 'utf8'));

/** The `state.json` of a set. */
export const fixtureState = (set: string): RenderState =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, set, 'state.json'), 'utf8'));
