#!/usr/bin/env node
// Writes the manifest (`delivery.2`) and copies `src/renderer/renderer.package.json` (`renderer.9`), with the Renderer
// version, next to the Renderer bundle. It also copies the license and the types of the contract, so `dist-renderer/`
// has each file of a release.
// Run it after the bundle build: `pnpm run build:renderer` runs both. See docs/renderer.md.
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** The directory of the installed viz contract package (`@grafana/viz-contract`). */
export const CONTRACT_DIR = dirname(createRequire(import.meta.url).resolve('@grafana/viz-contract/package.json'));

/** The output directory: `RENDERER_DIST_DIR` of `webpack.renderer.config.ts`. */
export const DIST_DIR = join(PACKAGE_DIR, 'dist-renderer');
export const BUNDLE_FILE = 'renderer.js';
export const MANIFEST_FILE = 'renderer.manifest.json';
/** The SVG of each icon, for the icon cache of the App (`delivery.9`). `renderer-icons.mjs` writes it. */
export const ICONS_FILE = 'icons.json';
/** The types of the module: a copy of `renderer-api.d.ts` of the installed contract. */
export const TYPES_FILE = 'renderer.d.ts';
export const TYPES_SOURCE = join(CONTRACT_DIR, 'renderer-api.d.ts');
export const LICENSE_FILE = 'LICENSE';
export const LICENSE_SOURCE = join(PACKAGE_DIR, LICENSE_FILE);

/** The files of a release: all of `dist-renderer/`. A consumer needs no file from another place. */
export const RELEASE_FILES = [
  BUNDLE_FILE,
  // The license comments of the bundled packages. Webpack moves them out of the bundle into this file.
  // https://webpack.js.org/plugins/terser-webpack-plugin/#extractcomments
  `${BUNDLE_FILE}.LICENSE.txt`,
  MANIFEST_FILE,
  'package.json',
  ICONS_FILE,
  TYPES_FILE,
  LICENSE_FILE,
];

/**
 * The version of the Renderer. release-please writes this file in a release PR, with a newline at the end
 * (`.github/actions/RELEASES.md`). The webpack configuration, `jest-setup.js` and `index.test.ts` read it too.
 */
export const VERSION_FILE = join(PACKAGE_DIR, 'src/renderer/version.txt');
export function readVersion(text = readFileSync(VERSION_FILE, 'utf8')) {
  const version = text.trim();
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`src/renderer/version.txt: ${JSON.stringify(version)} is not a version`);
  }
  return version;
}

/** The names that are missing from a list of the files in `dist-renderer/`, and the names that a release does not have. */
export function releaseFileProblems(names) {
  const missing = RELEASE_FILES.filter((name) => !names.includes(name));
  const extra = names.filter((name) => !RELEASE_FILES.includes(name));
  return [...missing.map((name) => `${name} is missing`), ...extra.map((name) => `${name} is not a release file`)];
}

/**
 * The checked-in `package.json` of the Renderer, without `version`. The build copies it next to the bundle and adds
 * the version of `src/renderer/version.txt`.
 */
export const PACKAGE_TEMPLATE = join(PACKAGE_DIR, 'src/renderer/renderer.package.json');
export const readTemplate = () => readJson(PACKAGE_TEMPLATE);

/**
 * The packages that the App gives (`renderer.9`): the `peerDependencies` of the template. The bundle imports them with
 * bare specifiers, and the bundle check fails if it imports another package.
 */
export const PEER_PACKAGES = Object.keys(readTemplate().peerDependencies);

export const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** The values that the manifest and the generated `package.json` must have, from their sources. */
export function expectedValues() {
  const pkg = readJson(join(PACKAGE_DIR, 'package.json'));
  const peerDependencies = Object.fromEntries(
    PEER_PACKAGES.map((name) => {
      const version = pkg.dependencies[name];
      if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
        throw new Error(`package.json: dependency ${name} must have an exact version, not ${version}`);
      }
      return [name, `^${version}`];
    })
  );
  return {
    // The same file as `__RENDERER_VERSION__` of the bundle, so the manifest and the `version` export agree.
    version: readVersion(),
    contractVersion: readJson(join(CONTRACT_DIR, 'package.json')).version,
    // `parseSpec.ts` reads the same file, so the manifest and the `specVersions` export agree.
    specVersions: readJson(join(PACKAGE_DIR, 'src/renderer/specVersions.json')),
    license: pkg.license,
    exports: {
      '.': `./${BUNDLE_FILE}`,
      [`./${MANIFEST_FILE}`]: `./${MANIFEST_FILE}`,
      [`./${ICONS_FILE}`]: `./${ICONS_FILE}`,
    },
    peerDependencies,
  };
}

/** The fields of the template that differ from their sources. An empty list means that the template is correct. */
export function templateProblems(template = readTemplate(), expected = expectedValues()) {
  const problems = [];
  if (Object.hasOwn(template, 'version')) {
    problems.push('version: remove it, because the build adds the version of src/renderer/version.txt');
  }
  if (template.private !== true) {
    problems.push(`private: must be true, not ${JSON.stringify(template.private)}`);
  }
  for (const field of ['license', 'exports']) {
    if (!isDeepStrictEqual(template[field], expected[field])) {
      problems.push(`${field}: ${JSON.stringify(template[field])}, expected ${JSON.stringify(expected[field])}`);
    }
  }
  // A Renovate bump changes only package.json, so name the line to edit. The ranges are exact on purpose: a range
  // that only accepts the installed version can claim an older version that the bundle was not built against.
  for (const [name, range] of Object.entries(expected.peerDependencies)) {
    const actual = template.peerDependencies?.[name];
    if (actual !== range) {
      problems.push(
        `peerDependencies.${name}: ${JSON.stringify(actual)}, but package.json has ${range.slice(1)}. ` +
          `Set it to ${JSON.stringify(range)}.`
      );
    }
  }
  return problems;
}

/**
 * Writes the manifest and the `package.json`, copies the types and the license, and returns the two written objects.
 * It throws when the template differs from its sources.
 */
export function writeRendererPackage() {
  const expected = expectedValues();
  const template = readTemplate();
  const problems = templateProblems(template, expected);
  if (problems.length > 0) {
    throw new Error(`src/renderer/renderer.package.json:\n  ${problems.join('\n  ')}`);
  }
  const { version, contractVersion, specVersions } = expected;
  const manifest = { version, sha256: sha256(join(DIST_DIR, BUNDLE_FILE)), contractVersion, specVersions };
  // Decision 6 of the plan: not a workspace package. `private` stops a publish by mistake.
  const { name, ...rest } = template;
  const packageJson = { name, version, ...rest };
  writeFileSync(join(DIST_DIR, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(DIST_DIR, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  copyFileSync(TYPES_SOURCE, join(DIST_DIR, TYPES_FILE));
  copyFileSync(LICENSE_SOURCE, join(DIST_DIR, LICENSE_FILE));
  return { manifest, packageJson };
}

// Node runs the real path of a symlinked script, so compare with the real path of argv[1].
if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const { manifest } = writeRendererPackage();
  console.log(`${MANIFEST_FILE}: version ${manifest.version}, sha256 ${manifest.sha256}`);
}
