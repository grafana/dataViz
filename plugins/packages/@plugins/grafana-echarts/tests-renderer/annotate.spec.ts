// The Add annotation check of the Renderer (`delivery.14`): the `prometheus-line` fixture with `onAnnotate`, in the
// sandbox iframe. The test acts as the App, and a clock of the test makes `annotateTimeoutMs` pass.
// Build first: `pnpm run build:renderer && pnpm run build:renderer-harness`.
import { expect, type Page, test } from '@playwright/test';
import constants from '@grafana/viz-contract/registry/constants.json';
import states from '@grafana/viz-contract/registry/states.json';
import { draw, fixtureSpec, type Message, readMessages, sendToApp, settle } from './harness';

interface Request {
  id: string;
  time: number;
  timeEnd?: number;
  text: string;
  tags: string[];
}

const annotateMessage = (code: string) => states.annotate.find((row) => row.code === code)!.message;

/** `prometheus-line` in UTC, so the times in the form header do not depend on the time zone of the test machine. */
const spec = (set = 'prometheus-line') => ({ ...fixtureSpec(set), timeZone: 'utc' });

/** A time as the form header shows it: the full date format of Grafana, in UTC. */
const headerTime = (time: number) => new Date(time).toISOString().slice(0, 19).replace('T', ' ');

const requests = async (page: Page): Promise<Request[]> =>
  (await readMessages(page)).filter((m: Message) => m.type === 'annotate').map((m) => m.request as Request);

/** Ctrl on Linux and Windows, Cmd on macOS: `renderer.50` takes both. https://playwright.dev/docs/api/class-keyboard */
const MODIFIER = 'ControlOrMeta';

/** The height of the band at the bottom of the chart element that has the labels of the x axis and the markers. */
const MARKER_BAND_PX = 60;

/** The page of the test: the chart, the form, and the pointer positions in the plot area. */
async function open(
  page: Page,
  set?: string,
  options: { onAnnotate?: boolean; onRefresh?: boolean; size?: { width: number; height: number } } = {}
) {
  // A clock of the test, so `annotateTimeoutMs` passes with `fastForward`. https://playwright.dev/docs/clock
  await page.clock.install();
  // In an element of the default size of this test, the form is beside its time for each point of the plot area,
  // and it does not cover the marker of an annotation there.
  await draw(page, spec(set), { onAnnotate: true, onRefresh: false, size: { width: 1200, height: 600 }, ...options });
  const app = page.frameLocator('#app');
  const box = (await page.locator('#app').boundingBox())!;
  // A point of the plot area, from the middle of the element.
  const at = (dx = 0, dy = 0) => ({ x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy });
  const form = app.locator('[data-echarts-annotation-editor]');
  const text = app.getByRole('textbox', { name: 'Description' });

  const click = async (dx = 0, modifier = false, dy = 0) => {
    const { x, y } = at(dx, dy);
    await page.mouse.move(x, y);
    await (modifier ? page.keyboard.down(MODIFIER) : Promise.resolve());
    await page.mouse.click(x, y);
    await (modifier ? page.keyboard.up(MODIFIER) : Promise.resolve());
    await settle(page);
  };
  const drag = async (fromDx: number, toDx: number, modifier = false) => {
    await page.mouse.move(at(fromDx).x, at(fromDx).y);
    await (modifier ? page.keyboard.down(MODIFIER) : Promise.resolve());
    await page.mouse.down();
    await page.mouse.move(at(toDx).x, at(toDx).y, { steps: 5 });
    await page.mouse.up();
    await (modifier ? page.keyboard.up(MODIFIER) : Promise.resolve());
    await settle(page);
  };
  /**
   * Pins a tooltip. Not each point of the plot area has data near it, so it clicks across the plot area until a
   * click pins a tooltip. A count, not a visible check: with no icon, the close button has no size.
   */
  const pin = async () => {
    const close = app.getByRole('button', { name: 'Close' });
    for (const dy of [0, 80, 160, -80]) {
      for (let dx = 0; dx < 400 && (await close.count()) === 0; dx += 40) {
        await click(dx, false, dy);
      }
    }
    await expect(close).toHaveCount(1);
  };
  const addTag = async (tag: string) => {
    await app.getByPlaceholder('Add tags').fill(tag);
    await app.getByPlaceholder('Add tags').press('Enter');
  };
  /** Clicks Save, and gives the last request after the click. */
  const save = async () => {
    await app.getByRole('button', { name: 'Save' }).click();
    await settle(page);
    return (await requests(page)).at(-1)!;
  };
  const setAnnotated = async (id: string, ok: boolean, error?: string) => {
    await sendToApp(page, { type: 'setAnnotated', id, ok, error });
    await settle(page);
  };
  const timeout = async () => {
    await page.clock.fastForward(constants.annotateTimeoutMs.value);
    await settle(page);
  };
  /**
   * Makes sure that the chart shows an annotation with `label` at the x of `dx`: its marker is under the plot area,
   * and a hover on the marker shows the text of the annotation.
   */
  const expectAnnotation = async (dx: number, label: string) => {
    const shown = app.locator('[data-echarts-tooltip]', { hasText: label });
    // The marker is 5 px high, between the plot area and the labels of the x axis. Thus it is in the band at the
    // bottom of the chart element. The hover goes up through that band only: a hover in the plot area is slow,
    // and the test has a time limit.
    const chart = (await app.locator('[_echarts_instance_]').boundingBox())!;
    const bottom = chart.y + chart.height;
    for (let y = bottom - 2; y > bottom - MARKER_BAND_PX && (await shown.count()) === 0; y -= 2) {
      await page.mouse.move(at(dx).x, y);
      // The tooltip shows on the next animation frame.
      await settle(page);
    }
    await expect(shown).toHaveCount(1);
    await page.mouse.move(box.x + 2, box.y + 2);
  };
  return { app, box, form, text, click, drag, pin, addTag, save, setAnnotated, timeout, expectAnnotation };
}

