// discover-plugins/run.sh: base selection for changed-only, and the outputs.
// discover.sh is replaced by a stub that echoes its arguments, so these tests
// cover only the entry point's own logic.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { ACTION_RUN, bash, git, outputFile, readOutputs, tempDir, writeText } from './helpers.ts';

function runEntryPoint(
	t: TestContext,
	env: Record<string, string>,
	cwd?: string
): { args: string[]; log: string; e2e: string; artifacts: string } {
	const stubDir = tempDir(t);
	// Echoes its arguments back as `targets`, so the test can see what was passed.
	writeText(join(stubDir, 'discover.sh'), `jq -nc '{targets: $ARGS.positional, e2e: [], artifacts: [{id: "x"}]}' --args "$@"\n`);
	const output = outputFile(t);
	const entryPoint = bash(ACTION_RUN, [], {
		env: { ROOT: 'plugins/packages/@plugins', CHANGED_ONLY: 'false', PR_BASE: '', PUSH_BEFORE: '', ACTION_PATH: stubDir, GITHUB_OUTPUT: output, ...env },
		cwd,
	});
	assert.equal(entryPoint.status, 0, entryPoint.stderr);
	const outputs = readOutputs(output);
	// The first log line says which base was picked and why.
	const log = entryPoint.stdout.split('\n')[0];
	return { args: JSON.parse(outputs.targets), log, e2e: outputs.e2e, artifacts: outputs.artifacts };
}

describe('discover-plugins/run.sh', () => {
	describe('base selection', () => {
		const ROOT = 'plugins/packages/@plugins';
		// `args` is what run.sh should pass to discover.sh; an empty base means "filter nothing".
		// `log` is the line that says which base was picked and why.
		const NONE = 'changed-only base: none, every package selected';
		const cases: { name: string; env: Record<string, string>; args: string[]; log: string }[] = [
			{ name: 'changed-only off passes an empty base', env: { PR_BASE: 'abc123' }, args: [ROOT, ''], log: `${NONE} (changed-only is off)` },
			{
				name: 'pull_request uses the PR base',
				env: { CHANGED_ONLY: 'true', PR_BASE: 'abc123', PUSH_BEFORE: 'def456' },
				args: [ROOT, 'abc123'],
				log: 'changed-only base: abc123 (PR base)',
			},
			{ name: 'push uses the previous commit', env: { CHANGED_ONLY: 'true', PUSH_BEFORE: 'def456' }, args: [ROOT, 'def456'], log: 'changed-only base: def456 (push before)' },
			{
				name: 'a branch-creating push (all-zero before) passes an empty base',
				env: { CHANGED_ONLY: 'true', PUSH_BEFORE: '0'.repeat(40) },
				args: [ROOT, ''],
				log: `${NONE} (no usable base)`,
			},
			{ name: 'no event base (workflow_dispatch) passes an empty base', env: { CHANGED_ONLY: 'true' }, args: [ROOT, ''], log: `${NONE} (no usable base)` },
		];

		for (const { name, env, args, log } of cases) {
			test(name, (t) => {
				const run = runEntryPoint(t, env);
				assert.deepEqual(run.args, args);
				assert.equal(run.log, log);
			});
		}

		// What actions/checkout gives a pull_request run: GitHub's test merge of the
		// PR head into the base branch as it is now, which has moved on since the
		// PR's base.sha.
		function testMergeRepo(t: TestContext): { cwd: string; oldBase: string; newBase: string; head: string } {
			const cwd = tempDir(t);
			git(cwd, 'init', '-q', '-b', 'main');
			git(cwd, 'commit', '-q', '--allow-empty', '-m', 'old base');
			const oldBase = git(cwd, 'rev-parse', 'HEAD');
			git(cwd, 'checkout', '-q', '-b', 'pr');
			git(cwd, 'commit', '-q', '--allow-empty', '-m', 'pr change');
			const head = git(cwd, 'rev-parse', 'HEAD');
			git(cwd, 'checkout', '-q', 'main');
			git(cwd, 'commit', '-q', '--allow-empty', '-m', 'merged to main since');
			const newBase = git(cwd, 'rev-parse', 'HEAD');
			git(cwd, 'merge', '-q', '--no-ff', '-m', 'test merge', 'pr');
			return { cwd, oldBase, newBase, head };
		}

		test('pull_request on the test merge uses its first parent, not an older PR base', (t) => {
			const { cwd, oldBase, newBase, head } = testMergeRepo(t);
			const env = { CHANGED_ONLY: 'true', PR_BASE: oldBase, PR_HEAD: head };
			const run = runEntryPoint(t, env, cwd);
			assert.deepEqual(run.args, [ROOT, newBase]);
			assert.equal(run.log, `changed-only base: ${newBase} (test merge first parent)`);
		});

		test('pull_request keeps the PR base when HEAD is not the test merge of PR_HEAD', (t) => {
			const { cwd, oldBase } = testMergeRepo(t);
			const env = { CHANGED_ONLY: 'true', PR_BASE: oldBase, PR_HEAD: 'f'.repeat(40) };
			const run = runEntryPoint(t, env, cwd);
			assert.deepEqual(run.args, [ROOT, oldBase]);
			assert.equal(run.log, `changed-only base: ${oldBase} (PR base)`);
		});

		test('pull_request keeps the PR base when the checkout is the PR head itself', (t) => {
			const { cwd, oldBase, head } = testMergeRepo(t);
			git(cwd, 'checkout', '-q', head);
			const env = { CHANGED_ONLY: 'true', PR_BASE: oldBase, PR_HEAD: head };
			const run = runEntryPoint(t, env, cwd);
			assert.deepEqual(run.args, [ROOT, oldBase]);
			assert.equal(run.log, `changed-only base: ${oldBase} (PR base)`);
		});
	});

	test('writes targets, e2e and artifacts as compact single-line outputs', (t) => {
		const outputs = runEntryPoint(t, {});
		assert.equal(outputs.e2e, '[]');
		assert.equal(outputs.artifacts, '[{"id":"x"}]');
	});
});
