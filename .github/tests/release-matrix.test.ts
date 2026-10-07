// scripts/release-matrix.sh: release-please outputs to the release build matrix.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { SCRIPTS, bash, errors, outputFile, readOutputs, tempDir, writeJson } from './helpers.ts';

const SCRIPT = join(SCRIPTS, 'release-matrix.sh');

const relationsPath = 'plugins/packages/@plugins/grafana-echarts/src/modules/relations';
const clockPath = 'plugins/packages/@plugins/grafana-clock-panel';
const config = {
	packages: {
		[relationsPath]: { component: 'grafana-relations-panel' },
		[clockPath]: { component: 'grafana-clock-panel' },
	},
};
const targets = [
	{ dir: 'plugins/packages/@plugins/grafana-echarts', pkg: '@plugins/grafana-echarts', id: 'grafana-relations-panel', script: 'build:relations', plugin_json: 'src/modules/relations/plugin.json' },
	{ dir: 'plugins/packages/@plugins/grafana-echarts', pkg: '@plugins/grafana-echarts', id: 'grafana-echarts-app', script: 'build', plugin_json: 'src/plugin.json' },
	{ dir: clockPath, pkg: 'grafana-clock-panel', id: 'grafana-clock-panel', script: 'build', plugin_json: 'src/plugin.json' },
];

/** release-please-action's outputs for the given releases, keyed by package path. */
function releaseOutputs(released: Record<string, { tag: string; sha: string; version: string }>): Record<string, string> {
	const outputs: Record<string, string> = {
		releases_created: String(Object.keys(released).length > 0),
		paths_released: JSON.stringify(Object.keys(released)),
	};
	for (const [path, release] of Object.entries(released)) {
		outputs[`${path}--release_created`] = 'true';
		outputs[`${path}--tag_name`] = release.tag;
		outputs[`${path}--sha`] = release.sha;
		outputs[`${path}--version`] = release.version;
	}
	return outputs;
}

function runReleaseMatrix(
	t: TestContext,
	outputs: Record<string, string>,
	{ buildTargets = targets, releaseConfig = config }: { buildTargets?: unknown[]; releaseConfig?: unknown } = {}
) {
	const configFile = join(tempDir(t), 'release-please-config.json');
	writeJson(configFile, releaseConfig);
	const githubOutput = outputFile(t);
	const matrix = bash(SCRIPT, [], {
		env: {
			RELEASE_OUTPUTS: JSON.stringify(outputs),
			CONFIG: configFile,
			TARGETS: JSON.stringify(buildTargets),
			GITHUB_OUTPUT: githubOutput,
		},
	});
	const releases = readOutputs(githubOutput).releases;
	return { ...matrix, configFile, releases: releases === undefined ? undefined : JSON.parse(releases) };
}

describe('scripts/release-matrix.sh', () => {
	test('maps each released path to its plugin build target', (t) => {
		const matrix = runReleaseMatrix(
			t,
			releaseOutputs({
				[relationsPath]: { tag: 'grafana-relations-panel/v0.1.0', sha: 'abc123', version: '0.1.0' },
				[clockPath]: { tag: 'grafana-clock-panel/v3.3.0', sha: 'abc123', version: '3.3.0' },
			})
		);
		assert.equal(matrix.status, 0, matrix.stderr);
		assert.deepEqual(matrix.releases, [
			{
				id: 'grafana-relations-panel',
				tag: 'grafana-relations-panel/v0.1.0',
				sha: 'abc123',
				version: '0.1.0',
				dir: 'plugins/packages/@plugins/grafana-echarts',
				pkg: '@plugins/grafana-echarts',
				script: 'build:relations',
			},
			{
				id: 'grafana-clock-panel',
				tag: 'grafana-clock-panel/v3.3.0',
				sha: 'abc123',
				version: '3.3.0',
				dir: clockPath,
				pkg: 'grafana-clock-panel',
				script: 'build',
			},
		]);
	});

	test('is empty when nothing was released', (t) => {
		const matrix = runReleaseMatrix(t, releaseOutputs({}));
		assert.equal(matrix.status, 0, matrix.stderr);
		assert.deepEqual(matrix.releases, []);
	});

	test('fails for a package with no component, even when nothing was released', (t) => {
		const withUnnamed = { packages: { ...config.packages, 'plugins/packages/@plugins/unnamed': {} } };
		const matrix = runReleaseMatrix(t, releaseOutputs({}), { releaseConfig: withUnnamed });
		assert.equal(matrix.status, 1);
		assert.deepEqual(errors(matrix.stdout), [
			`::error file=${matrix.configFile}::release-please package 'plugins/packages/@plugins/unnamed' has no component (plugin id)`,
		]);
		assert.equal(matrix.releases, undefined);
	});

	test('fails for a component that no package builds, even when nothing was released', (t) => {
		const withoutClock = targets.filter((target) => target.id !== 'grafana-clock-panel');
		const matrix = runReleaseMatrix(t, releaseOutputs({}), { buildTargets: withoutClock });
		assert.equal(matrix.status, 1);
		assert.equal(errors(matrix.stdout).length, 1);
		assert.match(errors(matrix.stdout)[0], /component 'grafana-clock-panel' matches no plugin that a package builds/);
		assert.equal(matrix.releases, undefined);
	});

	test('checks the config with no release outputs at all, as the workflow does before release-please', (t) => {
		const matrix = runReleaseMatrix(t, {});
		assert.equal(matrix.status, 0, matrix.stderr);
		assert.deepEqual(matrix.releases, []);
	});
});
