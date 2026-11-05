#!/usr/bin/env node
// The bundle checks of the Renderer (`delivery.2`, `delivery.5`, `delivery.6`, `renderer.9`, decision 4 of the plan).
// Usage: node scripts/check-renderer-bundle.mjs [--no-build]
// It builds the bundle with webpack stats, writes the manifest, then checks the files in `dist-renderer/`.
// With --no-build, it checks the files that are there and skips the checks that need the stats.
// See docs/renderer.md. https://webpack.js.org/api/stats/
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync } from 'node:zlib';
import {
  BUNDLE_FILE,
  DIST_DIR,
  MANIFEST_FILE,
  PEER_PACKAGES,
  expectedValues,
  sha256,
  writeRendererPackage,
} from './renderer-manifest.mjs';

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Decision 4 of the plan: the only `@grafana/runtime` modules in the bundle. No Renderer path calls them. */
const ALLOWED_RUNTIME_MODULES = [
  'dist/esm/index.mjs',
  'dist/esm/services/index.mjs',
  'dist/esm/services/backendSrv.mjs',
  'dist/esm/components/PanelDataErrorView.mjs',
];

/** The one `new Function` that is known: the JSON fallback of the ECharts geo loader, after a `JSON.parse` test. */
const KNOWN_NEW_FUNCTION = /new Function\("return \("\+/y;

const failures = [];
const check = (rule, ok, text) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${rule}: ${text}`);
  if (!ok) {
    failures.push(rule);
  }
};

/** Builds the bundle and returns the webpack stats, or exits when the build fails. */
function build() {
  const dir = mkdtempSync(join(tmpdir(), 'renderer-stats-'));
  const statsPath = join(dir, 'stats.json');
  try {
    const result = spawnSync('pnpm', ['exec', 'webpack', '-c', './webpack.renderer.config.ts', `--json=${statsPath}`], {
      cwd: PACKAGE_DIR,
      stdio: 'inherit',
    });
    // With --json, webpack prints no errors, so print the errors of the stats.
    let stats;
    try {
      stats = readJson(statsPath);
    } catch {
      console.error(`webpack wrote no stats (exit ${result.status})`);
      process.exit(1);
    }
    if (result.status !== 0 || stats.errors.length > 0) {
      stats.errors.forEach((error) => console.error(error.message));
      console.error(`webpack failed (exit ${result.status})`);
      process.exit(1);
    }
    return stats;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The file paths of all the modules in the stats, with the modules that webpack joined. */
function modulePaths(stats) {
  const paths = [];
  const walk = (modules = []) =>
    modules.forEach((module) => {
      // A joined module has the name `<first module> + <n> modules`.
      paths.push(module.name.split(' + ')[0]);
      walk(module.modules);
    });
  walk(stats.modules);
  return paths;
}

/** The package of a path in `node_modules`, and the path in the package. */
function packageOf(path) {
  const i = path.lastIndexOf('node_modules/');
  if (i < 0) {
    return undefined;
  }
  const match = /^((?:@[^/]+\/)?[^/]+)\/(.*)$/.exec(path.slice(i + 'node_modules/'.length));
  return match ? { name: match[1], file: match[2] } : undefined;
}

/** The specifiers of the static imports at the top of the bundle. Webpack puts all of them there. */
function bundleImports(code) {
  // The license comment, then `import*as e from"x";` or `import{a as b}from"x";` statements.
  const header = /^\s*(?:\/\*[\s\S]*?\*\/\s*)?((?:import\s*(?:[^"';]*?from\s*)?"[^"]+";?\s*)*)/.exec(code)[1];
  return [...header.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

const packageName = (specifier) => specifier.match(/^((?:@[^/]+\/)?[^/]+)/)[1];

const noBuild = process.argv.includes('--no-build');
const stats = noBuild ? undefined : build();
if (!noBuild) {
  writeRendererPackage();
}

const bundlePath = join(DIST_DIR, BUNDLE_FILE);
const code = readFileSync(bundlePath, 'utf8');
const manifest = readJson(join(DIST_DIR, MANIFEST_FILE));
const packageJson = readJson(join(DIST_DIR, 'package.json'));
const expected = expectedValues();

// delivery.6: the manifest hash is the hash of the bundle.
const hash = sha256(bundlePath);
check('delivery.6', manifest.sha256 === hash, `manifest sha256 ${manifest.sha256}, bundle sha256 ${hash}`);

// delivery.2: the manifest fields have the values of their sources.
for (const field of ['version', 'contractVersion', 'specVersions']) {
  const ok = isDeepStrictEqual(manifest[field], expected[field]);
  check(
    'delivery.2',
    ok,
    `manifest ${field} ${JSON.stringify(manifest[field])}, expected ${JSON.stringify(expected[field])}`
  );
}
check('delivery.2', packageJson.version === manifest.version, `package.json version ${packageJson.version}`);

// renderer.9: the bundle imports only the peers, and the generated package.json lists each one.
const imports = bundleImports(code);
const notPeers = imports.filter(
  (specifier) => !Object.hasOwn(packageJson.peerDependencies ?? {}, packageName(specifier))
);
check(
  'renderer.9',
  notPeers.length === 0,
  `bare imports ${imports.join(', ')}${notPeers.length ? `; not peers: ${notPeers.join(', ')}` : ''}`
);
check(
  'renderer.9',
  isDeepStrictEqual(packageJson.peerDependencies, expected.peerDependencies),
  `peerDependencies ${JSON.stringify(packageJson.peerDependencies)}`
);
// A dynamic import loads a file, which the sandbox cannot do (`renderer.7`).
const dynamicImports = code.match(/(?<![\w$.])import\s*\(/g) ?? [];
check('renderer.9', dynamicImports.length === 0, `${dynamicImports.length} dynamic imports`);

// delivery.5: report the gzip size. Fail only when the contract gives a limit.
const gzipBytes = gzipSync(readFileSync(bundlePath)).length;
const limit = readJson(join(PACKAGE_DIR, 'src/renderer/contract/registry/constants.json')).maxBundleGzipBytes.value;
const sizeText = `gzip size ${gzipBytes} bytes (${(gzipBytes / 1024).toFixed(1)} KiB)`;
if (typeof limit === 'number') {
  check('delivery.5', gzipBytes <= limit, `${sizeText}, maxBundleGzipBytes ${limit}`);
} else {
  check('delivery.5', true, `${sizeText}, maxBundleGzipBytes has no value, so the size only reports`);
}

// The bundle uses no eval. The sandbox test excuses an eval report only for the peer probe of the App.
const evals = code.match(/(?<![\w$.])eval\s*\(/g) ?? [];
const newFunctions = [...code.matchAll(/new Function\s*\(/g)].filter((match) => {
  KNOWN_NEW_FUNCTION.lastIndex = match.index;
  return !KNOWN_NEW_FUNCTION.test(code);
});
check(
  'renderer.6',
  evals.length === 0 && newFunctions.length === 0,
  `${evals.length} eval calls, ${newFunctions.length} unknown new Function calls`
);

if (stats) {
  const packages = modulePaths(stats).map(packageOf).filter(Boolean);
  // renderer.9: the bundle has no copy of a peer.
  const peerCopies = [...new Set(packages.filter((p) => PEER_PACKAGES.includes(p.name)).map((p) => p.name))];
  check('renderer.9', peerCopies.length === 0, `bundled peer packages: ${peerCopies.join(', ') || 'none'}`);
  // Decision 4: only the known `@grafana/runtime` modules.
  const runtime = [...new Set(packages.filter((p) => p.name === '@grafana/runtime').map((p) => p.file))];
  const other = runtime.filter((file) => !ALLOWED_RUNTIME_MODULES.includes(file));
  check(
    'decision 4',
    other.length === 0,
    `@grafana/runtime modules: ${runtime.join(', ')}${other.length ? `; not allowed: ${other.join(', ')}` : ''}`
  );
} else {
  console.log('skip renderer.9 (bundled peers), decision 4 (@grafana/runtime modules): --no-build has no stats');
}

if (failures.length > 0) {
  console.error(`${failures.length} checks failed`);
  process.exit(1);
}
