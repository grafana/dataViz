// Tests of the checked-in `src/renderer/renderer.package.json`. Run: node --test 'scripts/*.test.mjs'
// (`pnpm run test:ci` runs it after Jest). https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  RELEASE_FILES,
  expectedValues,
  readTemplate,
  readVersion,
  releaseFileProblems,
  templateProblems,
} from './renderer-manifest.mjs';

describe('version.txt', () => {
  test('is the version of the manifest', () => {
    assert.equal(expectedValues().version, readVersion());
  });

  test('is read with no newline, as release-please writes one at the end', () => {
    assert.equal(readVersion('1.2.3\n'), '1.2.3');
  });

  test('throws for text that is not a version', () => {
    assert.throws(() => readVersion('v1.2\n'), /is not a version/);
    assert.throws(() => readVersion(''), /is not a version/);
  });
});

describe('release files', () => {
  test('are the seven files that a consumer needs', () => {
    assert.deepEqual(RELEASE_FILES, [
      'renderer.js',
      'renderer.js.LICENSE.txt',
      'renderer.manifest.json',
      'package.json',
      'icons.json',
      'renderer.d.ts',
      'LICENSE',
    ]);
    assert.deepEqual(releaseFileProblems(RELEASE_FILES), []);
  });

  test('names each missing file and each file that is not a release file', () => {
    const names = RELEASE_FILES.filter((name) => name !== 'LICENSE').concat('renderer.js.map');
    assert.deepEqual(releaseFileProblems(names), ['LICENSE is missing', 'renderer.js.map is not a release file']);
  });
});

describe('renderer.package.json', () => {
  test('agrees with the package package.json', () => {
    assert.deepEqual(templateProblems(), []);
  });

  test('names each peer range that is not the installed version, and the range to set', () => {
    // A Renovate bump changes package.json only, so the message must say what to edit.
    const template = readTemplate();
    const peerDependencies = { ...template.peerDependencies, react: '^18.0.0', 'react-dom': '^18.0.0' };
    const installed = expectedValues().peerDependencies;
    assert.deepEqual(templateProblems({ ...template, peerDependencies }), [
      `peerDependencies.react: "^18.0.0", but package.json has ${installed.react.slice(1)}. Set it to "${installed.react}".`,
      `peerDependencies.react-dom: "^18.0.0", but package.json has ${installed['react-dom'].slice(1)}. Set it to "${installed['react-dom']}".`,
    ]);
  });

  test('reports a version, a public package, a license and exports that differ', () => {
    const { peerDependencies } = expectedValues();
    const template = {
      ...readTemplate(),
      version: '1.0.0',
      private: false,
      license: 'MIT',
      exports: { '.': './x.js' },
      peerDependencies,
    };
    const fields = templateProblems(template).map((problem) => problem.split(':')[0]);
    assert.deepEqual(fields, ['version', 'private', 'license', 'exports']);
  });
});
