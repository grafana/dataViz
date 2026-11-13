// discover-plugins/run.sh: base selection for changed-only, and the outputs.
// discover.sh is replaced by a stub that echoes its arguments, so these tests
// cover only the entry point's own logic.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { ACTION_RUN, bash, outputFile, readOutputs, tempDir, writeText } from './helpers.ts';

function runEntryPoint(t: TestContext, env: Record<string, string>): { args: string[]; e2e: string; artifacts: string } {
	const stubDir = tempDir(t);
	// Echoes its arguments back as `targets`, so the test can see what was passed.
	writeText(join(stubDir, 'discover.sh'), `jq -nc '{targets: $ARGS.positional, e2e: [], artifacts: [{id: "x"}]}' --args "$@"\n`);
	const output = outputFile(t);
	const entryPoint = bash(ACTION_RUN, [], {
		env: { ROOT: 'plugins/packages/@plugins', CHANGED_ONLY: 'false', PR_BASE: '', PUSH_BEFORE: '', ACTION_PATH: stubDir, GITHUB_OUTPUT: output, ...env },
	});
	assert.equal(entryPoint.status, 0, entryPoint.stderr);
	const outputs = readOutputs(output);
	return { args: JSON.parse(outputs.targets), e2e: outputs.e2e, artifacts: outputs.artifacts };
}

describe('discover-plugins/run.sh', () => {
	describe('base selection', () => {
		const ROOT = 'plugins/packages/@plugins';
		// `args` is what run.sh should pass to discover.sh; an empty base means "filter nothing".
		const cases: { name: string; env: Record<string, string>; args: string[] }[] = [
			{ name: 'changed-only off passes an empty base', env: { PR_BASE: 'abc123' }, args: [ROOT, ''] },
			{ name: 'pull_request uses the PR base', env: { CHANGED_ONLY: 'true', PR_BASE: 'abc123', PUSH_BEFORE: 'def456' }, args: [ROOT, 'abc123'] },
			{ name: 'push uses the previous commit', env: { CHANGED_ONLY: 'true', PUSH_BEFORE: 'def456' }, args: [ROOT, 'def456'] },
			{ name: 'a branch-creating push (all-zero before) passes an empty base', env: { CHANGED_ONLY: 'true', PUSH_BEFORE: '0'.repeat(40) }, args: [ROOT, ''] },
			{ name: 'no event base (workflow_dispatch) passes an empty base', env: { CHANGED_ONLY: 'true' }, args: [ROOT, ''] },
		];

		for (const { name, env, args } of cases) {
			test(name, (t) => {
				assert.deepEqual(runEntryPoint(t, env).args, args);
			});
		}
	});

	test('writes targets, e2e and artifacts as compact single-line outputs', (t) => {
		const outputs = runEntryPoint(t, {});
		assert.equal(outputs.e2e, '[]');
		assert.equal(outputs.artifacts, '[{"id":"x"}]');
	});
});
