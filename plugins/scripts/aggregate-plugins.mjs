#!/usr/bin/env node
// Aggregate every built plugin's `dist` into a single directory that Grafana can
// use as its plugins path. Copies `packages/@plugins/*/dist` -> `<target>/<id>`,
// keyed by the plugin id read from each `dist/plugin.json`, and writes
// `<target>/.plugin-ids` (a comma-separated list). The Grafana entrypoint (see
// docker-compose.grafana.yaml) uses that file to wait for every plugin and to
// build the `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS` allow list, so adding a
// plugin needs no Compose edits.
//
// Usage:
//   node scripts/aggregate-plugins.mjs --target <dir>            one-shot mirror
//   node scripts/aggregate-plugins.mjs --target <dir> --watch    mirror on change
//   node scripts/aggregate-plugins.mjs --target <dir> --check    healthcheck (exit 0/1)

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const pluginsDir = path.resolve(import.meta.dirname, '..');
const pluginsRoot = path.join(pluginsDir, 'packages', '@plugins');
const IDS_FILE = '.plugin-ids';
const POLL_INTERVAL_MS = 1500;

function listPluginDistDirs() {
	if (!fs.existsSync(pluginsRoot)) {
		return [];
	}
	return fs
		.readdirSync(pluginsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(pluginsRoot, entry.name, 'dist'))
		.filter((dist) => fs.existsSync(path.join(dist, 'plugin.json')));
}

function readPluginId(distDir) {
	const { id } = JSON.parse(fs.readFileSync(path.join(distDir, 'plugin.json'), 'utf8'));
	if (!id) {
		throw new Error(`Missing "id" in ${path.join(distDir, 'plugin.json')}`);
	}
	return id;
}

// Mirror atomically via a temp dir + rename so Grafana never observes a
// half-copied plugin directory.
function mirror(distDir, target) {
	const id = readPluginId(distDir);
	const dest = path.join(target, id);
	const tmp = `${dest}.tmp`;
	fs.rmSync(tmp, { recursive: true, force: true });
	fs.cpSync(distDir, tmp, { recursive: true });
	fs.rmSync(dest, { recursive: true, force: true });
	fs.renameSync(tmp, dest);
	return id;
}

function aggregate(target) {
	fs.mkdirSync(target, { recursive: true });
	const ids = listPluginDistDirs().map((distDir) => mirror(distDir, target));
	fs.writeFileSync(path.join(target, IDS_FILE), ids.join(','));
	return ids;
}

function latestMtimeMs(dir) {
	let latest = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
		if (entry.isFile()) {
			latest = Math.max(latest, fs.statSync(path.join(entry.parentPath, entry.name)).mtimeMs);
		}
	}
	return latest;
}

function watch(target) {
	const signatures = new Map();
	const tick = () => {
		const dists = listPluginDistDirs();
		let changed = dists.length !== signatures.size;
		for (const distDir of dists) {
			const sig = latestMtimeMs(distDir);
			if (signatures.get(distDir) !== sig) {
				signatures.set(distDir, sig);
				changed = true;
			}
		}
		if (changed) {
			const ids = aggregate(target);
			console.info(`↻ aggregated ${ids.length} plugin(s): ${ids.join(', ') || '(none)'}`);
		}
	};
	tick();
	setInterval(tick, POLL_INTERVAL_MS);
}

function check(target) {
	const idsPath = path.join(target, IDS_FILE);
	if (!fs.existsSync(idsPath)) {
		return false;
	}
	const ids = fs.readFileSync(idsPath, 'utf8').split(',').filter(Boolean);
	if (ids.length === 0) {
		return false;
	}
	return ids.every(
		(id) => fs.existsSync(path.join(target, id, 'plugin.json')) && fs.existsSync(path.join(target, id, 'module.js'))
	);
}

const { values } = parseArgs({
	options: {
		target: { type: 'string' },
		watch: { type: 'boolean', default: false },
		check: { type: 'boolean', default: false },
	},
});

if (!values.target) {
	console.error('Missing required --target <dir>');
	process.exit(1);
}

if (values.check) {
	process.exit(check(values.target) ? 0 : 1);
} else if (values.watch) {
	watch(values.target);
} else {
	const ids = aggregate(values.target);
	console.info(`Aggregated ${ids.length} plugin(s): ${ids.join(', ') || '(none)'}`);
}
