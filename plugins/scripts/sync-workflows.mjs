#!/usr/bin/env node
// Refresh the pinned snapshot of @grafana/create-plugin's GitHub workflow
// templates (`plugins/.github-workflows-reference/`) and surface a diff so
// upstream changes -- new steps and, especially, `grafana/plugin-actions/*`
// version bumps -- can be ported into this repo's real `.github/workflows/*`.
//
// This is DELIBERATELY separate from `update:config`/`sync:config`. create-plugin
// does not maintain workflows via `create-plugin update`, and this monorepo's
// workflows are hand-authored around a reusable workflow + plugin matrix, so
// there is nothing to copy verbatim -- we only track upstream to review drift.
//
// Bumping the pinned `ref` in `.github-workflows-reference/manifest.json` is an
// intentional, reviewed step.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const pluginsDir = path.resolve(import.meta.dirname, '..');
const refDir = path.join(pluginsDir, '.github-workflows-reference');
const manifestPath = path.join(refDir, 'manifest.json');
const liveWorkflowsDir = path.resolve(pluginsDir, '..', '.github', 'workflows');

const PLUGIN_ACTION_RE = /grafana\/plugin-actions\/[^\s'"@]+@[^\s'"]+/g;

function fail(message) {
	console.error(`\n\u2716 ${message}\n`);
	process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
	fail(`Manifest not found at ${path.relative(pluginsDir, manifestPath)}.`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const { repo, ref, templatePath, files } = manifest;

if (!repo || !ref || !templatePath || !Array.isArray(files) || files.length === 0) {
	fail('Manifest must define non-empty "repo", "ref", "templatePath" and "files".');
}

console.info(
	`Syncing create-plugin workflow reference from ${repo}@${ref.slice(0, 12)} ` +
		`into ${path.relative(pluginsDir, refDir)}/ \u2026`
);

const referencedActions = new Set();

for (const file of files) {
	const url = `https://raw.githubusercontent.com/${repo}/${ref}/${templatePath}/${file}`;
	let body;
	try {
		const res = await fetch(url);
		if (!res.ok) {
			fail(`Failed to fetch ${url} (HTTP ${res.status}).`);
		}
		body = await res.text();
	} catch (error) {
		fail(`Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`);
	}

	fs.writeFileSync(path.join(refDir, file), body);
	for (const match of body.match(PLUGIN_ACTION_RE) ?? []) {
		referencedActions.add(match);
	}
	console.info(`  \u2022 ${file}`);
}

console.info('\nPinned grafana/plugin-actions in the reference templates:\n');
if (referencedActions.size === 0) {
	console.info('  (none found)');
} else {
	for (const action of [...referencedActions].sort()) {
		console.info(`  \u2022 ${action}`);
	}
}

const liveActions = new Set();
if (fs.existsSync(liveWorkflowsDir)) {
	for (const file of fs.readdirSync(liveWorkflowsDir)) {
		if (!/\.ya?ml$/.test(file)) {
			continue;
		}
		const body = fs.readFileSync(path.join(liveWorkflowsDir, file), 'utf8');
		for (const match of body.match(PLUGIN_ACTION_RE) ?? []) {
			liveActions.add(match);
		}
	}
}

const drift = [...referencedActions].filter((action) => !liveActions.has(action)).sort();
if (drift.length > 0) {
	console.info('\nAction pins present upstream but NOT in .github/workflows (reconcile these):\n');
	for (const action of drift) {
		console.info(`  \u2022 ${action}`);
	}
}

console.info('\nReview the reference diff below before committing:\n');
try {
	const diff = execFileSync('git', ['--no-pager', 'diff', '--stat', '--', '.github-workflows-reference'], {
		cwd: pluginsDir,
		encoding: 'utf8',
	});
	console.info(diff.trim() ? diff : '  (no changes \u2014 reference already matches the pinned ref)');
} catch {
	console.info('  (could not run `git diff`; review .github-workflows-reference manually)');
}

console.info(
	[
		'',
		'Next steps:',
		'  1. Eyeball the reference diff (this folder is a read-only upstream snapshot).',
		'  2. Port any meaningful change \u2014 especially plugin-actions version bumps \u2014',
		'     into the real, monorepo-adapted workflows in ../.github/workflows/.',
		'  3. To track a newer create-plugin release, bump "ref" in',
		'     .github-workflows-reference/manifest.json and re-run `pnpm sync:workflows`.',
		'',
	].join('\n')
);