// The form does not close on a press out of it, so the user moves it with a Ctrl or Cmd click on the plot area
// (`renderer.52`). Thus the form must leave a part of the plot area free, also in a small element.
for (const size of [
  { width: 480, height: 400 },
  { width: 640, height: 400 },
]) {
  test(`in an element ${size.width} px wide, the form leaves plot area free, and a click there moves it`, async ({
    page,
  }) => {
    const { box, form, text, click, save } = await open(page, undefined, { size });
    await click(0, true);
    await text.fill('Deploy');
    const first = (await form.getByText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).textContent())!;

    // A point 30 px to the left or to the right of the form, in the plot area. The y axis labels are at the left
    // of the plot area.
    const formBox = (await form.boundingBox())!;
    const plot = { left: box.x + 100, right: box.x + box.width - 30 };
    const free = [formBox.x - 30, formBox.x + formBox.width + 30].find((x) => x > plot.left && x < plot.right);
    expect(free, `the form covers x ${formBox.x} to ${formBox.x + formBox.width}`).toBeDefined();

    await click(free! - (box.x + box.width / 2), true);
    await expect(text).toHaveValue('Deploy');
    const moved = headerTime((await save()).time);
    expect(moved).not.toBe(first);
    await expect(form).toContainText(moved);
  });
}

test('the pinned tooltip has an Add annotation button, and a click on it opens the form', async ({ page }) => {
  // contract-rule: delivery.14
  const { app, form, pin } = await open(page);
  await pin();
  await app.getByRole('button', { name: 'Add annotation' }).click();
  await expect(form).toBeVisible();
  // The click closes the tooltip.
  await expect(app.getByRole('button', { name: 'Add annotation' })).toHaveCount(0);
});

test('only a Ctrl or Cmd click or drag opens the form', async ({ page }) => {
  // contract-rule: delivery.14
  const { form, click, drag } = await open(page);
  await click();
  await drag(-60, 60);
  await expect(form).toHaveCount(0);
  await page.keyboard.press('Escape');

  await click(0, true);
  await expect(form).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(form).toHaveCount(0);
  await drag(-60, 60, true);
  await expect(form).toBeVisible();
});

test('a save calls onAnnotate one time with the time, the timeEnd, the text and the tags of the form', async ({
  page,
}) => {
  // contract-rule: delivery.14
  const { form, text, click, drag, addTag, save, setAnnotated } = await open(page);
  await click(0, true);
  // A text of white space only does not call `onAnnotate`.
  await text.fill('  \n ');
  expect(await save()).toBeUndefined();

  await text.fill('  Deploy v2 ');
  await addTag('release');
  const point = await save();
  expect(await requests(page)).toHaveLength(1);
  expect(point).toEqual({ id: expect.any(String), time: expect.any(Number), text: 'Deploy v2', tags: ['release'] });
  await expect(form).toContainText(headerTime(point.time));
  await setAnnotated(point.id, true);

  await drag(-60, 60, true);
  await text.fill('Incident');
  const range = await save();
  expect(await requests(page)).toHaveLength(2);
  expect(range).toEqual({ ...range, text: 'Incident', tags: [] });
  expect(range.timeEnd).toBeGreaterThan(range.time);
  await expect(form).toContainText(`${headerTime(range.time)} - ${headerTime(range.timeEnd!)}`);
  expect(range.id).not.toBe(point.id);
});

