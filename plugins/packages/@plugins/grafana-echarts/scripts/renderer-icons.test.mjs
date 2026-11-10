// Tests of `renderer-icons.mjs`, the `icons.json` of the Renderer build. Run: node --test 'scripts/*.test.mjs'
// (`pnpm run test:ci` runs it after Jest). https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LOCAL_ICONS_DIR, UI_ICONS_DIR, iconKeysIn, iconProblems, readIconList, readIcons } from './renderer-icons.mjs';

describe('icons.json', () => {
  test('has the key and value shape of delivery.9 for each listed icon', () => {
    // contract-rule: delivery.9
    const icons = readIcons();
    assert.deepEqual(Object.keys(icons), readIconList());
    assert.deepEqual(iconProblems(icons), []);
  });

  test('reports a key that is not <dir>/<name>, a value that is not SVG, and an empty object', () => {
    assert.deepEqual(iconProblems({ 'icons/sync': '<svg></svg>', 'unicons/sync': 'sync' }), [
      'icons/sync: the key is not <dir>/<name> with <dir> unicons, solid, mono or custom',
      'unicons/sync: the value is not SVG content',
    ]);
    assert.deepEqual(iconProblems({}), ['icons.json has no icons']);
    assert.deepEqual(iconProblems([]), ['icons.json is not a JSON object']);
  });

  test('names each listed icon that has no SVG file', () => {
    assert.throws(() => readIcons(['unicons/sync', 'unicons/no-such-icon']), /no copy: unicons\/no-such-icon\./);
  });
});

describe('the checked-in SVG files', () => {
  const local = iconKeysIn(LOCAL_ICONS_DIR);

  test('are only icons that @grafana/ui does not ship', () => {
    // After a @grafana/ui update ships one of them, delete the copy.
    const shipped = new Set(iconKeysIn(UI_ICONS_DIR));
    assert.deepEqual(
      local.filter((key) => shipped.has(key)),
      []
    );
  });

  test('are each in the icon list', () => {
    const listed = new Set(readIconList());
    assert.deepEqual(
      local.filter((key) => !listed.has(key)),
      []
    );
  });
});
