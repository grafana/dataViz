// discover.sh: build targets, e2e detection, validation, changed-only filtering.
import assert from 'node:assert/strict';
import { renameSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { DISCOVER, type PkgOptions, type RunResult, bash, errors, git, mkPkg, tempDir, writeJson, writeText } from './helpers.ts';

interface Target {
	dir: string;
	pkg: string;
	id: string;
	script: string;
	plugin_json: string;
}
interface E2e {
	dir: string;
	pkg: string;
	url: string;
	grafana_dependency: string;
	id: string;
	script: string;
	plugin_json: string;
	compose: string;
}

function discover(root: string, args: string[] = [], cwd?: string, env: Record<string, string> = {}): RunResult {
	return bash(DISCOVER, [root, ...args], cwd ? { cwd, env } : { env });
}

interface Artifact {
	dir: string;
	pkg: string;
	id: string;
	script: string;
	dist: string;
	package_json: string;
}

function ok(result: RunResult): { targets: Target[]; e2e: E2e[]; artifacts: Artifact[] } {
	assert.equal(result.status, 0, result.stderr);
	return JSON.parse(result.stdout);
}

describe('discover-plugins/discover.sh', () => {
	describe('targets', () => {
		test('a package without plugin-ci.json has one implicit target', (t) => {
			const root = tempDir(t);
			mkPkg(root, 'clock', { id: 'clock-panel' });
			const { targets } = ok(discover(root));
			assert.deepEqual(targets, [
				{
					dir: join(root, 'clock'),
					pkg: '@t/clock',
					id: 'clock-panel',
					script: 'build',
					plugin_json: 'src/plugin.json',
				},
			]);
		});

		test('declared targets replace the implicit one', (t) => {
			const root = tempDir(t);
			const dir = mkPkg(root, 'echarts', {
				id: 'echarts-app',
				scripts: { build: 'x', 'build:relations': 'x' },
				pluginCi: {
					targets: [{ id: 'relations-panel', script: 'build:relations', pluginJson: 'src/modules/relations/plugin.json' }],
				},
			});
			writeText(join(dir, 'src/modules/relations/plugin.json'), JSON.stringify({ id: 'relations-panel' }));
			const { targets } = ok(discover(root));
			assert.deepEqual(
				targets.map((target) => [target.id, target.script]),
				[['relations-panel', 'build:relations']]
			);
		});

		test('a plugin-ci.json with only e2e keeps the implicit target', (t) => {
			const root = tempDir(t);
			mkPkg(root, 'p', { id: 'p-panel', pluginCi: { e2e: { url: 'http://127.0.0.1:4000' } } });
			const { targets } = ok(discover(root));
			assert.deepEqual(
				targets.map((target) => target.id),
				['p-panel']
			);
		});
	});

	describe('artifacts', () => {
		const releases = [{ id: 'x-renderer', script: 'check:renderer', dist: 'dist-renderer', packageJson: 'src/renderer/renderer.package.json' }];

		test('a package without plugin-ci.json releases has none', (t) => {
			const root = tempDir(t);
			mkPkg(root, 'clock', { id: 'clock-panel' });
			assert.deepEqual(ok(discover(root)).artifacts, []);
		});

		test('lists each release that is not a plugin, and keeps the plugin targets', (t) => {
			const root = tempDir(t);
			const dir = mkPkg(root, 'echarts', { id: 'echarts-app', scripts: { build: 'x', 'check:renderer': 'x' }, pluginCi: { releases } });
			writeJson(join(dir, 'src/renderer/renderer.package.json'), { name: 'x-renderer' });
			const discovered = ok(discover(root));
			assert.deepEqual(discovered.artifacts, [
				{
					dir,
					pkg: '@t/echarts',
					id: 'x-renderer',
					script: 'check:renderer',
					dist: 'dist-renderer',
					package_json: 'src/renderer/renderer.package.json',
				},
			]);
			assert.deepEqual(
				discovered.targets.map((target) => target.id),
				['echarts-app']
			);
		});

		test('packageJson is optional', (t) => {
			const root = tempDir(t);
			mkPkg(root, 'p', { id: 'p-panel', pluginCi: { releases: [{ id: 'p-bundle', script: 'build', dist: 'out' }] } });
			assert.equal(ok(discover(root)).artifacts[0].package_json, '');
		});

		test('rejects a release id that is a plugin target of a later package', (t) => {
			const root = tempDir(t);
			mkPkg(root, 'a', { id: 'a-panel', pluginCi: { releases: [{ id: 'b-panel', script: 'build', dist: 'out' }] } });
			mkPkg(root, 'b', { id: 'b-panel' });
			const discovery = discover(root);
			assert.equal(discovery.status, 1);
			assert.deepEqual(errors(discovery.stderr), [
				`::error file=${join(root, 'a', 'plugin-ci.json')}::release id b-panel is also the id of a plugin target`,
			]);
		});
	});

	describe('e2e', () => {
		test('lists only packages with both an e2e script and playwright.config.ts, at :3000 by default', (t) => {
			const root = tempDir(t);
			mkPkg(root, 'with', { id: 'with-panel', scripts: { build: 'x', e2e: 'x' }, playwright: true });
			mkPkg(root, 'without', { id: 'without-panel' });
			const { e2e } = ok(discover(root));
			assert.deepEqual(e2e, [
				{
					dir: join(root, 'with'),
					pkg: '@t/with',
					url: 'http://127.0.0.1:3000',
					grafana_dependency: '>=12.0.0',
					id: '',
					script: 'build',
					plugin_json: 'src/plugin.json',
					compose: 'docker-compose.yaml',
				},
			]);
		});

		test('e2e.url overrides the default', (t) => {
			const root = tempDir(t);
			mkPkg(root, 'p', {
				id: 'p-panel',
				scripts: { build: 'x', e2e: 'x' },
				playwright: true,
				pluginCi: { e2e: { url: 'http://127.0.0.1:3020' } },
			});
			assert.equal(ok(discover(root)).e2e[0].url, 'http://127.0.0.1:3020');
		});

		test('e2e.target builds that target and takes the Grafana versions from its plugin.json', (t) => {
			const root = tempDir(t);
			const dir = mkPkg(root, 'echarts', {
				id: 'echarts-app',
				scripts: { build: 'x', 'build:relations': 'x', e2e: 'x' },
				playwright: true,
				pluginCi: {
					targets: [
						{ id: 'relations-panel', script: 'build:relations', pluginJson: 'src/modules/relations/plugin.json' },
						{ id: 'echarts-app', script: 'build', pluginJson: 'src/plugin.json' },
					],
					e2e: { target: 'relations-panel' },
				},
			});
			writeJson(join(dir, 'src/modules/relations/plugin.json'), {
				id: 'relations-panel',
				dependencies: { grafanaDependency: '>=13.2.0-0' },
			});
			const [suite] = ok(discover(root)).e2e;
			assert.deepEqual(
				[suite.id, suite.script, suite.plugin_json, suite.grafana_dependency],
				['relations-panel', 'build:relations', 'src/modules/relations/plugin.json', '>=13.2.0-0']
			);
		});

		test('e2e.compose selects the compose file', (t) => {
			const root = tempDir(t);
			const dir = mkPkg(root, 'p', {
				id: 'p-panel',
				scripts: { build: 'x', e2e: 'x' },
				playwright: true,
				pluginCi: { e2e: { compose: 'compose/relations.yaml' } },
			});
			writeText(join(dir, 'compose/relations.yaml'), 'services: {}\n');
			assert.equal(ok(discover(root)).e2e[0].compose, 'compose/relations.yaml');
		});
	});

	describe('validation', () => {
		const cases: { name: string; pkg: PkgOptions; error: string }[] = [
			{ name: 'rejects a target id that is not lowercase-kebab', pkg: { id: 'x', pluginCi: { targets: [{ id: 'Bad_Id', script: 'build', pluginJson: 'src/plugin.json' }] } }, error: 'must match' },
			{ name: 'rejects a target script that package.json does not define', pkg: { id: 'x', pluginCi: { targets: [{ id: 'x', script: 'build:nope', pluginJson: 'src/plugin.json' }] } }, error: "script 'build:nope' is not in" },
			{ name: 'rejects a target pluginJson that does not exist', pkg: { id: 'x', pluginCi: { targets: [{ id: 'x', script: 'build', pluginJson: 'src/missing.json' }] } }, error: 'does not exist' },
			{ name: 'rejects a target whose pluginJson has a different id', pkg: { id: 'actual', pluginCi: { targets: [{ id: 'declared', script: 'build', pluginJson: 'src/plugin.json' }] } }, error: "has id 'actual'" },
			{ name: 'rejects an empty targets list', pkg: { id: 'x', pluginCi: { targets: [] } }, error: 'non-empty array' },
			{ name: 'rejects a package with no targets and no src/plugin.json id', pkg: {}, error: 'no build target' },
			{ name: 'rejects an e2e script without playwright.config.ts', pkg: { id: 'x', scripts: { build: 'x', e2e: 'x' } }, error: 'no playwright.config.ts' },
			{ name: 'rejects playwright.config.ts without an e2e script', pkg: { id: 'x', playwright: true }, error: 'has no e2e script' },
			{ name: 'rejects an e2e suite with no grafanaDependency to pick versions from', pkg: { id: 'x', scripts: { build: 'x', e2e: 'x' }, playwright: true, grafanaDependency: '' }, error: 'no dependencies.grafanaDependency' },
			{ name: 'rejects an e2e.target that is not one of the targets', pkg: { id: 'x', scripts: { build: 'x', e2e: 'x' }, playwright: true, pluginCi: { e2e: { target: 'nope' } } }, error: "e2e.target 'nope' is not one of" },
			{ name: 'rejects an e2e.compose file that does not exist', pkg: { id: 'x', scripts: { build: 'x', e2e: 'x' }, playwright: true, pluginCi: { e2e: { compose: 'missing.yaml' } } }, error: "e2e.compose 'missing.yaml' does not exist" },
			{ name: 'rejects an empty releases list', pkg: { id: 'x', pluginCi: { releases: [] } }, error: 'releases must be a non-empty array' },
			{ name: 'rejects a releases entry that is not an object', pkg: { id: 'x', pluginCi: { releases: ['x-renderer'] } }, error: 'releases[0] must be an object' },
			{ name: 'rejects a release with no id', pkg: { id: 'x', pluginCi: { releases: [{ script: 'build', dist: 'out' }] } }, error: "release id '' must match" },
			{ name: 'rejects a release id that is not lowercase-kebab', pkg: { id: 'x', pluginCi: { releases: [{ id: 'Bad_Id', script: 'build', dist: 'out' }] } }, error: "release id 'Bad_Id' must match" },
			{ name: 'rejects a release with an unknown key', pkg: { id: 'x', pluginCi: { releases: [{ id: 'x-renderer', script: 'build', dist: 'out', pluginJson: 'src/plugin.json' }] } }, error: 'release x-renderer: unknown key pluginJson' },
			{ name: 'rejects a release script that package.json does not define', pkg: { id: 'x', pluginCi: { releases: [{ id: 'x-renderer', script: 'check:nope', dist: 'out' }] } }, error: "release x-renderer: script 'check:nope' is not in" },
			{ name: 'rejects a release with no script', pkg: { id: 'x', pluginCi: { releases: [{ id: 'x-renderer', dist: 'out' }] } }, error: "release x-renderer: script '' is not in" },
			{ name: 'rejects a release with no dist', pkg: { id: 'x', pluginCi: { releases: [{ id: 'x-renderer', script: 'build' }] } }, error: 'release x-renderer: dist must be a relative path' },
			{ name: 'rejects a release dist with ..', pkg: { id: 'x', pluginCi: { releases: [{ id: 'x-renderer', script: 'build', dist: '../other/dist' }] } }, error: 'release x-renderer: dist must be a relative path' },
			{ name: 'rejects an absolute release dist', pkg: { id: 'x', pluginCi: { releases: [{ id: 'x-renderer', script: 'build', dist: '/tmp/dist' }] } }, error: 'release x-renderer: dist must be a relative path' },
			{ name: 'rejects a release packageJson that does not exist', pkg: { id: 'x', pluginCi: { releases: [{ id: 'x-renderer', script: 'build', dist: 'out', packageJson: 'src/missing.json' }] } }, error: "release x-renderer: packageJson 'src/missing.json' does not exist" },
			{ name: 'rejects a release packageJson with ..', pkg: { id: 'x', pluginCi: { releases: [{ id: 'x-renderer', script: 'build', dist: 'out', packageJson: '../package.json' }] } }, error: 'release x-renderer: packageJson must be a relative path' },
			{ name: 'rejects the same release id two times', pkg: { id: 'x', pluginCi: { releases: [{ id: 'x-renderer', script: 'build', dist: 'out' }, { id: 'x-renderer', script: 'build', dist: 'out2' }] } }, error: 'release id x-renderer is declared more than once' },
			{ name: 'rejects a release id that is the id of a plugin target, because the two would share tags', pkg: { id: 'x', pluginCi: { releases: [{ id: 'x', script: 'build', dist: 'out' }] } }, error: 'release id x is also the id of a plugin target' },
		];

		for (const { name, pkg, error } of cases) {
			test(name, (t) => {
				const root = tempDir(t);
				mkPkg(root, 'p', pkg);
				const discovery = discover(root);
				assert.equal(discovery.status, 1);
				assert.equal(discovery.stdout, '', 'nothing on stdout when discovery fails');
				const annotations = errors(discovery.stderr);
				assert.equal(annotations.length, 1, discovery.stderr);
				assert.ok(annotations[0].includes(error), annotations[0]);
			});
		}

		test('rejects a package.json without a name, which pnpm --filter cannot select', (t) => {
		const root = tempDir(t);
		const dir = mkPkg(root, 'p', { id: 'p-panel' });
		writeJson(join(dir, 'package.json'), { scripts: { build: 'x' } });
		const discovery = discover(root);
		assert.equal(discovery.status, 1);
		assert.match(errors(discovery.stderr).join('\n'), /has no name/);
	});

	test('rejects a plugin-ci.json that is not valid JSON, with an annotation on it', (t) => {
		const root = tempDir(t);
		const dir = mkPkg(root, 'p', { id: 'p-panel' });
		writeText(join(dir, 'plugin-ci.json'), '{ "targets": [], }');
		const discovery = discover(root);
		assert.equal(discovery.status, 1);
		assert.deepEqual(errors(discovery.stderr), [`::error file=${join(dir, 'plugin-ci.json')}::is not valid JSON`]);
	});

	test('escapes PR-controlled text in annotations, so it cannot start another workflow command', (t) => {
		const root = tempDir(t);
		mkPkg(root, 'p', { id: 'x', pluginCi: { targets: [{ id: 'bad\n::warning::injected 100%', script: 'build', pluginJson: 'src/plugin.json' }] } });
		const discovery = discover(root);
		assert.equal(discovery.status, 1);
		const commandLines = discovery.stderr.split('\n').filter((line) => line.startsWith('::'));
		assert.equal(commandLines.length, 1, discovery.stderr);
		assert.match(commandLines[0], /^::error file=.*::target id 'bad%0A::warning::injected 100%25' must match/);
	});

	test('rejects a targets entry that is not an object, with an annotation', (t) => {
		const root = tempDir(t);
		mkPkg(root, 'p', { id: 'p-panel', pluginCi: { targets: ['grafana-p-panel'] } });
		const discovery = discover(root);
		assert.equal(discovery.status, 1);
		assert.match(errors(discovery.stderr).join('\n'), /targets\[0\] must be an object/);
	});

	const badE2e: { name: string; e2e: unknown; error: string }[] = [
		{ name: 'rejects an e2e block that is not an object', e2e: 'http://127.0.0.1:3020', error: 'e2e must be an object' },
		{ name: 'rejects an e2e.url that is not a string', e2e: { url: 3020 }, error: 'e2e.url must be an http:// or https:// URL' },
		{ name: 'rejects an e2e.url that is not an http(s) URL', e2e: { url: '127.0.0.1:3020' }, error: 'e2e.url must be an http:// or https:// URL' },
		{ name: 'rejects an e2e.target that is not a string', e2e: { target: 1 }, error: 'e2e.target must be the id' },
		{ name: 'rejects an e2e.compose with ..', e2e: { compose: '../other/docker-compose.yaml' }, error: 'e2e.compose must be a relative path' },
		{ name: 'rejects an absolute e2e.compose', e2e: { compose: '/etc/compose.yaml' }, error: 'e2e.compose must be a relative path' },
	];
	for (const { name, e2e, error } of badE2e) {
		test(name, (t) => {
			const root = tempDir(t);
			mkPkg(root, 'p', { id: 'p-panel', pluginCi: { e2e } });
			const discovery = discover(root);
			assert.equal(discovery.status, 1);
			assert.match(errors(discovery.stderr).join('\n'), new RegExp(error.replace(/[()]/g, '\\$&')));
		});
	}

	test('rejects a plugin-ci.json that is not an object', (t) => {
		const root = tempDir(t);
		mkPkg(root, 'p', { id: 'p-panel', pluginCi: [] });
		const discovery = discover(root);
		assert.equal(discovery.status, 1);
		assert.match(errors(discovery.stderr).join('\n'), /must be a JSON object/);
	});

	test('rejects the same plugin id in two packages', (t) => {
			const root = tempDir(t);
			mkPkg(root, 'a', { id: 'same-panel' });
			mkPkg(root, 'b', { id: 'same-panel' });
			const discovery = discover(root);
			assert.equal(discovery.status, 1);
			assert.match(errors(discovery.stderr).join('\n'), /declared more than once/);
		});

		test('reports every error before exiting, not just the first', (t) => {
			const root = tempDir(t);
			mkPkg(root, 'a', {});
			mkPkg(root, 'b', { id: 'x', playwright: true });
			const discovery = discover(root);
			assert.equal(discovery.status, 1);
			assert.equal(errors(discovery.stderr).length, 2, discovery.stderr);
		});
	});

	describe('changed-only', () => {
		// A temp repo laid out like this one, so paths match the real rules.
		function repo(t: TestContext): { cwd: string; root: string; base: string } {
			const cwd = tempDir(t);
			const root = 'plugins/packages/@plugins';
			git(cwd, 'init', '-q', '-b', 'main');
			mkPkg(join(cwd, root), 'clock', { id: 'clock-panel', scripts: { build: 'x', e2e: 'x' }, playwright: true });
			mkPkg(join(cwd, root), 'echarts', { id: 'echarts-app' });
			writeText(join(cwd, 'plugins/pnpm-lock.yaml'), 'lockfileVersion: 9\n');
			writeText(join(cwd, 'plugins/.shared/webpack-shared.mjs'), 'export {};\n');
			git(cwd, 'add', '-A');
			git(cwd, 'commit', '-qm', 'base');
			return { cwd, root, base: git(cwd, 'rev-parse', 'HEAD') };
		}

		function change(cwd: string, path: string): void {
			writeText(join(cwd, path), `// ${Math.random()}\n`);
			git(cwd, 'add', '-A');
			git(cwd, 'commit', '-qm', 'change');
		}

		/** The target ids and e2e packages discovery selects for changes since `base`. */
		function selected(cwd: string, root: string, base: string, sharedPaths = ''): { targets: string[]; e2e: string[] } {
			const discovered = ok(discover(root, [base], cwd, { SHARED_PATHS: sharedPaths }));
			return {
				targets: discovered.targets.map((target) => target.id).sort(),
				e2e: discovered.e2e.map((suite) => suite.pkg).sort(),
			};
		}

		test('a change inside one package selects only that package', (t) => {
			const { cwd, root, base } = repo(t);
			change(cwd, `${root}/clock/src/module.ts`);
			assert.deepEqual(selected(cwd, root, base), { targets: ['clock-panel'], e2e: ['@t/clock'] });
		});

		test('a change inside one package keeps only the releases of that package', (t) => {
			const { cwd, root, base } = repo(t);
			writeJson(join(cwd, root, 'echarts/plugin-ci.json'), { releases: [{ id: 'echarts-renderer', script: 'build', dist: 'out' }] });
			git(cwd, 'add', '-A');
			git(cwd, 'commit', '-qm', 'release');
			const artifactIds = () => ok(discover(root, [base], cwd)).artifacts.map((artifact) => artifact.id);
			assert.deepEqual(artifactIds(), ['echarts-renderer']);
			const before = git(cwd, 'rev-parse', 'HEAD');
			change(cwd, `${root}/clock/src/module.ts`);
			assert.deepEqual(
				ok(discover(root, [before], cwd)).artifacts.map((artifact) => artifact.id),
				[]
			);
		});

		test('no relevant change selects nothing', (t) => {
			const { cwd, root, base } = repo(t);
			change(cwd, 'README.md');
			assert.deepEqual(selected(cwd, root, base), { targets: [], e2e: [] });
		});

		for (const path of [
			'plugins/pnpm-lock.yaml',
			'plugins/.shared/webpack-shared.mjs',
			'plugins/turbo.json',
			'.github/actions/discover-plugins/discover.sh',
			'.github/actions/setup-workspace/action.yaml',
			'.github/scripts/build-target.sh',
		]) {
			test(`${path} selects every package`, (t) => {
				const { cwd, root, base } = repo(t);
				change(cwd, path);
				assert.deepEqual(selected(cwd, root, base).targets, ['clock-panel', 'echarts-app']);
			});
		}

		test('a file listed in SHARED_PATHS selects every package; without it, nothing', (t) => {
			const { cwd, root, base } = repo(t);
			change(cwd, '.github/workflows/plugin-ci.yml');
			const sharedPaths = '.github/workflows/plugin-ci.yml\n.github/scripts/find-module.sh\n';
			assert.deepEqual(selected(cwd, root, base, sharedPaths).targets, ['clock-panel', 'echarts-app']);
			assert.deepEqual(selected(cwd, root, base).targets, []);
		});

		test('a file moved out of a package selects the package it left', (t) => {
			// Without --no-renames, git reports only the new path and clock is missed.
			const { cwd, root } = repo(t);
			writeText(join(cwd, root, 'clock/src/moved.ts'), 'export const x = 1;\n'.repeat(20));
			git(cwd, 'add', '-A');
			git(cwd, 'commit', '-qm', 'add');
			const before = git(cwd, 'rev-parse', 'HEAD');
			renameSync(join(cwd, root, 'clock/src/moved.ts'), join(cwd, root, 'echarts/moved.ts'));
			git(cwd, 'add', '-A');
			git(cwd, 'commit', '-qm', 'move');
			assert.deepEqual(selected(cwd, root, before).targets, ['clock-panel', 'echarts-app']);
		});

		test('a change to a file with a non-ASCII name selects its package', (t) => {
			const { cwd, root, base } = repo(t);
			change(cwd, `${root}/clock/src/img/ü.svg`);
			assert.deepEqual(selected(cwd, root, base), { targets: ['clock-panel'], e2e: ['@t/clock'] });
		});

		test('a root given with a trailing slash still selects the changed package', (t) => {
			const { cwd, root, base } = repo(t);
			change(cwd, `${root}/clock/src/module.ts`);
			assert.deepEqual(selected(cwd, `${root}/`, base), { targets: ['clock-panel'], e2e: ['@t/clock'] });
		});

		test('an empty base filters nothing', (t) => {
			const { cwd, root } = repo(t);
			const discovery = discover(root, [''], cwd);
			assert.equal(discovery.status, 0, discovery.stderr);
			assert.equal(JSON.parse(discovery.stdout).targets.length, 2);
		});

		test('an unusable base warns and selects everything', (t) => {
			const { cwd, root } = repo(t);
			const discovery = discover(root, ['0123456789abcdef0123456789abcdef01234567'], cwd);
			assert.equal(discovery.status, 0, discovery.stderr);
			assert.match(discovery.stderr, /::warning::cannot diff against/);
			assert.equal(JSON.parse(discovery.stdout).targets.length, 2);
		});
	});
});
