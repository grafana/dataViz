// Each contract rule that the Renderer owns has a test or a check that names it (`contract-rule: <id>`).
import fs from 'node:fs';
import path from 'node:path';
import contractIds from './contract/rule-ids.json';
import rules from './contractRules.json';

const PACKAGE_DIR = path.join(__dirname, '..', '..');

/** The files that can name a rule: the Jest tests, the sandbox tests, and the scripts with their node tests. */
const sourceFiles = (): string[] => [
  ...fs
    .readdirSync(path.join(PACKAGE_DIR, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.test\.tsx?$/.test(file) && !file.startsWith(`renderer${path.sep}contract${path.sep}`))
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

  it('lists the rules of the contract copy', () => {
    expect(rules.contractVersion).toBe(
      fs.readFileSync(path.join(__dirname, 'contract', 'CONTRACT_VERSION'), 'utf8').trim()
    );
  });

  it('gives one owner to each rule of the contract copy, and lists no other rule', () => {
    const all = [...rules.renderer, ...rules.notRenderer];
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...contractIds].sort());
  });

  it('has a test or a check for each rule that the Renderer owns', () => {
    expect(rules.renderer.filter((id) => !named.has(id))).toEqual([]);
  });

  it('names only rules that the Renderer owns', () => {
    const owned = new Set(rules.renderer);
    expect([...named].filter(([id]) => !owned.has(id))).toEqual([]);
  });
});
