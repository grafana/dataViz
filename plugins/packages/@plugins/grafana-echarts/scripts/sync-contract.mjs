#!/usr/bin/env node
// Copies the Renderer files of the viz contract into `src/renderer/contract/`, from one contract tag.
// Usage: node scripts/sync-contract.mjs contract-1.0.0
// It reads with `gh api` (read only), so `gh auth status` must pass. See docs/renderer.md.
// https://docs.github.com/en/rest/git/trees#get-a-tree https://docs.github.com/en/rest/git/blobs#get-a-blob
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanContractFiles } from './contract-scan.mjs';

const REPO = 'grafana-experimental/grafana-beyond-docs';
/** Files that the Renderer reads (contract README, "How to read"). The key is the path in the contract. */
const FILES = {
  'contract/renderer-api.d.ts': 'renderer-api.d.ts',
  'contract/registry/panel-types.json': 'registry/panel-types.json',
  'contract/registry/chart-types.json': 'registry/chart-types.json',
  'contract/registry/states.json': 'registry/states.json',
  'contract/registry/notices.json': 'registry/notices.json',
  'contract/registry/constants.json': 'registry/constants.json',
  'contract/schemas/bundled/viz-spec.schema.json': 'schemas/viz-spec.schema.json',
};
/** The fixture files of the Renderer test (`fixtures.10`). A set has them only when it is a Renderer set. */
const FIXTURE_FILES = ['spec.json', 'state.json'];

const tag = process.argv[2];
if (!/^contract-\d+\.\d+\.\d+$/.test(tag ?? '')) {
  console.error('Usage: node scripts/sync-contract.mjs contract-<semver>');
  process.exit(2);
}

const gh = (path) => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const blob = (sha) => Buffer.from(gh(`repos/${REPO}/git/blobs/${sha}`).content, 'base64').toString('utf8');

// An annotated tag points to a tag object. Follow it to the commit.
let ref = gh(`repos/${REPO}/git/ref/tags/${tag}`).object;
if (ref.type === 'tag') {
  ref = gh(`repos/${REPO}/git/tags/${ref.sha}`).object;
}
const commit = ref.sha;
const tree = gh(`repos/${REPO}/git/trees/${commit}?recursive=1`);
if (tree.truncated) {
  throw new Error('The tree listing is truncated. Fetch the fixture directories one at a time.');
}
const blobs = new Map(tree.tree.filter((entry) => entry.type === 'blob').map((entry) => [entry.path, entry.sha]));

/** Contract path → local path, for each file to copy. */
const copies = new Map(Object.entries(FILES));
for (const path of blobs.keys()) {
  const match = /^contract\/fixtures\/([^/]+)\/state\.json$/.exec(path);
  if (match) {
    for (const file of FIXTURE_FILES) {
      copies.set(`contract/fixtures/${match[1]}/${file}`, `fixtures/${match[1]}/${file}`);
    }
  }
}

const contents = new Map();
for (const [from, to] of copies) {
  const sha = blobs.get(from);
  if (!sha) {
    throw new Error(`${from} is not in ${tag}.`);
  }
  contents.set(to, blob(sha));
}

// `fixtures.11`: check each file before anything is written. A hit stops the sync.
const hits = scanContractFiles(contents);
if (hits.length > 0) {
  console.error(`Stopped. Review these files (the values are not shown):\n${[...new Set(hits)].join('\n')}`);
  process.exit(1);
}

// Write and overwrite only. The sync never deletes a file, so `fixtures/prometheus-line/expected.png` stays.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer', 'contract');
for (const [file, text] of contents) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}
const version = tag.slice('contract-'.length);
writeFileSync(join(root, 'CONTRACT_VERSION'), `${version}\n`);
writeFileSync(
  join(root, 'README.md'),
  `# Viz contract ${version}\n\n` +
    `Do not edit these files. \`scripts/sync-contract.mjs\` copies them from tag \`${tag}\` of ${REPO}, ` +
    `commit \`${commit}\`.\n\n` +
    'One file is local: `fixtures/prometheus-line/expected.png`. The sync does not write or delete it.\n'
);
const sets = [...copies.values()].filter((file) => file.endsWith('/state.json')).length;
console.log(`Copied ${contents.size} files (${sets} fixture sets) from ${tag} (${commit}).`);