test('a busy form does not change and does not call onAnnotate', async ({ page }) => {
  // contract-rule: delivery.14
  const { app, form, text, click, addTag, save } = await open(page);
  await click(0, true);
  await text.fill('Deploy');
  await addTag('release');
  await save();
  await expect(app.getByRole('button', { name: 'Saving' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  // A click on a disabled button, and the Escape key.
  await app.getByRole('button', { name: 'Saving' }).click({ force: true });
  await app.getByRole('button', { name: 'Cancel' }).click({ force: true });
  await page.keyboard.press('Escape');
  await click(80, true);
  await expect(form).toBeVisible();
  await expect(text).toHaveValue('Deploy');
  await expect(form.getByText('release')).toBeVisible();
  expect(await requests(page)).toHaveLength(1);
});

test('setAnnotated(id, true) closes the form, and the chart shows the annotation', async ({ page }) => {
  // contract-rule: delivery.14
  const { form, text, click, save, setAnnotated, expectAnnotation } = await open(page);
  await click(0, true);
  await text.fill('Deploy');
  const { id } = await save();
  await setAnnotated(id, true);
  await expect(form).toHaveCount(0);
  await expectAnnotation(0, 'Deploy');
});

test('a failed save and the timeout show their message, and the form keeps its text and its tags', async ({ page }) => {
  // contract-rule: delivery.14
  const { app, form, text, click, addTag, save, setAnnotated, timeout } = await open(page);
  await click(0, true);
  await text.fill('Deploy');
  await addTag('release');
  const kept = async (message: string) => {
    await expect(app.getByRole('alert')).toHaveText(message);
    await expect(text).toHaveValue('Deploy');
    await expect(form.getByText('release')).toBeVisible();
  };

  await setAnnotated((await save()).id, false, 'Permission denied');
  await kept(annotateMessage('annotate-failed').replace('<error>', 'Permission denied'));
  await setAnnotated((await save()).id, false);
  await kept(annotateMessage('annotate-failed-no-detail'));
  await save();
  await expect(app.getByRole('alert')).toHaveCount(0);
  await timeout();
  await kept(annotateMessage('annotate-timeout'));
  expect(await requests(page)).toHaveLength(3);
});

test('after the timeout and a change of the text, a late result keeps the form open', async ({ page }) => {
  // contract-rule: delivery.14
  const { app, form, text, click, save, setAnnotated, timeout, expectAnnotation } = await open(page);
  await click(0, true);
  await text.fill('Deploy');
  const { id } = await save();
  await timeout();
  await text.fill('Deploy two');
  await setAnnotated(id, true);
  await expect(form).toBeVisible();
  await expect(text).toHaveValue('Deploy two');
  await expect(app.getByRole('alert')).toHaveCount(0);
  await expectAnnotation(0, 'Deploy');
});

test('after the timeout and a second save, the result of the first save does not change the form', async ({ page }) => {
  // contract-rule: delivery.14
  const { app, form, text, click, save, setAnnotated, timeout, expectAnnotation } = await open(page);
  await click(0, true);
  await text.fill('Deploy');
  const first = await save();
  await timeout();
  const second = await save();
  expect(second.id).not.toBe(first.id);
  await setAnnotated(first.id, true);
  await expect(form).toBeVisible();
  await expect(text).toHaveValue('Deploy');
  await expect(app.getByRole('button', { name: 'Saving' })).toBeDisabled();
  await expectAnnotation(0, 'Deploy');
});

test('after an update, the chart shows the saved annotation, and the open form keeps its text', async ({ page }) => {
  // contract-rule: delivery.14
  const { form, text, click, save, setAnnotated, expectAnnotation } = await open(page);
  await click(0, true);
  await text.fill('Deploy');
  await setAnnotated((await save()).id, true);
  await click(80, true);
  await text.fill('Restart');
  await sendToApp(page, { type: 'update', spec: spec() });
  await settle(page);
  await expect(form).toBeVisible();
  await expect(text).toHaveValue('Restart');
  await expectAnnotation(0, 'Deploy');
});

test('while the chart is busy with a refresh, the user can open and save the form', async ({ page }) => {
  // contract-rule: delivery.14
  const { app, form, text, click, save } = await open(page, undefined, { onRefresh: true });
  await app.getByRole('button', { name: 'Refresh' }).click();
  await expect(app.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  await click(0, true);
  await expect(form).toBeVisible();
  await text.fill('Deploy');
  expect(await save()).toMatchObject({ text: 'Deploy' });
  await expect(app.getByRole('button', { name: 'Refresh' })).toBeDisabled();
});

test('the form has the font of the theme, and its buttons keep the colors of their component', async ({ page }) => {
  // contract-rule: renderer.11
  const { app, form, text, click } = await open(page);
  await click(0, true);
  // The form is in a portal, so it gets the font from the portal styles of the Renderer, not from the App. A
  // browser gives a text field its own font, so the portal styles must also reach each field.
  await expect(form).toHaveCSS('font-family', /^Inter/);
  await expect(text).toHaveCSS('font-family', /^Inter/);
  await expect(app.getByPlaceholder('Add tags')).toHaveCSS('font-family', /^Inter/);
  // The portal styles do not win over the class of a `@grafana/ui` component: the primary button has white text.
  await expect(app.getByRole('button', { name: 'Save' })).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(app.getByRole('button', { name: 'Save' })).not.toHaveCSS('border-radius', '0px');
});

for (const [name, set, onAnnotate] of [
  ['with no onAnnotate', 'prometheus-line', false],
  ['on a chart with no time axis (smoke-histogram)', 'smoke-histogram', true],
] as const) {
  test(`the chart has no Add annotation UI ${name}`, async ({ page }) => {
    // contract-rule: delivery.14
    const { app, form, click, pin } = await open(page, set, { onAnnotate });
    await pin();
    await expect(app.getByRole('button', { name: 'Add annotation' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await click(0, true);
    await expect(form).toHaveCount(0);
  });
}
