// Each relative import of a tracked script is a tracked file. `.gitignore` ignores `scripts/*` and lists the
// tracked scripts one by one, so a new module that is not on the list stays on one disk only, and a clean
// checkout of the importing script fails with ERR_MODULE_NOT_FOUND.
// Run: node --test 'scripts/*.test.mjs' (`pnpm run test:ci` runs it after Jest). https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The files under `scripts/` that git tracks or has staged, relative to the package. */
const tracked = new Set(
  execFileSync('git', ['ls-files', '--cached', 'scripts'], { cwd: PACKAGE_DIR, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
);

/** A relative module path after `from`, after a side-effect `import` or in a dynamic `import()`. */
const RELATIVE_IMPORT = /(?:\bfrom\s+|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

test('each relative import of a tracked script is tracked by git', () => {
  const missing = [];
  for (const file of [...tracked].filter((path) => path.endsWith('.mjs'))) {
    for (const [, specifier] of readFileSync(join(PACKAGE_DIR, file), 'utf8').matchAll(RELATIVE_IMPORT)) {
      const target = relative(PACKAGE_DIR, join(PACKAGE_DIR, dirname(file), specifier));
      if (target.startsWith('scripts/') && !tracked.has(target)) {
        missing.push(`${file} imports ${target}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
