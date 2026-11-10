// Tests of the rule id check of `check-contract-rules.mjs`. Run: node --test 'scripts/*.test.mjs' (`pnpm run test:ci`
// runs it). https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CHAPTER, contractRuleIds, ruleListProblems } from './contract-rules.mjs';

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
    assert.equal(CHAPTER.test('3-renderer.md'), true);
    for (const path of ['README.md', 'CHANGELOG.md', 'future.md', 'fixtures/1-a.md', 'contract/3-renderer.md']) {
      assert.equal(CHAPTER.test(path), false, path);
    }
  });
});

describe('ruleListProblems', () => {
  const rules = { contractVersion: '1.1.0', renderer: ['renderer.1'], notRenderer: ['tool.1'] };

  test('finds no problem when the lists equal the rules of the version', () => {
    assert.deepEqual(ruleListProblems(rules, '1.1.0', ['tool.1', 'renderer.1']), []);
  });

  test('finds another contract version', () => {
    assert.match(ruleListProblems(rules, '1.2.0', ['tool.1', 'renderer.1']).join('\n'), /1\.1\.0.*1\.2\.0/);
  });

  test('finds a rule that the contract adds and a rule that it removes', () => {
    assert.deepEqual(ruleListProblems(rules, '1.1.0', ['renderer.1', 'tool.2']), [
      'not in renderer, notRenderer or pending: tool.2',
      'not a rule of contract 1.1.0: tool.1',
    ]);
  });

  test('counts the pending rules as listed', () => {
    const withPending = { ...rules, pending: ['renderer.2'] };
    assert.deepEqual(ruleListProblems(withPending, '1.1.0', ['tool.1', 'renderer.1', 'renderer.2']), []);
    assert.deepEqual(ruleListProblems(withPending, '1.1.0', ['tool.1', 'renderer.1']), [
      'not a rule of contract 1.1.0: renderer.2',
    ]);
  });
});
