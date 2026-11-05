// Security invariants over every tracked workflow and composite action. These
// overlap zizmor on purpose: they run before push, in milliseconds. Untracked
// files are ignored, so scratch workflows in the working tree don't fail them.
//
// Line-based, not a YAML parser (node has none built in, and this suite adds
// no dependencies). It relies on the repo's two-space indentation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { REPO } from './helpers.ts';

function tracked(...patterns: string[]): string[] {
	return execFileSync('git', ['ls-files', ...patterns], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
}

const workflows = tracked('.github/workflows/*.yml', '.github/workflows/*.yaml');
const actions = tracked('.github/actions/*/action.yml', '.github/actions/*/action.yaml');

const indent = (line: string): number => line.length - line.trimStart().length;
const lines = (file: string): string[] => readFileSync(join(REPO, file), 'utf8').split('\n');

/** Every `run:` script as { line, text }, block scalars included. */
function runScripts(file: string): { line: number; text: string }[] {
	const fileLines = lines(file);
	const scripts: { line: number; text: string }[] = [];
	for (const [index, line] of fileLines.entries()) {
		const runKey = line.match(/^\s*(?:- )?run:\s*(.*)$/);
		if (!runKey) {
			continue;
		}
		const value = runKey[1];
		if (!/^[|>]/.test(value)) {
			scripts.push({ line: index + 1, text: value });
			continue;
		}
		// A block scalar: every following line indented deeper than `run:` (or blank).
		const body: string[] = [];
		for (const next of fileLines.slice(index + 1)) {
			if (next.trim() !== '' && indent(next) <= indent(line)) {
				break;
			}
			body.push(next);
		}
		scripts.push({ line: index + 1, text: body.join('\n') });
	}
	return scripts;
}

/**
 * Lines whose value is an unquoted (plain) scalar containing `: `. YAML forbids
 * that, so the whole file fails to parse, and GitHub then silently never starts
 * the workflow, or any workflow that calls it. A `run: echo '{a: 1}'` did that
 * to plugin-ci.yml via plugin-e2e.yml. Quote the value or use a `|` block.
 */
function colonsInPlainScalars(text: string): number[] {
	const bad: number[] = [];
	let blockIndent = -1; // indentation of the key that opened a block scalar
	for (const [index, line] of text.split('\n').entries()) {
		if (blockIndent >= 0) {
			if (line.trim() === '' || indent(line) > blockIndent) {
				continue;
			}
			blockIndent = -1;
		}
		const entry = line.match(/^\s*(?:- )*[^\s#'"][^:#]*?:\s+(.*)$/);
		if (!entry) {
			continue;
		}
		const value = entry[1].replace(/\s+#.*$/, ''); // a trailing comment
		if (/^[|>]/.test(value)) {
			blockIndent = indent(line);
		} else if (!/^['"{[&*!]/.test(value) && value.includes(': ')) {
			bad.push(index + 1);
		}
	}
	return bad;
}

describe('colonsInPlainScalars', () => {
	test('flags a plain scalar containing ": "', () => {
		assert.deepEqual(colonsInPlainScalars(`steps:\n  - run: echo "$(jq '{name: "x"}')"\n`), [2]);
		assert.deepEqual(colonsInPlainScalars('name: a: b\n'), [1]);
	});

	test('allows quoted, flow, block and commented values', () => {
		const ok = [
			`run: 'echo a: b'`,
			'run: "echo a: b"',
			'with: { a: b }',
			'run: |\n  echo {a: 1}\n  echo b: c\nnext: x',
			'run: echo hi # note: fine',
			'# comment: with: colons',
			'name: ${{ a }}:${{ b }}',
		];
		for (const text of ok) {
			assert.deepEqual(colonsInPlainScalars(text), [], text);
		}
	});
});

// The one uses: pinned to a tag: the call to cd.yml in plugin-publish.yml and
// release-please.yml. cd.yml fails a caller that pins it to a hash, and the
// GCP identity it publishes with trusts it only at main or a semver tag. Only plugin-ci-workflows'
// release bot can create or move its tags (ruleset only-platform-bot-can-tag).
const taggedCd =
	/^ {4}uses: grafana\/plugin-ci-workflows\/\.github\/workflows\/cd\.yml@ci-cd-workflows\/v\d+\.\d+\.\d+ # zizmor: ignore\[unpinned-uses\]$/;

const cdCallers = ['plugin-publish.yml', 'release-please.yml'];

// One group per file: the checks for every workflow and composite action,
// plus the permission checks that only apply to workflows.
describe('workflows and composite actions', () => {
	test('finds tracked workflows and actions to check', () => {
		assert.ok(workflows.length > 0);
		assert.ok(actions.length > 0);
	});

	for (const file of [...workflows, ...actions]) {
		describe(file, () => {
			test('no plain scalar contains ": " (the file would not parse)', () => {
				const bad = colonsInPlainScalars(readFileSync(join(REPO, file), 'utf8')).map((line) => `line ${line}`);
				assert.deepEqual(bad, [], 'quote the value or use a | block scalar');
			});

			test('third-party uses: are pinned to a commit SHA with a # tag comment', () => {
				const bad: string[] = [];
				for (const [i, raw] of lines(file).entries()) {
					const line = raw.trim();
					const isUses = /^(- )?uses:/.test(line);
					const isLocal = /uses: (\$|\.)\//.test(line);
					const isPinned = /uses: [\w.-]+\/[\w./-]+@[0-9a-f]{40} # \S+/.test(line);
					const isTaggedCd = cdCallers.some((name) => file.endsWith(name)) && taggedCd.test(raw);
					if (isUses && !isLocal && !isPinned && !isTaggedCd) {
						bad.push(`line ${i + 1}: ${line}`);
					}
				}
				assert.deepEqual(bad, []);
			});

			test('no ${{ }} expressions inside run: scripts', () => {
				const bad = runScripts(file)
					.filter((script) => script.text.includes('${{'))
					.map((script) => `line ${script.line}`);
				assert.deepEqual(bad, [], 'pass values through env: instead');
			});

			if (workflows.includes(file)) {
				test('defaults the token to no permissions (top-level permissions: {})', () => {
					assert.ok(lines(file).includes('permissions: {}'), 'workflow must default the token to no permissions');
				});

				test('every job declares its own permissions', () => {
					const missing = jobs(file)
						.filter((job) => !job.lines.some((line) => /^ {4}permissions:/.test(line)))
						.map((job) => job.name);
					assert.deepEqual(missing, []);
				});
			}
		});
	}
});

/** The events under `on:`, keyed by two-space indentation. */
function triggers(file: string): string[] {
	const fileLines = lines(file);
	const events: string[] = [];
	for (const line of fileLines.slice(fileLines.indexOf('on:') + 1)) {
		if (/^\S/.test(line)) {
			break; // next top-level key
		}
		const event = /^ {2}([\w-]+):/.exec(line);
		if (event) {
			events.push(event[1]);
		}
	}
	return events;
}

/** Whether `on: push:` is exactly `branches: [main]`: no other branch, and no tags or paths filter. */
function pushesOnlyMain(file: string): boolean {
	const fileLines = lines(file);
	const body: string[] = [];
	for (const line of fileLines.slice(fileLines.indexOf('  push:') + 1)) {
		if (/^ {0,2}\S/.test(line)) {
			break; // next event, or next top-level key
		}
		if (line.trim() !== '' && !line.trim().startsWith('#')) {
			body.push(line.trim());
		}
	}
	return body.join(',') === 'branches:,- main';
}

/** Each job under `jobs:` as { name, lines }, keyed by two-space indentation. */
function jobs(file: string): { name: string; lines: string[] }[] {
	const fileLines = lines(file);
	const found: { name: string; lines: string[] }[] = [];
	const jobsAt = fileLines.indexOf('jobs:');
	for (const line of fileLines.slice(jobsAt + 1)) {
		if (/^\S/.test(line)) {
			break; // next top-level key: the jobs block is over
		}
		const jobHeader = /^ {2}([\w-]+):\s*$/.exec(line);
		if (jobHeader) {
			found.push({ name: jobHeader[1], lines: [] });
		} else if (found.length > 0) {
			found[found.length - 1].lines.push(line);
		}
	}
	return found;
}

// The write permissions a job must not hold while running repo or package
// code: `pull-requests: write` posts on PRs, `contents: write` changes the
// repo and its releases.
const writeGrant = /^\s+(pull-requests|contents):\s*write/;

/** Whether a job's permissions include `pull-requests: write` or `contents: write`. */
function canWrite(job: { lines: string[] }): boolean {
	return job.lines.some((line) => /^ {6}/.test(line) && writeGrant.test(line));
}

/** A job's steps, each as the lines from its `- ` to the next one. */
function steps(jobLines: string[]): string[][] {
	const found: string[][] = [];
	let inSteps = false;
	for (const line of jobLines) {
		if (/^ {4}steps:/.test(line)) {
			inSteps = true;
		} else if (/^ {4}\S/.test(line)) {
			inSteps = false;
		} else if (inSteps && /^ {6}- /.test(line)) {
			found.push([line]);
		} else if (inSteps && found.length > 0) {
			found[found.length - 1].push(line);
		}
	}
	return found;
}

// Jobs that can write to a PR or to the repo must not execute anything a PR
// controls:
// no checkout of this repo, no package-manager or Node commands, no repo
// scripts, and no reusable-workflow calls. They may only read artifacts that
// a read-only job produced, and check out pinned third-party code.
describe('write tokens never run PR code', () => {
	const trustedReusable = taggedCd;
	const runsPrCode = /\b(pnpm|npm|npx|yarn|node)\b|\.github\/(scripts|actions)\//;

	for (const file of workflows) {
		for (const job of jobs(file).filter(canWrite)) {
			test(`${file}: ${job.name}`, () => {
				// One exception: plugin-ci-workflows' cd.yml, tag-pinned, in a workflow
				// that runs only by hand or on a push to main (plugin-publish.yml,
				// release-please.yml), never on a PR or another branch. cd.yml declares
				// contents: write at its top level, so a caller has to grant it.
				const callsReusable = job.lines.some((line) => /^ {4}uses:/.test(line));
				const callsPinnedCd = job.lines.some((line) => trustedReusable.test(line));
				const trustedTriggers = triggers(file).every(
					(event) => event === 'workflow_dispatch' || (event === 'push' && pushesOnlyMain(file)),
				);
				assert.ok(!callsReusable || (callsPinnedCd && trustedTriggers), 'calls a reusable workflow');
				for (const step of steps(job.lines)) {
					const text = step.join('\n');
					// A local action (`$/` or `./`) is code from the PR's own checkout.
					assert.doesNotMatch(text, /uses: (\$|\.)\//, `runs a local action from the PR:\n${text}`);
					if (/uses: actions\/checkout@/.test(text)) {
						assert.match(text, /^\s+repository:/m, `checks out this repo:\n${text}`);
						assert.doesNotMatch(text, /repository:.*github\.event\.pull_request/, `checks out the PR's repository:\n${text}`);
					}
					// Everything after `run:`, whether inline or a block.
					const runAt = text.indexOf('run:');
					const run = runAt === -1 ? '' : text.slice(runAt + 'run:'.length);
					assert.doesNotMatch(run, runsPrCode, `runs repo or package code:\n${text}`);
				}
			});
		}
	}

	// The checks above only see jobs that jobs() and canWrite() find. If the
	// line-based parsing ever misses one, that job would go unchecked, so
	// compare against every write grant in the raw file. (Each job here
	// grants one of the two, never both.)
	for (const file of workflows) {
		test(`${file}: every job with a write grant is checked`, () => {
			const grants = lines(file).filter((line) => writeGrant.test(line)).length;
			assert.equal(jobs(file).filter(canWrite).length, grants);
		});
	}
});
