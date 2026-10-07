// scripts/build-targets.sh, with a fake `pnpm` on PATH so no real build runs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { SCRIPTS, bash, errors, tempDir, writeText } from './helpers.ts';

const SCRIPT = join(SCRIPTS, 'build-targets.sh');

// The fake pnpm logs every call, and on `--filter <pkg> run <script>` writes
// dist/plugin.json with the id FAKE_BUILT_<script> names (default: the
// package's own id from FAKE_IDS) and version 1.0.0, or fails when the script
// is `fail`.
const FAKE_PNPM = `#!/usr/bin/env bash
echo "pnpm $*" >> "$FAKE_LOG"
if [ "$1" = --filter ] && [ "$3" = run ]; then
  pkg="$2"; script="$4"
  [ "$script" = fail ] && { echo "build failed" >&2; exit 2; }
  [ "$script" = nodist ] && exit 0
  dir="$(jq -r --arg p "$pkg" '.[$p].dir' <<<"$FAKE_IDS")"
  id="$(jq -r --arg p "$pkg" --arg s "$script" '.[$p].built[$s] // .[$p].id' <<<"$FAKE_IDS")"
  mkdir -p "$GITHUB_WORKSPACE/$dir/dist"
  jq -n --arg id "$id" '{id: $id, info: {version: "1.0.0"}}' > "$GITHUB_WORKSPACE/$dir/dist/plugin.json"
fi
`;

interface Target {
	dir: string;
	pkg: string;
	id: string;
	script: string;
}

/** Per package: where it lives, its id, and ids particular scripts build instead. */
type FakeIds = Record<string, { dir: string; id: string; built?: Record<string, string> }>;

/** Runs a build script with the fake pnpm first on PATH; returns its result and the pnpm calls it made. */
function runWithFakePnpm(t: TestContext, scriptPath: string, args: string[], env: Record<string, string>, fakeIds: FakeIds) {
	const workspace = tempDir(t);
	const fakeBin = join(workspace, 'bin');
	writeText(join(fakeBin, 'pnpm'), FAKE_PNPM, { executable: true });
	const pnpmLog = join(workspace, 'pnpm.log');
	writeText(pnpmLog, '');
	const script = bash(scriptPath, args, {
		cwd: workspace,
		env: {
			PATH: `${fakeBin}:${process.env.PATH}`,
			GITHUB_WORKSPACE: workspace,
			FAKE_LOG: pnpmLog,
			FAKE_IDS: JSON.stringify(fakeIds),
			...env,
		},
	});
	const pnpmCalls = readFileSync(pnpmLog, 'utf8').trim().split('\n').filter(Boolean);
	return { ...script, pnpmCalls };
}

function runBuildTargets(t: TestContext, targets: Target[], fakeIds: FakeIds) {
	return runWithFakePnpm(t, SCRIPT, [], { TARGETS: JSON.stringify(targets) }, fakeIds);
}

const clock: Target = { dir: 'p/clock', pkg: '@t/clock', id: 'clock-panel', script: 'build' };
const relations: Target = { dir: 'p/echarts', pkg: '@t/echarts', id: 'relations-panel', script: 'build:relations' };
const packageIds: FakeIds = {
	'@t/clock': { dir: 'p/clock', id: 'clock-panel' },
	'@t/echarts': { dir: 'p/echarts', id: 'relations-panel', built: { build: 'echarts-app' } },
};

describe('scripts/build-targets.sh', () => {
	test('builds every target in order, deps first, inside log groups', (t) => {
		const build = runBuildTargets(t, [clock, relations], packageIds);
		assert.equal(build.status, 0, build.stderr);
		assert.deepEqual(build.pnpmCalls, [
			'pnpm turbo run build --filter @t/clock^... --summarize',
			'pnpm --filter @t/clock run build',
			'pnpm turbo run build --filter @t/echarts^... --summarize',
			'pnpm --filter @t/echarts run build:relations',
		]);
		assert.match(build.stdout, /::group::@t\/clock → clock-panel/);
		assert.match(build.stdout, /::group::@t\/echarts → relations-panel/);
	});

	test('fails when the build put a different plugin in dist/', (t) => {
		const build = runBuildTargets(t, [{ ...relations, script: 'build' }], packageIds);
		assert.equal(build.status, 1);
		assert.match(build.stdout, /::error file=p\/echarts\/dist\/plugin.json::.*built 'echarts-app', expected 'relations-panel'/);
	});

	test('escapes a built plugin id, so it cannot start another workflow command', (t) => {
		const ids: FakeIds = { '@t/clock': { dir: 'p/clock', id: 'clock-panel', built: { build: 'evil\n::warning::injected' } } };
		const build = runBuildTargets(t, [clock], ids);
		assert.equal(build.status, 1);
		const commandLines = build.stdout.split('\n').filter((line) => line.startsWith('::') && !line.startsWith('::group') && !line.startsWith('::endgroup'));
		assert.equal(commandLines.length, 1, build.stdout);
		assert.match(commandLines[0], /built 'evil%0A::warning::injected', expected 'clock-panel'/);
	});

	test('fails with an annotation when the build wrote no dist/plugin.json', (t) => {
		const build = runBuildTargets(t, [{ ...clock, script: 'nodist' }], packageIds);
		assert.equal(build.status, 1);
		assert.match(build.stdout, /::error file=p\/clock\/package.json::.*wrote no dist\/plugin.json/);
	});

	test('stops at the first failing build', (t) => {
		const build = runBuildTargets(t, [{ ...clock, script: 'fail' }, relations], packageIds);
		assert.notEqual(build.status, 0);
		assert.ok(!build.pnpmCalls.some((call) => call.includes('@t/echarts')), 'later targets are not built');
	});

	test('build-target.sh passes extra arguments to the script and skips the id check without ID', (t) => {
		const singleBuild = runWithFakePnpm(
			t,
			join(SCRIPTS, 'build-target.sh'),
			['--profile', '--json', 'stats.json'],
			{ PKG: '@t/echarts', SCRIPT: 'build', DIR: 'p/echarts' },
			packageIds
		);
		// No ID, so echarts' `build` producing the app (not relations) is fine.
		assert.equal(singleBuild.status, 0, singleBuild.stdout + singleBuild.stderr);
		assert.deepEqual(singleBuild.pnpmCalls, [
			'pnpm turbo run build --filter @t/echarts^... --summarize',
			'pnpm --filter @t/echarts run build --profile --json stats.json',
		]);
	});

	test('fails rather than passing green when there are no targets', (t) => {
		const build = runBuildTargets(t, [], packageIds);
		assert.equal(build.status, 1);
		assert.equal(errors(build.stdout).length, 1);
		assert.deepEqual(build.pnpmCalls, []);
	});

	test('build-target.sh checks the built version when VERSION is set', (t) => {
		const env = { PKG: '@t/clock', SCRIPT: 'build', DIR: 'p/clock', ID: 'clock-panel' };
		const matching = runWithFakePnpm(t, join(SCRIPTS, 'build-target.sh'), [], { ...env, VERSION: '1.0.0' }, packageIds);
		assert.equal(matching.status, 0, matching.stdout + matching.stderr);

		const mismatched = runWithFakePnpm(t, join(SCRIPTS, 'build-target.sh'), [], { ...env, VERSION: '2.0.0' }, packageIds);
		assert.equal(mismatched.status, 1);
		assert.deepEqual(errors(mismatched.stdout), [
			"::error file=p/clock/dist/plugin.json::@t/clock script 'build' built clock-panel version '1.0.0', expected '2.0.0'",
		]);
	});
});
