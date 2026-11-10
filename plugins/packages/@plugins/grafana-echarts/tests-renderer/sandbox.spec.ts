// The Renderer in `<iframe sandbox="allow-scripts">` with the default CSP of MCP Apps and the network blocked
// (`renderer.6`, `renderer.7`, `renderer.8`). Build first: `pnpm run build:renderer && pnpm run build:renderer-harness`.
import { expect, type Page, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { draw, fixtureSets, fixtureSpec, fixtureState, type Message, readMessages, settle } from './harness';

/**
 * CSP reports that the Renderer does not cause. The `@grafana/data` bundle of the App tests `new Function('')` in a
 * try/catch to see if eval works (a feature probe of a bundled schema library). The probe is blocked and caught:
 * nothing breaks.
 */
const isPeerEvalProbe = (m: Message) => m.directive === 'script-src' && m.blocked === 'eval';

/**
 * An icon request of `@grafana/ui` `Icon`: `react-inlinesvg` fetches the SVG when the icon cache has no entry for its
 * URL. `connect-src 'none'` blocks the fetch, so it is a CSP report, not a request of the page.
 */
const isIconFetch = (m: Message) =>
  m.type === 'csp' && typeof m.blocked === 'string' && m.blocked.includes('/public/build/img/icons/');

/** The icons that the iframe requested up to now, as `<dir>/<name>`: add each one to `src/renderer/iconList.json`. */
const iconRequests = async (page: Page) =>
  (await readMessages(page)).filter(isIconFetch).map((m) => String(m.blocked).replace(/^.*\/icons\/|\.svg$/g, ''));

for (const set of ['prometheus-line', 'smoke-geomap']) {
  test(`${set}: draws in the sandbox with no request, no CSP violation and no error`, async ({ page }) => {
    // contract-rule: delivery.1
    // contract-rule: renderer.6
    // contract-rule: renderer.7
    const { requests, of, states } = await draw(page, fixtureSpec(set));
    expect(states.at(-1)).toEqual(fixtureState(set));
    expect(requests).toEqual([]);
    expect(of('csp').filter((m) => !isPeerEvalProbe(m))).toEqual([]);
    expect(of('error')).toEqual([]);
  });
}

// `delivery.8`: the harness App fills the icon cache from `icons.json`, as the App does. Then each fixture set draws in
// the states of the rule, with no icon request. The check finds only the icons of these states.
const NARROW = { width: 480, height: 400 };
for (const set of fixtureSets()) {
  test(`${set}: no icon request with no onRefresh, and below 769 px wide`, async ({ page }) => {
    // contract-rule: delivery.8
    // Below 769 px, the toolbar buttons of `@grafana/ui` show only their icon.
    for (const options of [{ onRefresh: false }, { size: NARROW }]) {
      await page.unrouteAll();
      await draw(page, fixtureSpec(set), options);
      expect(await iconRequests(page), JSON.stringify(options)).toEqual([]);
    }
  });

  test(`${set}: no icon request with onRefresh, a tooltip, a legend menu and the time picker open`, async ({
    page,
  }) => {
    // contract-rule: delivery.8
    // The zoom controls show with no interaction, for the families that have them.
    await draw(page, fixtureSpec(set));
    expect(await iconRequests(page)).toEqual([]);
    const app = page.frameLocator('#app');
    const box = (await page.locator('#app').boundingBox())!;
    // A tooltip opens on hover over the middle of the chart, and a click there pins it. Not each chart has a data
    // point in the middle, so not each set gets a tooltip.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await settle(page);
    await page.keyboard.press('Escape');
    // The legend menu: the color picker of a series opens from its color icon.
    const seriesIcon = app.getByTestId('series-icon').first();
    if ((await seriesIcon.count()) > 0) {
      await seriesIcon.click();
      await settle(page);
      await page.keyboard.press('Escape');
    }
    const timePicker = app.getByTestId('data-testid TimePicker Open Button');
    if ((await timePicker.count()) > 0) {
      await timePicker.click();
      await settle(page);
    }
    expect(await iconRequests(page)).toEqual([]);
  });
}

test('the delivery.8 interactions reach their states', async ({ page }) => {
  // The test above passes with no icon request if an interaction opens nothing. This set has each control.
  await draw(page, fixtureSpec('prometheus-line'));
  const app = page.frameLocator('#app');
  const box = (await page.locator('#app').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // A count, not a visible check: with no icon, the close button has no size.
  await expect(app.getByRole('button', { name: 'Close' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await app.getByTestId('series-icon').first().click();
  await expect(app.getByTestId('data-testid Tab Colors')).toBeVisible();
  await page.keyboard.press('Escape');
  await app.getByTestId('data-testid TimePicker Open Button').click();
  await expect(app.getByText('Absolute time range')).toBeVisible();
});

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
  await draw(page, fixtureSpec('smoke-timeseries'));
  expect(await iconRequests(page)).toEqual([]);
  // A filled icon cache draws the SVG, not the empty `loader` element of `Icon`.
  await expect(page.frameLocator('#app').getByTestId('icon-sync').locator('path')).not.toHaveCount(0);
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
