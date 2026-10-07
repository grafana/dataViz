// actions/plugin-validator/validate.sh, with a fake `docker` on PATH, so no
// image is pulled. The real validator was run by hand on the Relations zip.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { REPO, bash, tempDir, writeText } from './helpers.ts';

const SCRIPT = join(REPO, '.github/actions/plugin-validator/validate.sh');

// Logs its arguments, the files in the mounted workspace (the -v source) and
// the version in its package.json,
// then exits with FAKE_EXIT, as the validator exits non-zero on errors.
const FAKE_DOCKER = `#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_LOG"
while [ "$#" -gt 0 ]; do
  if [ "$1" = -v ]; then (cd "\${2%%:*}" && find . -type f | sort && jq -r '"version " + .version' package.json) >> "$FAKE_LOG"; fi
  shift
done
exit "\${FAKE_EXIT:-0}"
`;

function runValidator(t: TestContext, fakeExit: string, sourceVersion = '') {
	const workspace = tempDir(t);
	const source = join(workspace, 'my-panel');
	writeText(join(source, 'src/module.ts'), 'export {};\n');
	writeText(join(source, 'package.json'), '{"name":"my-panel","version":"0.0.1"}\n');
	writeText(join(source, 'node_modules/dep/index.js'), 'module.exports = 1;\n');
	const zip = join(workspace, 'out/my-panel-1.2.3.zip');
	writeText(zip, 'zip');
	const fakeBin = join(workspace, 'bin');
	writeText(join(fakeBin, 'docker'), FAKE_DOCKER, { executable: true });
	const dockerLog = join(workspace, 'docker.log');
	writeText(dockerLog, '');
	const validated = bash(SCRIPT, [source, zip], {
		env: {
			PATH: `${fakeBin}:${process.env.PATH}`,
			FAKE_LOG: dockerLog,
			FAKE_EXIT: fakeExit,
			VALIDATOR_VERSION: 'v9.9.9',
			SOURCE_VERSION: sourceVersion,
		},
	});
	const dockerLines = readFileSync(dockerLog, 'utf8').trim().split('\n');
	return { ...validated, dockerLines };
}

describe('actions/plugin-validator/validate.sh', () => {
	test('runs the pinned validator on the zip and the source, without node_modules', (t) => {
		const validated = runValidator(t, '0');
		assert.equal(validated.status, 0, validated.stderr);

		const [command, ...mountedFiles] = validated.dockerLines;
		assert.match(command, /^docker run --rm --pull=always --platform=linux\/amd64 -e SKIP_CLAMAV=1 -v \S+:\/workspace:ro /);
		assert.match(
			command,
			/ grafana\/plugin-validator-cli:v9\.9\.9 -ghaOutput -config=\/workspace\/\.plugin-validator\.yaml -sourceCodeUri=file:\/\/\/workspace \/workspace\/dist-artifacts\/my-panel-1\.2\.3\.zip$/
		);
		assert.deepEqual(mountedFiles, [
			'./.plugin-validator.yaml',
			'./dist-artifacts/my-panel-1.2.3.zip',
			'./package.json',
			'./src/module.ts',
			'version 0.0.1',
		]);
	});

	test('fails when the validator reports errors', (t) => {
		const validated = runValidator(t, '1');
		assert.equal(validated.status, 1);
	});

	test('gives the validator a package.json with SOURCE_VERSION', (t) => {
		const validated = runValidator(t, '0', '1.2.3');
		assert.equal(validated.status, 0, validated.stderr);
		assert.equal(validated.dockerLines.at(-1), 'version 1.2.3');
	});
});
