// Tests of the `renderer.9` import scan. Run: node --test 'scripts/*.test.mjs' (`pnpm run test:ci` runs it after Jest).
// https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bundleImports } from './bundle-imports.mjs';

const IMPORTS = 'import*as e from"react";import{jsxs as r}from"react/jsx-runtime";import"lodash";';

describe('bundleImports', () => {
  test('finds the imports after one license comment', () => {
    assert.deepEqual(bundleImports(`/*! license */\n${IMPORTS}var a=1;`), ['react', 'react/jsx-runtime', 'lodash']);
  });

  test('finds the imports after two comments or a directive', () => {
    for (const start of ['/*! a */\n/*! b */\n', '"use strict";', '// x\n']) {
      assert.deepEqual(bundleImports(`${start}${IMPORTS}`), ['react', 'react/jsx-runtime', 'lodash'], start);
    }
  });

  test('finds an import that is not at the start', () => {
    assert.deepEqual(bundleImports('var a=1;import*as b from"lodash";'), ['lodash']);
  });

  test('finds a re-export from a package', () => {
    assert.deepEqual(bundleImports('export*from"react";export{a as b}from"lodash";export{c};'), ['react', 'lodash']);
  });

  test('ignores a dynamic import and import.meta', () => {
    assert.deepEqual(bundleImports('import("lodash");import.meta.url;a.import("x");'), []);
  });
});
