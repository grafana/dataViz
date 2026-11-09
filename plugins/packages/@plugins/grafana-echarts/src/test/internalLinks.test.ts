import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * No tracked file of the package links to the internal GitHub organization. Its repos are not public, so a link there
 * is a dead link for users, for example in the description of a provisioned panel. Link to a grafana/dataViz issue.
 */
// The name is in two parts, so this file does not match itself.
const INTERNAL_ORG = new RegExp(['github\\.com/grafana', '-experimental/'].join(''), 'i');

const PACKAGE_DIR = path.join(__dirname, '..', '..');

describe('internal links', () => {
  const files = execFileSync('git', ['ls-files'], { cwd: PACKAGE_DIR, encoding: 'utf8' }).split('\n').filter(Boolean);

  it('finds the tracked files to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('has no link to the internal organization in a tracked file', () => {
    const offenders = files.filter((file) => {
      const text = readFileSync(path.join(PACKAGE_DIR, file));
      return INTERNAL_ORG.test(text.toString('latin1'));
    });
    expect(offenders).toEqual([]);
  });
});
