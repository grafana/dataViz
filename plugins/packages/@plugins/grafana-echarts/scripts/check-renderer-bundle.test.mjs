// Tests of the build step of `check-renderer-bundle.mjs`. Run: node --test 'scripts/*.test.mjs'
// (`pnpm run test:ci` runs it after Jest). A fake `pnpm` on PATH stands in for webpack.
// https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-renderer-bundle.mjs');

/** Runs the script with a fake `pnpm` and returns the result and the entries that it left in its temp folder. */
function runWithFakePnpm(dir, pnpmBody) {
  const bin = join(dir, 'bin');
  const tmp = join(dir, 'tmp');
  mkdirSync(bin);
  mkdirSync(tmp);
  writeFileSync(join(bin, 'pnpm'), `#!/bin/sh\n${pnpmBody}\n`);
  chmodSync(join(bin, 'pnpm'), 0o755);
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, TMPDIR: tmp },
  });
  return { result, left: readdirSync(tmp) };
}

describe('build', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'check-renderer-bundle-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('deletes the stats folder when webpack writes no stats', () => {
    const { result, left } = runWithFakePnpm(dir, 'exit 2');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /webpack wrote no stats \(exit 2\)/);
    assert.deepEqual(left, []);
  });

  test('deletes the stats folder when the stats have errors', () => {
    // The last argument is `--json=<stats path>`.
    const pnpm = 'for a; do f="$a"; done\necho \'{"errors":[{"message":"boom"}]}\' > "${f#--json=}"';
    const { result, left } = runWithFakePnpm(dir, pnpm);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /boom/);
    assert.deepEqual(left, []);
  });

  test('fails when the stats list no echarts module', () => {
    // A stats preset or a change of the module names can leave the module list empty.
    const pnpm = 'for a; do f="$a"; done\necho \'{"errors":[],"modules":[]}\' > "${f#--json=}"';
    const { result, left } = runWithFakePnpm(dir, pnpm);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /webpack stats list no module of echarts/);
    assert.deepEqual(left, []);
  });
});
