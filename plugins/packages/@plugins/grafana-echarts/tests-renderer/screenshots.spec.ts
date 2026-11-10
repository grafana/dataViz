// Writes one PNG of the Renderer in the sandbox for each fixture set, to look at by eye. It is not an image test
// (no baseline, no compare). Run `pnpm run renderer:shots`. Output: `.renderer-shots/<set>-<theme>.png`.
// `RENDERER_SHOTS` picks the sets (comma list, or `all`), `RENDERER_SHOTS_THEME` the theme (`dark` or `light`).
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { draw, fixtureSets, fixtureSpec } from './harness';

const OUT_DIR = path.join(__dirname, '..', '.renderer-shots');

const selection = process.env.RENDERER_SHOTS;
const theme = process.env.RENDERER_SHOTS_THEME === 'light' ? 'light' : 'dark';
const sets = !selection || selection === 'all' ? fixtureSets() : selection.split(',').map((name) => name.trim());

test.describe('renderer screenshots', () => {
  test.skip(!selection, 'Set RENDERER_SHOTS (pnpm run renderer:shots) to write the screenshots.');

  for (const set of sets) {
    test(set, async ({ page }) => {
      await draw(page, { ...fixtureSpec(set), theme });
      fs.mkdirSync(OUT_DIR, { recursive: true });
      await page.locator('#app').screenshot({ path: path.join(OUT_DIR, `${set}-${theme}.png`) });
    });
  }
});
