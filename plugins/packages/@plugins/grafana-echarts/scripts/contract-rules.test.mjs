// Tests of the rule id list of `sync-contract.mjs`. Run: node --test 'scripts/*.test.mjs' (`pnpm run test:ci` runs it).
// https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CHAPTER, contractRuleIds } from './contract-rules.mjs';

describe('contractRuleIds', () => {
  test('finds each rule at the start of a list item, in chapter order', () => {
    const renderer = [
      '# Renderer',
      '',
      '- `renderer.1` The Renderer is an ES module.',
      '- `renderer.2` `render(el, spec, options)` returns a handle at once. The App',
      '  waits for `onState` (`state.1`).',
      '* `renderer.3` `render` throws only if `el` is not an `HTMLElement`.',
    ].join('\n');
    const refresh = '- `refresh.1` A refresh draws again.\n';
    assert.deepEqual(contractRuleIds([renderer, refresh]), ['renderer.1', 'renderer.2', 'renderer.3', 'refresh.1']);
  });

  test('does not count an id that a rule only refers to', () => {
    assert.deepEqual(contractRuleIds(['The App reads `state.1` (see `renderer.2`).\n  - see `state.3`']), []);
  });

  test('throws when two chapters define the same id', () => {
    assert.throws(() => contractRuleIds(['- `state.1` a', '- `state.1` b']), /state\.1/);
  });
});

describe('CHAPTER', () => {
  test('matches the numbered chapters only', () => {
    assert.equal(CHAPTER.test('contract/3-renderer.md'), true);
    for (const path of ['contract/README.md', 'contract/CHANGELOG.md', 'contract/future.md', 'contract/x/1-a.md']) {
      assert.equal(CHAPTER.test(path), false, path);
    }
  });
});
