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
  // contract-rule: renderer.46
  // contract-rule: renderer.47
  const spec = fixtureSpec('prometheus-line');
  const { requests } = await draw(page, spec);
  const ui = controls(page);
  const chart = await gestures(page);
  await expect(ui.reset).toHaveCount(0);

  await chart.zoomOut();
  const wide = await nextRequest(page, 1);
  expect([wide.from, wide.to]).toEqual(['1790352127294', '1790353927294']);
  await expect(ui.zoomOut).toHaveCount(0);
  await expect(ui.reset).toHaveCount(0);
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

  await chart.zoomOut();
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

  expect(requests).toEqual([]);
});

test('time range gestures stay local without onRefresh', async ({ page }) => {
  const { requests } = await draw(page, fixtureSpec('prometheus-line'), { onRefresh: false });
  const ui = controls(page);
  const chart = await gestures(page);
  await chart.zoomIn();
  await expect(ui.reset).toHaveCount(0);
  await chart.startPan();
  await chart.endPan();
  await chart.zoomOut();
  await expect(ui.reset).toHaveCount(0);
  await settle(page);
  const messages = await readMessages(page);
  expect(messages.filter((m) => m.type === 'refresh' || m.type === 'error' || m.directive === 'connect-src')).toEqual(
    []
  );
  expect(requests).toEqual([]);
});
