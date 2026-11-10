// Each contract rule that the Renderer owns has a test or a check that names it (`contract-rule: <id>`).
// The package has no contract chapters, so `scripts/check-contract-rules.mjs` compares the rule ids with them.
import contractPackage from '@grafana/viz-contract/package.json';
import fs from 'node:fs';
import path from 'node:path';
import rules from './contractRules.json';

const PACKAGE_DIR = path.join(__dirname, '..', '..');

/** The files that can name a rule: the Jest tests, the sandbox tests, and the scripts with their node tests. */
const sourceFiles = (): string[] => [
  ...fs
    .readdirSync(path.join(PACKAGE_DIR, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.test\.tsx?$/.test(file))
    .map((file) => path.join('src', file)),
  ...fs.readdirSync(path.join(PACKAGE_DIR, 'tests-renderer')).map((file) => path.join('tests-renderer', file)),
  ...fs
    .readdirSync(path.join(PACKAGE_DIR, 'scripts'))
    .filter((file) => file.endsWith('.mjs'))
    .map((file) => path.join('scripts', file)),
];

/** The rule ids that each file names, as `id → files`. */
function namedRules(): Map<string, string[]> {
  const named = new Map<string, string[]>();
  for (const file of sourceFiles()) {
    const text = fs.readFileSync(path.join(PACKAGE_DIR, file), 'utf8');
    for (const [, id] of text.matchAll(/contract-rule: ([a-z]+\.\d+)\b/g)) {
      named.set(id, [...(named.get(id) ?? []), file]);
    }
  }
  return named;
}

describe('the contract rule coverage', () => {
  const named = namedRules();

  it('lists the rules of the installed contract version', () => {
    expect(rules.contractVersion).toBe(contractPackage.version);
  });

  it('puts each rule in one list only', () => {
    const all = [...rules.renderer, ...rules.notRenderer, ...rules.pending];
    expect(new Set(all).size).toBe(all.length);
  });

  it('has a test or a check for each rule that the Renderer owns', () => {
    expect(rules.renderer.filter((id) => !named.has(id))).toEqual([]);
  });

  // A pending rule that gets a test fails here too: move it to `renderer`.
  it('names only rules that the Renderer owns', () => {
    const owned = new Set(rules.renderer);
    expect([...named].filter(([id]) => !owned.has(id))).toEqual([]);
  });
});
