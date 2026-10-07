// actions/plugin-package/package.sh, with a fake `npx` on PATH that stands in
// for @grafana/sign-plugin, so nothing is sent to grafana.com.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { REPO, bash, errors, outputFile, readOutputs, tempDir, writeJson, writeText } from './helpers.ts';

const SCRIPT = join(REPO, '.github/actions/plugin-package/package.sh');

// Logs its arguments, and writes MANIFEST.txt into --distDir the way the
// real signer does.
const FAKE_NPX = `#!/usr/bin/env bash
echo "npx $*" >> "$FAKE_LOG"
while [ "$#" -gt 0 ]; do
  if [ "$1" = --distDir ]; then echo signed > "$2/MANIFEST.txt"; fi
  shift
done
`;

/** Writes a dist/ folder and runs package.sh on it with the fake npx. */
function runPackage(t: TestContext, env: Record<string, string>, pluginJson: unknown = { id: 'my-panel', info: { version: '1.2.3' } }) {
	const workspace = tempDir(t);
	const dist = join(workspace, 'dist');
	writeJson(join(dist, 'plugin.json'), pluginJson);
	writeText(join(dist, 'module.js'), 'console.log(1);\n');
	const fakeBin = join(workspace, 'bin');
	writeText(join(fakeBin, 'npx'), FAKE_NPX, { executable: true });
	const npxLog = join(workspace, 'npx.log');
	writeText(npxLog, '');
	const githubOutput = outputFile(t);
	const output = join(workspace, 'out');
	const packaged = bash(SCRIPT, [dist, output], {
		cwd: workspace,
		env: { PATH: `${fakeBin}:${process.env.PATH}`, FAKE_LOG: npxLog, GITHUB_OUTPUT: githubOutput, ...env },
	});
	const npxCalls = readFileSync(npxLog, 'utf8').trim().split('\n').filter(Boolean);
	return { ...packaged, dist, output, npxCalls, outputs: readOutputs(githubOutput) };
}

const zipEntries = (zipPath: string): string[] =>
	execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).split('\n').filter(Boolean).sort();

const digest = (algorithm: string, path: string): string => createHash(algorithm).update(readFileSync(path)).digest('hex');

describe('actions/plugin-package/package.sh', () => {
	test('signs a copy and zips it under <id>/, with checksums', (t) => {
		const packaged = runPackage(t, { GRAFANA_ACCESS_POLICY_TOKEN: 'token' });
		assert.equal(packaged.status, 0, packaged.stderr);

		const zipPath = join(packaged.output, 'my-panel-1.2.3.zip');
		assert.deepEqual(zipEntries(zipPath), [
			'my-panel/',
			'my-panel/MANIFEST.txt',
			'my-panel/module.js',
			'my-panel/plugin.json',
		]);
		assert.equal(readFileSync(`${zipPath}.sha1`, 'utf8'), digest('sha1', zipPath));
		assert.equal(readFileSync(`${zipPath}.md5`, 'utf8'), digest('md5', zipPath));
		assert.deepEqual(packaged.outputs, { zip: 'my-panel-1.2.3.zip' });
		assert.deepEqual(packaged.npxCalls, ['npx -y @grafana/sign-plugin@3.3.3 --signatureType=grafana --distDir my-panel']);
		assert.ok(!existsSync(join(packaged.dist, 'MANIFEST.txt')), 'signing must not touch the dist folder');
	});

	test('passes the signature type through', (t) => {
		const packaged = runPackage(t, { GRAFANA_ACCESS_POLICY_TOKEN: 'token', SIGNATURE_TYPE: 'private' });
		assert.equal(packaged.status, 0, packaged.stderr);
		assert.match(packaged.npxCalls[0], /--signatureType=private /);
	});

	test('fails without a token unless unsigned plugins are allowed', (t) => {
		const packaged = runPackage(t, {});
		assert.equal(packaged.status, 1);
		assert.deepEqual(errors(packaged.stdout), ['::error::No access policy token, and unsigned plugins are not allowed.']);
		assert.ok(!existsSync(packaged.output), 'nothing is packaged');
	});

	test('packages unsigned when allowed, without calling the signer', (t) => {
		const packaged = runPackage(t, { ALLOW_UNSIGNED: 'true' });
		assert.equal(packaged.status, 0, packaged.stderr);
		assert.deepEqual(packaged.npxCalls, []);
		assert.deepEqual(zipEntries(join(packaged.output, 'my-panel-1.2.3.zip')), [
			'my-panel/',
			'my-panel/module.js',
			'my-panel/plugin.json',
		]);
	});

	test('fails when plugin.json has no version', (t) => {
		const packaged = runPackage(t, { ALLOW_UNSIGNED: 'true' }, { id: 'my-panel' });
		assert.equal(packaged.status, 1);
		assert.equal(errors(packaged.stdout).length, 1);
		assert.match(errors(packaged.stdout)[0], /missing id or info\.version/);
	});
});
