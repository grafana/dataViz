#!/usr/bin/env node
// Checks that `src/renderer/contractRules.json` lists the rules of the installed viz contract, and nothing else.
// Usage: node scripts/check-contract-rules.mjs (`pnpm run check:contract-rules`). See docs/renderer.md.
// The `@grafana/viz-contract` package has no contract chapters, so the script reads them from the tag of the package
// version in grafana/viz-contract, which is public. It makes one GitHub API call and one raw file request for each
// chapter. https://docs.github.com/en/rest/git/trees#get-a-tree
// The API call sends `GITHUB_TOKEN` if it is set. With no token, the limit is 60 calls an hour for each IP address,
// and CI runners share addresses. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAPTER, contractRuleIds, ruleListProblems } from './contract-rules.mjs';

const REPO = 'grafana/viz-contract';
const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const { version } = readJson(createRequire(import.meta.url).resolve('@grafana/viz-contract/package.json'));
const tag = `v${version}`;

const get = async (url, accept, token) => {
  const headers = { Accept: accept, 'User-Agent': 'viz-contract-rule-check' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GET ${url}: ${response.status} ${response.statusText}`);
  }
  return response;
};

// The chapters are at the root of the contract repo.
const tree = await (
  await get(
    `https://api.github.com/repos/${REPO}/git/trees/${tag}`,
    'application/vnd.github+json',
    process.env.GITHUB_TOKEN
  )
).json();
const chapterNumber = (path) => Number.parseInt(path, 10);
const chapters = tree.tree
  .filter((entry) => entry.type === 'blob' && CHAPTER.test(entry.path))
  .map((entry) => entry.path)
  .sort((a, b) => chapterNumber(a) - chapterNumber(b));
if (chapters.length === 0) {
  throw new Error(`${REPO} ${tag} has no contract chapters.`);
}
const texts = await Promise.all(
  chapters.map(async (path) => (await get(`https://raw.githubusercontent.com/${REPO}/${tag}/${path}`, '*/*')).text())
);

const problems = ruleListProblems(
  readJson(join(PACKAGE_DIR, 'src/renderer/contractRules.json')),
  version,
  contractRuleIds(texts)
);
if (problems.length > 0) {
  console.error(`src/renderer/contractRules.json does not match contract ${tag}:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`src/renderer/contractRules.json lists the rules of contract ${tag} (${chapters.length} chapters).`);
