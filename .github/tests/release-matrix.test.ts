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

// The Renderer: a release that is not a plugin, at the root path, so every commit in the repo counts for it.
const rendererConfig = { packages: { ...config.packages, '.': { component: 'grafana-echarts-renderer' } } };
const artifacts = [
	{
		dir: 'plugins/packages/@plugins/grafana-echarts',
		pkg: '@plugins/grafana-echarts',
		id: 'grafana-echarts-renderer',
		script: 'check:renderer',
		dist: 'dist-renderer',
		package_json: 'src/renderer/renderer.package.json',
	},
];
const pluginFields = { kind: 'plugin', dist: '', package_json: '', files: 'release-assets/*.zip\nrelease-assets/*.zip.sha1', notes: '' };
const rendererRelease = {
	kind: 'artifact',
	id: 'grafana-echarts-renderer',
	dir: 'plugins/packages/@plugins/grafana-echarts',
	pkg: '@plugins/grafana-echarts',
	script: 'check:renderer',
	dist: 'dist-renderer',
	package_json: 'src/renderer/renderer.package.json',
	tag: 'grafana-echarts-renderer/v0.1.0',
	sha: 'def456',
	version: '0.1.0',
	files: 'release-assets/files/*',
	notes: 'release-assets/notes/release-notes.md',
};

/**
 * release-please-action's outputs for the given releases, keyed by package path. As its setPathOutput does, the
 * root path `.` gets no prefix.
 */
function releaseOutputs(released: Record<string, { tag: string; sha: string; version: string }>): Record<string, string> {
	const outputs: Record<string, string> = {
		releases_created: String(Object.keys(released).length > 0),
		paths_released: JSON.stringify(Object.keys(released)),
	};
	for (const [path, release] of Object.entries(released)) {
		const prefix = path === '.' ? '' : `${path}--`;
		outputs[`${prefix}release_created`] = 'true';
		outputs[`${prefix}tag_name`] = release.tag;
		outputs[`${prefix}sha`] = release.sha;
		outputs[`${prefix}version`] = release.version;
	}
	return outputs;
}

function runReleaseMatrix(
	t: TestContext,
	outputs: Record<string, string>,
	{
		buildTargets = targets,
		releaseConfig = config,
		releaseArtifacts,
	}: { buildTargets?: unknown[]; releaseConfig?: unknown; releaseArtifacts?: unknown[] } = {}
) {
	const configFile = join(tempDir(t), 'release-please-config.json');
	writeJson(configFile, releaseConfig);
	const githubOutput = outputFile(t);
	const matrix = bash(SCRIPT, [], {
		env: {
			RELEASE_OUTPUTS: JSON.stringify(outputs),
			CONFIG: configFile,
			TARGETS: JSON.stringify(buildTargets),
			// Unset when the test gives none: the script then reads it as no artifacts.
			ARTIFACTS: releaseArtifacts === undefined ? undefined : JSON.stringify(releaseArtifacts),
			GITHUB_OUTPUT: githubOutput,
		},
	});
	const outputsWritten = readOutputs(githubOutput);
	const parse = (value: string | undefined) => (value === undefined ? undefined : JSON.parse(value));
	return {
		...matrix,
		configFile,
		releases: parse(outputsWritten.releases),
		plugins: parse(outputsWritten.plugins),
		artifacts: parse(outputsWritten.artifacts),
	};
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
				...pluginFields,
				id: 'grafana-relations-panel',
				tag: 'grafana-relations-panel/v0.1.0',
				sha: 'abc123',
				version: '0.1.0',
				dir: 'plugins/packages/@plugins/grafana-echarts',
				pkg: '@plugins/grafana-echarts',
				script: 'build:relations',
			},
			{
				...pluginFields,
				id: 'grafana-clock-panel',
				tag: 'grafana-clock-panel/v3.3.0',
				sha: 'abc123',
				version: '3.3.0',
				dir: clockPath,
				pkg: 'grafana-clock-panel',
				script: 'build',
			},
		]);
		assert.deepEqual(matrix.plugins, matrix.releases);
		assert.deepEqual(matrix.artifacts, []);
	});

	test('is empty when nothing was released', (t) => {
		const matrix = runReleaseMatrix(t, releaseOutputs({}));
		assert.equal(matrix.status, 0, matrix.stderr);
		assert.deepEqual(matrix.releases, []);
		assert.deepEqual(matrix.plugins, []);
		assert.deepEqual(matrix.artifacts, []);
	});

	describe('a release that is not a plugin, at the root path', () => {
		const renderer = { releaseConfig: rendererConfig, releaseArtifacts: artifacts };

		test('released alone: reads the root outputs, which have no path prefix', (t) => {
			const matrix = runReleaseMatrix(
				t,
				releaseOutputs({ '.': { tag: 'grafana-echarts-renderer/v0.1.0', sha: 'def456', version: '0.1.0' } }),
				renderer
			);
			assert.equal(matrix.status, 0, matrix.stderr);
			assert.deepEqual(matrix.releases, [rendererRelease]);
			assert.deepEqual(matrix.artifacts, [rendererRelease]);
			assert.deepEqual(matrix.plugins, []);
		});

		test('released with a plugin: one entry in each build matrix, both in releases', (t) => {
			const matrix = runReleaseMatrix(
				t,
				releaseOutputs({
					'.': { tag: 'grafana-echarts-renderer/v0.1.0', sha: 'def456', version: '0.1.0' },
					[relationsPath]: { tag: 'grafana-relations-panel/v0.3.0', sha: 'abc123', version: '0.3.0' },
				}),
				renderer
			);
			assert.equal(matrix.status, 0, matrix.stderr);
			assert.deepEqual(
				matrix.releases.map((release: { id: string; kind: string; tag: string; sha: string }) => [release.id, release.kind, release.tag, release.sha]),
				[
					['grafana-echarts-renderer', 'artifact', 'grafana-echarts-renderer/v0.1.0', 'def456'],
					['grafana-relations-panel', 'plugin', 'grafana-relations-panel/v0.3.0', 'abc123'],
				]
			);
			assert.deepEqual(matrix.artifacts, [rendererRelease]);
			assert.deepEqual(
				matrix.plugins.map((release: { id: string }) => release.id),
				['grafana-relations-panel']
			);
		});

		test('passes the config check with nothing released', (t) => {
			const matrix = runReleaseMatrix(t, {}, renderer);
			assert.equal(matrix.status, 0, matrix.stderr);
			assert.deepEqual(matrix.releases, []);
		});

		test('fails when no package declares the release', (t) => {
			const matrix = runReleaseMatrix(t, {}, { releaseConfig: rendererConfig, releaseArtifacts: [] });
			assert.equal(matrix.status, 1);
			assert.match(errors(matrix.stdout)[0], /component 'grafana-echarts-renderer' matches no plugin that a package builds, and no plugin-ci.json release/);
		});

		test('fails when the outputs of a released path have no tag, so no job builds the default branch', (t) => {
			// What the root release looks like if it is read with a `.--` prefix.
			const outputs = { paths_released: '["."]', '.--tag_name': 'grafana-echarts-renderer/v0.1.0', '.--sha': 'def456', '.--version': '0.1.0' };
			const matrix = runReleaseMatrix(t, outputs, renderer);
			assert.equal(matrix.status, 1);
			assert.match(errors(matrix.stdout)[0], /released '\.' but its outputs have no tag_name, sha or version/);
			assert.equal(matrix.releases, undefined);
		});
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
