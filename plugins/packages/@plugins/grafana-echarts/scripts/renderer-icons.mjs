#!/usr/bin/env node
// Writes `icons.json` next to the Renderer manifest (`delivery.9`). The App fills the icon cache of its `@grafana/ui`
// from this file (`renderer.15`), so `Icon` makes no network request.
// Run it after the bundle build: `pnpm run build:renderer` runs it. See docs/renderer.md.
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DIST_DIR, ICONS_FILE } from './renderer-manifest.mjs';

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The checked-in list of the icons that the Renderer can show, as `<dir>/<name>` keys. */
export const ICON_LIST = join(PACKAGE_DIR, 'src/renderer/iconList.json');

/** The SVG files that `@grafana/ui` ships, in `<dir>/<name>.svg`. */
export const UI_ICONS_DIR = join(
  dirname(createRequire(import.meta.url).resolve('@grafana/ui/package.json')),
  'dist/public/img/icons'
);

/**
 * The checked-in SVG files of the icons that `@grafana/ui` does not ship, in `<dir>/<name>.svg`. They are copies from
 * `@iconscout/unicons@4.0.1`, the source of the `unicons` icons of Grafana. 4.0.1 is the last Apache-2.0 version.
 */
export const LOCAL_ICONS_DIR = join(PACKAGE_DIR, 'src/renderer/icons');

/** A key of `icons.json`: the folder that `Icon` of `@grafana/ui` uses, and the icon name (`delivery.9`). */
export const ICON_KEY = /^(unicons|solid|mono|custom)\/[a-z0-9-]+$/;

export const readIconList = () => JSON.parse(readFileSync(ICON_LIST, 'utf8')).icons;

/** The keys of the SVG files in a folder of `<dir>/<name>.svg` files. */
export const iconKeysIn = (root) =>
  existsSync(root)
    ? readdirSync(root).flatMap((dir) =>
        readdirSync(join(root, dir))
          .filter((file) => file.endsWith('.svg'))
          .map((file) => `${dir}/${file.slice(0, -'.svg'.length)}`)
      )
    : [];

/** The problems of an `icons.json` object (`delivery.9`). An empty list means that it is correct. */
export function iconProblems(icons) {
  if (icons === null || typeof icons !== 'object' || Array.isArray(icons)) {
    return ['icons.json is not a JSON object'];
  }
  const problems = [];
  if (Object.keys(icons).length === 0) {
    problems.push('icons.json has no icons');
  }
  for (const [key, svg] of Object.entries(icons)) {
    if (!ICON_KEY.test(key)) {
      problems.push(`${key}: the key is not <dir>/<name> with <dir> unicons, solid, mono or custom`);
    }
    if (typeof svg !== 'string' || !/^\s*<svg[\s>]/.test(svg)) {
      problems.push(`${key}: the value is not SVG content`);
    }
  }
  return problems;
}

/** The SVG of each listed key, from `@grafana/ui` first. It throws when a key is not correct or has no SVG file. */
export function readIcons(keys = readIconList()) {
  const badKeys = keys.filter((key) => !ICON_KEY.test(key));
  if (badKeys.length > 0) {
    throw new Error(`${ICON_LIST}: not a <dir>/<name> key: ${badKeys.join(', ')}`);
  }
  const icons = {};
  const missing = [];
  for (const key of keys) {
    const file = [UI_ICONS_DIR, LOCAL_ICONS_DIR].map((root) => join(root, `${key}.svg`)).find(existsSync);
    if (file) {
      icons[key] = readFileSync(file, 'utf8').trim();
    } else {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `@grafana/ui does not ship these icons, and ${LOCAL_ICONS_DIR} has no copy: ${missing.join(', ')}. ` +
        'Copy each SVG from @iconscout/unicons@4.0.1 into it (docs/renderer.md, Icons).'
    );
  }
  return icons;
}

/** Writes `icons.json` to the Renderer output directory and returns it. */
export function writeIcons() {
  const icons = readIcons();
  writeFileSync(join(DIST_DIR, ICONS_FILE), `${JSON.stringify(icons)}\n`);
  return icons;
}

// Node runs the real path of a symlinked script, so compare with the real path of argv[1].
if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const icons = writeIcons();
  console.log(`${ICONS_FILE}: ${Object.keys(icons).length} icons`);
}
