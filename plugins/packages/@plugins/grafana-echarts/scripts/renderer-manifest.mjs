#!/usr/bin/env node
// Writes the manifest (`delivery.2`) and the `package.json` (`renderer.9`) next to the Renderer bundle.
// Run it after the bundle build: `pnpm run build:renderer` runs both. See docs/renderer.md.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** The output directory: `RENDERER_DIST_DIR` of `webpack.renderer.config.ts`. */
export const DIST_DIR = join(PACKAGE_DIR, 'dist-renderer');
export const BUNDLE_FILE = 'renderer.js';
export const MANIFEST_FILE = 'renderer.manifest.json';

/**
 * The packages that the App gives (`renderer.9`). The bundle imports them with bare specifiers, and the bundle check
 * fails if it imports another package. The ranges come from the versions in the package `package.json`.
 */
export const PEER_PACKAGES = ['react', 'react-dom', '@grafana/ui', '@grafana/data', '@emotion/css'];

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
    contractVersion: readFileSync(join(PACKAGE_DIR, 'src/renderer/contract/CONTRACT_VERSION'), 'utf8').trim(),
    // `parseSpec.ts` reads the same file, so the manifest and the `specVersions` export agree.
    specVersions: readJson(join(PACKAGE_DIR, 'src/renderer/specVersions.json')),
    license: pkg.license,
    peerDependencies,
  };
}

/** Writes both files and returns them. */
export function writeRendererPackage() {
  const { version, contractVersion, specVersions, license, peerDependencies } = expectedValues();
  const manifest = { version, sha256: sha256(join(DIST_DIR, BUNDLE_FILE)), contractVersion, specVersions };
  // Decision 6 of the plan: a generated file, not a workspace package. `private` stops a publish by mistake.
  const packageJson = {
    name: '@plugins/grafana-echarts-renderer',
    version,
    private: true,
    license,
    type: 'module',
    exports: { '.': `./${BUNDLE_FILE}`, [`./${MANIFEST_FILE}`]: `./${MANIFEST_FILE}` },
    peerDependencies,
  };
  writeFileSync(join(DIST_DIR, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(DIST_DIR, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  return { manifest, packageJson };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { manifest } = writeRendererPackage();
  console.log(`${MANIFEST_FILE}: version ${manifest.version}, sha256 ${manifest.sha256}`);
}
