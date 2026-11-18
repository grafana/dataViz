import { type RenderHandle, type RenderOptions, type RenderState } from '@grafana/viz-contract/renderer-api';
import { act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getInstanceByDom } from 'lib/echarts/echarts';
import { fixtureSpec } from 'test/rendererFixtures';
import { render } from './index';

// The legend of the user: hide, show and color the items (`renderer.34` to `renderer.37`). `prometheus-line` has 17
// series, one for each route. A click on a legend label shows only that series.
const KEPT = '/api/health';
const OTHER = '/api/search/';

function sizedElement(): HTMLElement {
  const el = document.createElement('div');
  el.style.width = '600px';
  el.style.height = '300px';
  document.body.appendChild(el);
  return el;
}

const handles: RenderHandle[] = [];

function draw(spec: unknown, options: RenderOptions = {}, el = sizedElement()) {
  const states: RenderState[] = [];
  const handle = render(el, spec, { ...options, onState: (state) => states.push(state) });
  handles.push(handle);
  return { el, states, handle };
}

const chartOf = (el: HTMLElement) => getInstanceByDom(el.querySelector('[_echarts_instance_]') as HTMLElement)!;
const seriesNames = (el: HTMLElement) => (chartOf(el).getOption().series as Array<{ name: string }>).map((s) => s.name);
const waitForState = (el: HTMLElement, state: string) =>
  waitFor(() => expect(el.getAttribute('data-viz-state')).toBe(state));

/** A viz spec with the series of `prometheus-line`, and one `refresh` that changes nothing in it. */
const spec = () => fixtureSpec('prometheus-line');

/** The user shows only `KEPT`, and the chart draws it. */
async function showOnlyKept(el: HTMLElement) {
  await waitForState(el, 'ready');
  expect(seriesNames(el)).toHaveLength(17);
  await userEvent.click(within(el).getByText(KEPT));
  await waitFor(() => expect(seriesNames(el)).toEqual([KEPT]));
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => handles.splice(0).forEach((handle) => handle.destroy()));
  consoleError.mockRestore();
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('the legend changes of the user', () => {
  // contract-rule: renderer.34
  it('draws with a legend action, and gives the App no new state and no new viz spec', async () => {
    const input = spec();
    const before = JSON.stringify(input);
    const { el, states } = draw(input);
    await showOnlyKept(el);
    expect(states.map((state) => state.state)).toEqual(['ready']);
    expect(JSON.stringify(input)).toBe(before);
  });

  // contract-rule: renderer.35
  it.each([
    ['a new viz spec with the same data', (next: Record<string, unknown>) => next],
    ['a new theme', (next: Record<string, unknown>) => ({ ...next, theme: 'light' })],
    ['a new time zone', (next: Record<string, unknown>) => ({ ...next, timeZone: 'utc' })],
  ])('keeps the legend changes after update with %s', async (_name, change) => {
    const { el, handle } = draw(spec());
    await showOnlyKept(el);
    act(() => handle.update(change(spec())));
    await waitForState(el, 'ready');
    expect(seriesNames(el)).toEqual([KEPT]);
  });

  // contract-rule: renderer.35
  it('keeps the legend changes after a refresh', async () => {
    const onRefresh = jest.fn();
    const { el, handle } = draw(spec(), { onRefresh });
    await showOnlyKept(el);
    await userEvent.click(within(el).getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    // `refresh.12`: the App calls `update` with the new viz spec, and then `setRefreshed`.
    act(() => {
      handle.update(spec());
      handle.setRefreshed(onRefresh.mock.calls[0][0].id, true);
    });
    await waitForState(el, 'ready');
    expect(seriesNames(el)).toEqual([KEPT]);
    // `renderer.37`: the refresh does not send them to the Source.
    expect(JSON.stringify(onRefresh.mock.calls)).not.toMatch(/hideSeriesFrom|hideFrom/);
  });

  // contract-rule: renderer.35
  it('gives a legend override priority over an override of the viz spec', async () => {
    const { el, handle } = draw(spec());
    await showOnlyKept(el);
    // The new viz spec shows only `OTHER`, with the same override that the legend writes.
    const next: any = spec();
    next.panel.fieldConfig = {
      defaults: next.panel.fieldConfig.defaults,
      overrides: [
        {
          __systemRef: 'hideSeriesFrom',
          matcher: {
            id: 'byNames',
            options: { mode: 'exclude', names: [OTHER], prefix: 'All except:', readOnly: true },
          },
          properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: true } }],
        },
      ],
    };
    act(() => handle.update(next));
    await waitForState(el, 'ready');
    expect(seriesNames(el)).toEqual([KEPT]);
  });

  // contract-rule: renderer.36
  it('finds an item by its name, and keeps the change for a name that is not in the new data', async () => {
    const { el, handle } = draw(spec());
    await showOnlyKept(el);
    // The new data has no `KEPT`, so the chart shows no series, as a Grafana panel does.
    act(() => handle.update(fixtureSpec('smoke-timeseries')));
    await waitForState(el, 'ready');
    expect(seriesNames(el)).toEqual([]);
    // `KEPT` comes back in a later `update`, and the change applies to it again.
    act(() => handle.update(spec()));
    await waitForState(el, 'ready');
    expect(seriesNames(el)).toEqual([KEPT]);
  });

  // contract-rule: renderer.36
  it('lets the user change the legend again after the chart has no series', async () => {
    const { el, handle } = draw(spec());
    await showOnlyKept(el);
    act(() => handle.update(fixtureSpec('smoke-timeseries')));
    await waitForState(el, 'ready');
    // A click on the legend item of the new data shows that series.
    await userEvent.click(within(el).getByText('api-0'));
    await waitFor(() => expect(seriesNames(el).length).toBeGreaterThan(0));
  });

  // contract-rule: renderer.37
  it('starts a new render with no legend changes, and keeps no legend changes in localStorage', async () => {
    const first = draw(spec());
    await showOnlyKept(first.el);
    expect(localStorage.length).toBe(0);
    const second = draw(spec());
    await waitForState(second.el, 'ready');
    expect(seriesNames(second.el)).toHaveLength(17);
  });

  // contract-rule: renderer.37
  it('starts a second render into the same element with no legend changes', async () => {
    const el = sizedElement();
    const first = draw(spec(), {}, el);
    await showOnlyKept(el);
    first.handle.destroy();
    draw(spec(), {}, el);
    await waitForState(el, 'ready');
    expect(seriesNames(el)).toHaveLength(17);
  });
});
