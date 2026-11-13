// scripts/peer-range-notes.sh: the peer dependency note of a non-plugin release, against temp git repos.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { SCRIPTS, bash, git, tempDir, writeJson } from './helpers.ts';

const SCRIPT = join(SCRIPTS, 'peer-range-notes.sh');
const SOURCE = 'pkg/src/renderer/renderer.package.json';
const BUILT = 'pkg/dist-renderer/package.json';
const OUT = 'out/notes/release-notes.md';
const COMPONENT = 'grafana-echarts-renderer';

type Peers = Record<string, string>;

/** A repo with one commit and one tag per release, in the given order. Each commit has that release's peers. */
function repo(t: TestContext, releases: [version: string, peers: Peers][]): string {
	const cwd = tempDir(t);
	git(cwd, 'init', '-q', '-b', 'main');
	for (const [version, peers] of releases) {
		writeJson(join(cwd, SOURCE), { name: 'renderer', peerDependencies: peers });
		git(cwd, 'add', '-A');
		git(cwd, 'commit', '-qm', `release ${version}`, '--allow-empty');
		git(cwd, 'tag', `${COMPONENT}/v${version}`);
	}
	return cwd;
}

/** Runs the script for the release of `version`, whose build has `peers`, and returns the notes file. */
function notes(cwd: string, version: string, peers: Peers, env: Record<string, string> = {}): string {
	writeJson(join(cwd, BUILT), { name: 'renderer', version, peerDependencies: peers });
	const run = bash(SCRIPT, [], { cwd, env: { TAG: `${COMPONENT}/v${version}`, SOURCE, BUILT, OUT, ...env } });
	assert.equal(run.status, 0, run.stderr);
	return readFileSync(join(cwd, OUT), 'utf8');
}

describe('scripts/peer-range-notes.sh', () => {
	test('names each peer range that changed since the previous release', (t) => {
		const cwd = repo(t, [
			['0.1.0', { react: '^19.2.7', '@grafana/ui': '^13.2.0', '@grafana/data': '^13.2.0' }],
			['0.2.0', { react: '^19.2.7', '@grafana/ui': '^13.3.0', '@grafana/data': '^13.3.0' }],
		]);
		assert.equal(
			notes(cwd, '0.2.0', { react: '^19.2.7', '@grafana/ui': '^13.3.0', '@grafana/data': '^13.3.0' }),
			[
				'### Peer dependencies',
				'',
				'Changed since `grafana-echarts-renderer/v0.1.0`:',
				'',
				'- `@grafana/ui`: `^13.2.0` → `^13.3.0`',
				'- `@grafana/data`: `^13.2.0` → `^13.3.0`',
				'',
			].join('\n')
		);
	});

	test('names a peer that was added and one that was removed', (t) => {
		const cwd = repo(t, [
			['0.1.0', { react: '^19.2.7', lodash: '^4.0.0' }],
			['0.2.0', { react: '^19.2.7', '@emotion/css': '^11.10.6' }],
		]);
		const text = notes(cwd, '0.2.0', { react: '^19.2.7', '@emotion/css': '^11.10.6' });
		assert.match(text, /- `@emotion\/css`: `not a peer` → `\^11\.10\.6`/);
		assert.match(text, /- `lodash`: `\^4\.0\.0` → `removed`/);
	});

	test('writes an empty file when no peer range changed, so nothing is appended', (t) => {
		const peers = { react: '^19.2.7' };
		const cwd = repo(t, [
			['0.1.0', peers],
			['0.2.0', peers],
		]);
		assert.equal(notes(cwd, '0.2.0', peers), '');
	});

	test('lists every peer for the first release', (t) => {
		const peers = { react: '^19.2.7', '@grafana/ui': '^13.3.0' };
		const cwd = repo(t, [['0.1.0', peers]]);
		assert.equal(
			notes(cwd, '0.1.0', peers),
			['### Peer dependencies', '', 'The App must give these packages:', '', '- `react` `^19.2.7`', '- `@grafana/ui` `^13.3.0`', ''].join('\n')
		);
	});

	test('picks the previous release by version, not by tag name or by date', (t) => {
		// v0.10.0 sorts before v0.9.0 by name. v0.9.0 is also the newest tag by date.
		const cwd = repo(t, [
			['0.10.0', { react: '^19.0.0' }],
			['0.11.0', { react: '^19.2.0' }],
			['0.9.0', { react: '^18.0.0' }],
		]);
		assert.match(notes(cwd, '0.11.0', { react: '^19.2.0' }), /Changed since `grafana-echarts-renderer\/v0\.10\.0`:\n\n- `react`: `\^19\.0\.0` → `\^19\.2\.0`/);
	});

	test('ignores the tags of another component', (t) => {
		const cwd = repo(t, [['0.1.0', { react: '^19.2.7' }]]);
		git(cwd, 'tag', 'grafana-relations-panel/v0.0.9');
		assert.match(notes(cwd, '0.1.0', { react: '^19.2.7' }), /The App must give these packages:/);
	});

	test('lists every peer when the previous release does not have the source file', (t) => {
		const cwd = tempDir(t);
		git(cwd, 'init', '-q', '-b', 'main');
		git(cwd, 'commit', '-qm', 'baseline', '--allow-empty');
		git(cwd, 'tag', `${COMPONENT}/v0.0.1`);
		git(cwd, 'commit', '-qm', 'release', '--allow-empty');
		git(cwd, 'tag', `${COMPONENT}/v0.1.0`);
		assert.match(notes(cwd, '0.1.0', { react: '^19.2.7' }), /The App must give these packages:\n\n- `react` `\^19\.2\.7`/);
	});

	test('writes an empty file when the release declares no source', (t) => {
		const cwd = repo(t, [['0.1.0', { react: '^19.2.7' }]]);
		assert.equal(notes(cwd, '0.1.0', { react: '^19.2.7' }, { SOURCE: '' }), '');
	});
});
