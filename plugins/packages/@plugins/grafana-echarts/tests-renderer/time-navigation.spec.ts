import { expect, type Page, test } from '@playwright/test';
import { draw, fixtureSpec, readMessages, settle } from './harness';

const fixtureFrom = 1790352577294;
const fixtureTo = 1790353477294;

function controls(page: Page) {
  const app = page.frameLocator('#app');
  return {
    picker: app.getByTestId('data-testid TimePicker Open Button'),
    zoomOut: app.getByRole('button', { name: 'Zoom out time range' }),
    reset: app.getByRole('button', { name: 'Reset time range' }),
    refresh: app.getByRole('button', { name: 'Refresh' }),
    status: app.getByRole('status'),
  };
}

async function gestures(page: Page) {
  const box = (await page.frameLocator('#app').locator('[_echarts_instance_]').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const startZoom = async () => {
    await page.mouse.move(x - box.width * 0.15, y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 4 });
  };
  const endZoom = async () => {
    await page.mouse.move(x + box.width * 0.15, y, { steps: 4 });
    await page.mouse.up();
  };
  return {
    startZoom,
    endZoom,
    zoomOut: () => page.mouse.dblclick(x, y),
    zoomIn: async () => {
      await startZoom();
      await endZoom();
    },
    startPan: async () => {
      // The last pixels of this time chart's canvas hold the x axis labels.
      await page.mouse.move(x, box.y + box.height - 8);
      await page.mouse.down();
      await page.mouse.move(x + box.width * 0.1, box.y + box.height - 8, { steps: 4 });
    },
    endPan: () => page.mouse.up(),
  };
}

const refreshes = async (page: Page) =>
  (await readMessages(page)).filter((message) => message.type === 'refresh').map((message) => message.request);

async function answer(page: Page, message: Record<string, unknown>) {
  await page
    .locator('#app')
    .evaluate((iframe: HTMLIFrameElement, data) => iframe.contentWindow!.postMessage(data, '*'), message);
}

async function nextRequest(page: Page, count: number) {
  await expect.poll(() => refreshes(page)).toHaveLength(count);
  await expect(controls(page).refresh).toBeDisabled();
  const request = (await refreshes(page)).at(-1);
  expect(request).toEqual({
    id: expect.any(String),
    cause: 'timeRange',
    from: expect.any(String),
    to: expect.any(String),
  });
  return request as { id: string; from: string; to: string };
}

test('time range actions ask the App once, and a busy chart ignores more actions', async ({ page }) => {
  // contract-rule: delivery.12
  // contract-rule: renderer.44
  // contract-rule: renderer.46
  // contract-rule: renderer.47
  // contract-rule: renderer.48
  const spec = fixtureSpec('prometheus-line');
  const { requests } = await draw(page, spec);
  const ui = controls(page);
  const chart = await gestures(page);
  await expect(ui.reset).toBeDisabled();

  await chart.zoomOut();
  const wide = await nextRequest(page, 1);
  expect([wide.from, wide.to]).toEqual(['1790352127294', '1790353927294']);
  await expect(ui.zoomOut).toBeDisabled();
  await expect(ui.reset).toBeDisabled();
  await chart.zoomIn();
  await chart.zoomOut();
  await chart.startPan();
  await chart.endPan();
  await settle(page);
  expect(await refreshes(page)).toHaveLength(1);
  await chart.startZoom();
  await answer(page, { type: 'setRefreshed', id: wide.id, ok: true });
  await expect(ui.refresh).toBeEnabled();
  await chart.endZoom();
  await settle(page);
  expect(await refreshes(page)).toHaveLength(1);

  await ui.zoomOut.click();
  const pickerZoom = await nextRequest(page, 2);
  expect([pickerZoom.from, pickerZoom.to]).toEqual([wide.from, wide.to]);
  await answer(page, { type: 'setRefreshed', id: pickerZoom.id, ok: true });
  await expect(ui.refresh).toBeEnabled();

  await chart.zoomIn();
  const zoomed = await nextRequest(page, 3);
  expect(Number(zoomed.from)).toBeGreaterThan(fixtureFrom);
  expect(Number(zoomed.to)).toBeLessThan(fixtureTo);
  expect(Number(zoomed.from)).toBeLessThan(Number(zoomed.to));
  await answer(page, { type: 'setRefreshed', id: zoomed.id, ok: true });
  await expect(ui.refresh).toBeEnabled();

  await chart.startPan();
  await settle(page);
  expect(await refreshes(page)).toHaveLength(3);
  await chart.endPan();
  const pan = await nextRequest(page, 4);
  expect(pan.from).toMatch(/^\d+$/);
  expect(pan.to).toMatch(/^\d+$/);
  expect(Number(pan.from)).toBeLessThan(fixtureFrom);
  expect(Number(pan.to) - Number(pan.from)).toBe(fixtureTo - fixtureFrom);
  await answer(page, { type: 'setRefreshed', id: pan.id, ok: true });

  await ui.reset.click();
  const reset = await nextRequest(page, 5);
  expect([reset.from, reset.to]).toEqual(['now-15m', 'now']);
  await answer(page, { type: 'setRefreshed', id: reset.id, ok: false });
  await expect(ui.status).toHaveText('Refresh failed.');

  await ui.reset.click();
  const retry = await nextRequest(page, 6);
  expect([retry.from, retry.to]).toEqual([reset.from, reset.to]);
  await answer(page, { type: 'update', spec });
  await expect(ui.refresh).toBeEnabled();
  await expect(ui.reset).toBeDisabled();
  expect(requests).toEqual([]);
});

test('Reset uses the last time picker selection after a zoom', async ({ page }) => {
  const spec = fixtureSpec('prometheus-line');
  await draw(page, spec);
  const app = page.frameLocator('#app');
  const ui = controls(page);
  await ui.picker.click();
  await app.getByText('Last 6 hours', { exact: true }).click();
  const pick = await nextRequest(page, 1);
  expect([pick.from, pick.to]).toEqual(['now-6h', 'now']);
  await answer(page, { type: 'update', spec });
  await expect(ui.reset).toBeDisabled();

  await (await gestures(page)).zoomIn();
  const zoom = await nextRequest(page, 2);
  await answer(page, { type: 'setRefreshed', id: zoom.id, ok: true });

  await ui.reset.click();
  const reset = await nextRequest(page, 3);
  expect([reset.from, reset.to]).toEqual([pick.from, pick.to]);
});

test('time range gestures stay local without onRefresh', async ({ page }) => {
  const { requests } = await draw(page, fixtureSpec('prometheus-line'), { onRefresh: false });
  const ui = controls(page);
  const chart = await gestures(page);
  await chart.zoomIn();
  await expect(ui.reset).toBeVisible();
  await chart.startPan();
  await chart.endPan();
  await chart.zoomOut();
  await ui.reset.click();
  await expect(ui.reset).toHaveCount(0);
  await settle(page);
  const messages = await readMessages(page);
  expect(messages.filter((m) => m.type === 'refresh' || m.type === 'error' || m.directive === 'connect-src')).toEqual(
    []
  );
  expect(requests).toEqual([]);
});
