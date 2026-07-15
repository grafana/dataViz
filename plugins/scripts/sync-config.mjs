#!/usr/bin/env node
// Sync the vendored create-plugin base (`plugins/.config`) from the reference
// plugin (`plugins/.config-reference/.config`).
//
// Workflow: run `pnpm update:config` first (refreshes `.config-reference` via
// `create-plugin update`), then this script copies only the compat-sensitive
// subset the monorepo vendors verbatim. Biome/Prettier/ESLint/Jest/Dockerfile
// and this repo's hand-written `.config/README.md` are intentionally NOT synced.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const pluginsDir = path.resolve(import.meta.dirname, '..');
const sourceConfig = path.join(pluginsDir, '.config-reference', '.config');
const targetConfig = path.join(pluginsDir, '.config');

// The subset that is vendored verbatim into `plugins/.config`. Everything else
// in the reference `.config` (eslint/prettier/jest/Dockerfile/rspack/etc.) is
// deliberately left behind because the monorepo uses Biome/Vitest/Turbo.
const SYNCED_ENTRIES = ['webpack', 'bundler', 'types', 'tsconfig.json', '.cprc.json'];

function fail(message) {
	console.error(`\n✖ ${message}\n`);
	process.exit(1);
}

if (!fs.existsSync(sourceConfig)) {
	fail(
		`Reference config not found at ${path.relative(pluginsDir, sourceConfig)}.\n` +
			'  Run `pnpm update:config` first to refresh the reference plugin.'
	);
}

console.info(`Syncing create-plugin base into ${path.relative(pluginsDir, targetConfig)}/ …`);

for (const entry of SYNCED_ENTRIES) {
	const from = path.join(sourceConfig, entry);
	const to = path.join(targetConfig, entry);

	if (!fs.existsSync(from)) {
		fail(`Expected ${path.relative(pluginsDir, from)} in the reference config but it is missing.`);
	}

	fs.rmSync(to, { recursive: true, force: true });
	fs.cpSync(from, to, { recursive: true });
	console.info(`  • ${entry}`);
}

console.info('\nReview the changes below before committing:\n');

try {
	const diff = execFileSync('git', ['--no-pager', 'diff', '--stat', '--', '.config'], {
		cwd: pluginsDir,
		encoding: 'utf8',
	});
	console.info(diff.trim() ? diff : '  (no changes — plugins/.config already matches the reference)');
} catch {
	console.info('  (could not run `git diff`; review plugins/.config manually)');
}

console.info(
	[
		'',
		'Next steps:',
		'  1. Eyeball the diff above (plugins/.config is do-not-edit / generated).',
		'  2. Run `pnpm build` and `pnpm type-check` across the workspace.',
		'  3. Commit plugins/.config together with plugins/.config-reference.',
		'',
	].join('\n')
);
