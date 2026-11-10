// The rule ids of the contract chapters, for `check-contract-rules.mjs`. That script compares them with
// `src/renderer/contractRules.json`, so a rule that a new contract version adds or removes fails the check.
// It is a module of its own, so `contract-rules.test.mjs` can test it with no network call.

/** A contract chapter at the root of the contract repo, for example `3-renderer.md`. */
export const CHAPTER = /^\d+-[^/]+\.md$/;

/** A rule starts a list item with its id in backticks: "- `renderer.1` The Renderer is an ES module." */
const RULE = /^[-*] `([a-z]+\.\d+)`/gm;

/** The rule ids that the chapter texts define, in the order of the texts. An id that is defined twice throws. */
export function contractRuleIds(texts) {
  const ids = texts.flatMap((text) => [...text.matchAll(RULE)].map(([, id]) => id));
  const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (twice.length > 0) {
    throw new Error(`A chapter defines these rule ids two times: ${[...new Set(twice)].join(', ')}.`);
  }
  return ids;
}

/**
 * The differences between `contractRules.json` (`rules`) and a contract version: its `version` and the rule ids of
 * its chapters (`ids`). An empty list means that `contractRules.json` is correct for that version.
 */
export function ruleListProblems(rules, version, ids) {
  const problems = [];
  if (rules.contractVersion !== version) {
    problems.push(`contractVersion is ${rules.contractVersion}, but the contract package is ${version}`);
  }
  const listed = [...rules.renderer, ...rules.notRenderer, ...(rules.pending ?? [])];
  const missing = ids.filter((id) => !listed.includes(id));
  if (missing.length > 0) {
    problems.push(`not in renderer, notRenderer or pending: ${missing.join(', ')}`);
  }
  const extra = listed.filter((id) => !ids.includes(id));
  if (extra.length > 0) {
    problems.push(`not a rule of contract ${version}: ${extra.join(', ')}`);
  }
  return problems;
}
