// Tests of the checked-in `src/renderer/renderer.package.json`. Run: node --test 'scripts/*.test.mjs'
// (`pnpm run test:ci` runs it after Jest). https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { expectedValues, readTemplate, templateProblems } from './renderer-manifest.mjs';

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
