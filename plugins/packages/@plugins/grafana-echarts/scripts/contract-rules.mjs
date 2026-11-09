// The rule ids of the contract chapters, for `sync-contract.mjs`. contractCoverage.test.ts compares them with
// `src/renderer/contractRules.json`, so a rule that a new contract version adds or removes fails the test.
// It is a module of its own, so `contract-rules.test.mjs` can test it with no `gh` call.

/** A contract chapter, for example `contract/3-renderer.md`. */
export const CHAPTER = /^contract\/\d+-[^/]+\.md$/;

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
