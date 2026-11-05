// Each contract rule that the Renderer owns has a test or a check that names it (`contract-rule: <id>`).
import fs from 'node:fs';
import path from 'node:path';
import rules from './contractRules.json';

const PACKAGE_DIR = path.join(__dirname, '..', '..');

/** The files that can name a rule: the Jest tests, the sandbox tests, the bundle check and the sync scan test. */
const sourceFiles = (): string[] => [
  ...fs
    .readdirSync(path.join(PACKAGE_DIR, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.test\.tsx?$/.test(file) && !file.startsWith(`renderer${path.sep}contract${path.sep}`))
    .map((file) => path.join('src', file)),
  ...fs.readdirSync(path.join(PACKAGE_DIR, 'tests-renderer')).map((file) => path.join('tests-renderer', file)),
  path.join('scripts', 'check-renderer-bundle.mjs'),
  path.join('scripts', 'contract-scan.test.mjs'),
];

/** The rule ids that each file names, as `id → files`. Only ids with a contract prefix count. */
function namedRules(): Map<string, string[]> {
  const named = new Map<string, string[]>();
  for (const file of sourceFiles()) {
    const text = fs.readFileSync(path.join(PACKAGE_DIR, file), 'utf8');
    for (const [, id] of text.matchAll(
      /contract-rule: ((?:tool|spec|renderer|state|refresh|delivery|fixtures|version)\.\d+)\b/g
    )) {
      named.set(id, [...(named.get(id) ?? []), file]);
    }
  }
  return named;
}

describe('the contract rule coverage', () => {
  const named = namedRules();

  it('lists the rules of the contract copy', () => {
    expect(rules.contractVersion).toBe(
      fs.readFileSync(path.join(__dirname, 'contract', 'CONTRACT_VERSION'), 'utf8').trim()
    );
  });

  it('gives each rule one owner, and no rule is missing from a group', () => {
    const all = [...rules.renderer, ...rules.notRenderer];
    expect(new Set(all).size).toBe(all.length);
    const byGroup = new Map<string, number[]>();
    for (const id of all) {
      const [group, n] = id.split('.');
      byGroup.set(group, [...(byGroup.get(group) ?? []), Number(n)]);
    }
    for (const [group, numbers] of byGroup) {
      const sorted = [...numbers].sort((a, b) => a - b);
      expect([group, sorted]).toEqual([group, sorted.map((_, i) => i + 1)]);
    }
  });

  it('has a test or a check for each rule that the Renderer owns', () => {
    expect(rules.renderer.filter((id) => !named.has(id))).toEqual([]);
  });

  it('names only rules that the Renderer owns', () => {
    const owned = new Set(rules.renderer);
    expect([...named].filter(([id]) => !owned.has(id))).toEqual([]);
  });
});
