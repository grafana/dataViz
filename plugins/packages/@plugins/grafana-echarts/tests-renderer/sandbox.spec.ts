// The Renderer in `<iframe sandbox="allow-scripts">` with the default CSP of MCP Apps and the network blocked
// (`renderer.6`, `renderer.7`, `renderer.8`). Build first: `pnpm run build:renderer && pnpm run build:renderer-harness`.
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { draw, fixtureSpec, fixtureState, type Message } from './harness';

/**
 * CSP reports that the Renderer does not cause. The `@grafana/data` bundle of the App tests `new Function('')` in a
 * try/catch to see if eval works (a feature probe of a bundled schema library). The probe is blocked and caught:
 * nothing breaks.
 */
const isPeerEvalProbe = (m: Message) => m.directive === 'script-src' && m.blocked === 'eval';

/**
 * KNOWN DEFECT (https://github.com/grafana/viz-contract/issues/1): `@grafana/ui` `Icon` fetches each SVG from
 * `public/build/img/icons/` with `react-inlinesvg`. `connect-src 'none'` blocks the fetch, and the icon is blank.
 * The fix is on the App side: contract 1.2.0 `renderer.15` says that the App fills the icon cache from the `icons.json`
 * of the Renderer build (`delivery.9`) before `render`. The build does not write `icons.json` yet, and the harness App
 * does not fill the cache (`delivery.8`). Both rules are `pending` in `src/renderer/contractRules.json`.
 * The test below with `test.fail` passes while the defect is there, and fails when the icons load with no network.
 */
const isIconFetch = (m: Message) =>
  m.directive === 'connect-src' && typeof m.blocked === 'string' && m.blocked.includes('/public/build/img/icons/');

for (const set of ['prometheus-line', 'smoke-geomap']) {
  test(`${set}: draws in the sandbox with no request, no CSP violation and no error`, async ({ page }) => {
    // contract-rule: delivery.1
    // contract-rule: renderer.6
    // contract-rule: renderer.7
    const { requests, of, states } = await draw(page, fixtureSpec(set));
    expect(states.at(-1)).toEqual(fixtureState(set));
    expect(requests).toEqual([]);
    expect(of('csp').filter((m) => !isPeerEvalProbe(m) && !isIconFetch(m))).toEqual([]);
    expect(of('error')).toEqual([]);
  });
}

test('the manifest gives the version and the specVersions of the built bundle', async ({ page }) => {
  // contract-rule: delivery.2
  const manifestPath = path.join(__dirname, '..', 'dist-renderer', 'renderer.manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const { of } = await draw(page, fixtureSpec('smoke-timeseries'));
  expect(of('module')).toEqual([{ type: 'module', version: manifest.version, specVersions: manifest.specVersions }]);
});

test('localStorage is blocked in the sandbox, and the chart still draws', async ({ page }) => {
  // contract-rule: renderer.8
  const { of, states } = await draw(page, fixtureSpec('smoke-timeseries'));
  expect(of('storage')).toEqual([{ type: 'storage', readable: false, name: 'SecurityError' }]);
  expect(states.at(-1)).toEqual({ state: 'ready', notices: [] });
});

test('a geo layer that needs the network is not fetched, and gives its notice', async ({ page }) => {
  // contract-rule: state.11
  const spec = fixtureSpec('smoke-geomap');
  (spec.panel as Record<string, unknown>).options = {
    basemap: { type: 'default', name: 'Layer 0' },
    layers: [
      { type: 'markers', name: 'Layer 1' },
      { type: 'geojson', name: 'States', config: { src: 'public/maps/usa-states.geojson' } },
    ],
  };
  const { requests, states } = await draw(page, spec);
  expect(requests).toEqual([]);
  expect(states.at(-1)).toEqual({
    state: 'ready',
    notices: [
      {
        code: 'geo-map-tiles',
        message:
          'Map layer Layer 0 (default) needs map tiles from the network. The vector basemap is drawn in its place.',
      },
      {
        code: 'geo-offline-file',
        message: 'Map layer States: public/maps/usa-states.geojson is not available offline.',
      },
    ],
  });
});

test('a refresh asks the App, and the result shows in the sandbox', async ({ page }) => {
  // contract-rule: refresh.2
  const { requests } = await draw(page, fixtureSpec('smoke-timeseries'));
  const app = page.frameLocator('#app');
  await app.getByRole('button', { name: 'Refresh' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { messages: Message[] }).messages.filter((m) => m.type === 'refresh'))
    )
    .toEqual([{ type: 'refresh', request: { cause: 'refresh' } }]);
  await page.evaluate(() =>
    document
      .querySelector<HTMLIFrameElement>('#app')!
      .contentWindow!.postMessage({ type: 'setRefreshed', ok: false, error: 'boom' }, '*')
  );
  await expect(app.getByRole('status')).toHaveText('Refresh failed: boom');
  expect(requests).toEqual([]);
});

test('the icons load with no network request', async ({ page }) => {
  // contract-rule: renderer.7
  test.fail(true, 'Known defect: @grafana/ui icons are fetched by URL (grafana/viz-contract#1).');
  const { of } = await draw(page, fixtureSpec('smoke-timeseries'));
  expect(of('csp').filter(isIconFetch)).toEqual([]);
});

test('a label with HTML comment and script markup gets to the Renderer as text', async ({ page }) => {
  // The page puts the spec in a `<script>` element, so its escapes must give back the same JSON.
  const label = '<!-- </script><script>alert(5)</script> -->';
  const spec = JSON.stringify(fixtureSpec('hostile-label')).replaceAll('<img src=x onerror=alert(1)>', label);
  const { of, states } = await draw(page, JSON.parse(spec));
  expect(of('error')).toEqual([]);
  expect(states.at(-1)).toEqual(fixtureState('hostile-label'));
  await expect(page.frameLocator('#app').locator('button', { hasText: label })).toHaveCount(1);
});

test('the text of the panel has the theme color, also in a button (a legend label)', async ({ page }) => {
  // contract-rule: renderer.11
  await draw(page, fixtureSpec('prometheus-line'));
  const app = page.frameLocator('#app');
  // The dark theme: `text.primary` is rgb(204, 204, 220). A browser gives a button black text with no reset.
  await expect(app.locator('button', { hasText: /^\/api\/annotations$/ })).toHaveCSS('color', 'rgb(204, 204, 220)');
});
