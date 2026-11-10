#!/usr/bin/env node
// Writes the manifest (`delivery.2`) and copies `src/renderer/renderer.package.json` (`renderer.9`), with the package
// version, next to the Renderer bundle.
// Run it after the bundle build: `pnpm run build:renderer` runs both. See docs/renderer.md.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
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

/**
 * The checked-in `package.json` of the Renderer, without `version`. The build copies it next to the bundle and adds
 * the version of the package `package.json` (decision 1 of the plan).
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
    // Decision 1 of the plan: the Renderer version is the package version (`__RENDERER_VERSION__`).
    version: pkg.version,
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
    problems.push('version: remove it, because the build adds the package version');
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

/** Writes both files and returns them. It throws when the template differs from its sources. */
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
  return { manifest, packageJson };
}

// Node runs the real path of a symlinked script, so compare with the real path of argv[1].
if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const { manifest } = writeRendererPackage();
  console.log(`${MANIFEST_FILE}: version ${manifest.version}, sha256 ${manifest.sha256}`);
}
