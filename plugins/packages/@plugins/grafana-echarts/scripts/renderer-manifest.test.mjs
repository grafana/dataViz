// Tests of the checked-in `src/renderer/renderer.package.json`. Run: node --test 'scripts/*.test.mjs'
// (`pnpm run test:ci` runs it after Jest). https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { expectedValues, readTemplate, templateProblems } from './renderer-manifest.mjs';

describe('renderer.package.json', () => {
  test('agrees with the package package.json', () => {
    assert.deepEqual(templateProblems(), []);
  });

  test('reports a peer range that is not the installed version', () => {
    const template = readTemplate();
    const peerDependencies = { ...template.peerDependencies, react: '^18.0.0' };
    const problems = templateProblems({ ...template, peerDependencies });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^peerDependencies: .*"react":"\^18\.0\.0"/);
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
