import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getInstanceByDom } from 'lib/echarts/echarts';
import { withLayout } from 'test/layout';
import { fixtureSpec } from 'test/rendererFixtures';
import { type RenderHandle, type RenderOptions, type RenderState } from './contract/renderer-api';
import { render } from './index';
import { TOOLBAR_HEIGHT_PX } from './layout';

/** An element with an inline size: the jsdom shim of `jest-setup.js` reads `clientWidth` from the style. */
function sizedElement(width = 600, height = 300): HTMLElement {
  const el = document.createElement('div');
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  document.body.appendChild(el);
  return el;
}

/** The handles of a test. Each one is destroyed before the DOM is cleared, so React unmounts its portals first. */
const handles: RenderHandle[] = [];

function draw(spec: unknown, options: RenderOptions = {}, el = sizedElement()) {
  const states: RenderState[] = [];
  const handle = render(el, spec, { ...options, onState: (state) => states.push(state) });
  handles.push(handle);
  return { el, states, handle };
}

const waitForState = (el: HTMLElement, state: string) =>
  waitFor(() => expect(el.getAttribute('data-viz-state')).toBe(state));

const chartOf = (el: HTMLElement) => getInstanceByDom(el.querySelector('[_echarts_instance_]') as HTMLElement)!;

/** The callbacks of each `ResizeObserver` of a test, so a test can report a size change. */
const resizeCallbacks: ResizeObserverCallback[] = [];
const OriginalResizeObserver = global.ResizeObserver;
const resize = () => act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)));

let consoleError: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  global.ResizeObserver = class extends OriginalResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      resizeCallbacks.push(callback);
    }
  };
});
afterEach(() => {
  act(() => handles.splice(0).forEach((handle) => handle.destroy()));
  consoleError.mockRestore();
  global.ResizeObserver = OriginalResizeObserver;
  resizeCallbacks.length = 0;
  document.body.innerHTML = '';
});

describe('the handle', () => {
  // contract-rule: renderer.2
  it('returns at once, in the rendering state', () => {
    const { el, handle, states } = draw(fixtureSpec('smoke-timeseries'));
    expect(handle).toEqual({
      update: expect.any(Function),
      setRefreshed: expect.any(Function),
      destroy: expect.any(Function),
    });
    expect(el.getAttribute('data-viz-state')).toBe('rendering');
    expect(states).toEqual([]);
  });

  // contract-rule: renderer.4
  it('draws a new viz spec into the same element with update', async () => {
    const { el, handle, states } = draw(fixtureSpec('smoke-timeseries'));
    await waitForState(el, 'ready');
    act(() => handle.update(fixtureSpec('no-data')));
    await waitForState(el, 'no-data');
    act(() => handle.update(fixtureSpec('smoke-timeseries')));
    await waitForState(el, 'ready');
    expect(states.map((state) => state.state)).toEqual(['ready', 'no-data', 'ready']);
    expect(el.querySelectorAll('[_echarts_instance_]')).toHaveLength(1);
  });

  it('gives the same state no second onState after an update with the same viz spec', async () => {
    const { el, handle, states } = draw(fixtureSpec('smoke-timeseries'));
    await waitForState(el, 'ready');
    act(() => handle.update(fixtureSpec('smoke-timeseries')));
    await waitForState(el, 'ready');
    expect(states).toHaveLength(1);
  });

  // contract-rule: renderer.5
  it('removes the chart and the attributes on destroy, and then update and setRefreshed do nothing', async () => {
    const el = withLayout(document.createElement('div'));
    el.style.width = '600px';
    document.body.appendChild(el);
    const { handle, states } = draw(fixtureSpec('smoke-timeseries'), { onRefresh: jest.fn() }, el);
    await waitForState(el, 'ready');
    expect(el.style.height).toBe('400px');
    act(() => handle.destroy());
    expect(el.childElementCount).toBe(0);
    expect(el.hasAttribute('data-viz-state')).toBe(false);
    expect(el.style.height).toBe('');
    act(() => {
      handle.update(fixtureSpec('no-data'));
      handle.setRefreshed(false, 'late');
    });
    expect(el.childElementCount).toBe(0);
    expect(states).toHaveLength(1);
  });

  it('destroys the first Renderer when a second render uses the same element', async () => {
    const el = sizedElement();
    const first = draw(fixtureSpec('smoke-timeseries'), {}, el);
    await waitForState(el, 'ready');
    const second = draw(fixtureSpec('no-data'), {}, el);
    await waitForState(el, 'no-data');
    act(() => first.handle.update(fixtureSpec('smoke-timeseries')));
    expect(el.getAttribute('data-viz-state')).toBe('no-data');
    expect(el.querySelectorAll('[_echarts_instance_]')).toHaveLength(0);
    expect(second.states.map((state) => state.state)).toEqual(['no-data']);
  });

  // contract-rule: renderer.5
  it.each([
    ['destroy', (handle: RenderHandle) => handle.destroy()],
    ['render again into el', (_handle: RenderHandle, el: HTMLElement) => draw(fixtureSpec('no-data'), {}, el)],
  ])('lets onState %s without a React error', async (_name, call) => {
    const el = sizedElement();
    let handle: RenderHandle | undefined;
    const onState = jest.fn(() => call(handle!, el));
    handle = render(el, fixtureSpec('no-data'), { onState });
    handles.push(handle);
    await waitFor(() => expect(onState).toHaveBeenCalledTimes(1));
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringMatching(/synchronously unmount a root/));
  });

  // contract-rule: renderer.10
  it('fills el and follows a size change', async () => {
    const { el } = draw(fixtureSpec('smoke-timeseries'));
    await waitForState(el, 'ready');
    expect(chartOf(el).getWidth()).toBe(600);
    el.style.width = '500px';
    resize();
    await waitFor(() => expect(chartOf(el).getWidth()).toBe(500));
  });

  // contract-rule: renderer.10
  it('sets no height on an el that is not in the document, so a later stylesheet height applies', async () => {
    const el = withLayout(document.createElement('div'));
    el.style.width = '600px';
    draw(fixtureSpec('smoke-timeseries'), {}, el);
    expect(el.style.height).toBe('');
    // A stylesheet height: jsdom has no layout, so the test gives `clientHeight`.
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: 250 });
    document.body.appendChild(el);
    resize();
    expect(el.style.height).toBe('');
    // The box of the chart. The legend takes a part of it.
    await waitFor(() => expect((el.firstElementChild as HTMLElement).style.height).toBe('250px'));
  });

  // contract-rule: renderer.10
  it('sets no height on a hidden el, so its stylesheet height applies when it shows', async () => {
    const el = withLayout(document.createElement('div'));
    el.style.width = '600px';
    el.style.display = 'none';
    document.body.appendChild(el);
    draw(fixtureSpec('smoke-timeseries'), {}, el);
    expect(el.style.height).toBe('');
    // A stylesheet height: jsdom has no layout, so the test gives `clientHeight`.
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: 250 });
    el.style.display = '';
    resize();
    expect(el.style.height).toBe('');
    await waitFor(() => expect((el.firstElementChild as HTMLElement).style.height).toBe('250px'));
  });

  // contract-rule: renderer.10
  it('sets defaultHeightPx on an el with no height when it goes into the document', () => {
    const el = withLayout(document.createElement('div'));
    el.style.width = '600px';
    const { handle } = draw(fixtureSpec('smoke-timeseries'), {}, el);
    document.body.appendChild(el);
    resize();
    expect(el.style.height).toBe('400px');
    act(() => handle.destroy());
    expect(el.style.height).toBe('');
  });

  it('keeps on destroy a height that the App set after render', () => {
    const el = withLayout(document.createElement('div'));
    el.style.width = '600px';
    document.body.appendChild(el);
    const { handle } = draw(fixtureSpec('smoke-timeseries'), {}, el);
    expect(el.style.height).toBe('400px');
    el.style.height = '250px';
    act(() => handle.destroy());
    expect(el.style.height).toBe('250px');
  });

  // contract-rule: renderer.14
  it('does nothing outside data.range for a brush zoom: no onRefresh, the same state', async () => {
    const onRefresh = jest.fn();
    const { el, states, handle } = draw(fixtureSpec('smoke-timeseries'), { onRefresh });
    await waitForState(el, 'ready');
    const chart = chartOf(el);
    const clear = jest.spyOn(chart, 'dispatchAction');
    const { from, to } = (fixtureSpec('smoke-timeseries').data as { range: { from: number; to: number } }).range;
    act(() => {
      chart.trigger('brushend', { areas: [{ coordRange: [from + 60_000, to - 60_000] }] });
    });
    // The brush handler ran: it clears its selection.
    expect(clear).toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(states).toHaveLength(1);
    handle.destroy();
  });
});

describe('refresh', () => {
  // contract-rule: refresh.1
  it('shows Refresh and the time picker only with onRefresh', async () => {
    const without = draw(fixtureSpec('smoke-timeseries'));
    await waitForState(without.el, 'ready');
    expect(within(without.el).queryByRole('button', { name: /refresh/i })).toBeNull();

    const withRefresh = draw(fixtureSpec('smoke-timeseries'), { onRefresh: jest.fn() });
    await waitForState(withRefresh.el, 'ready');
    expect(within(withRefresh.el).getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    expect(within(withRefresh.el).getByTestId(/TimePicker Open Button/i)).toBeInTheDocument();
  });

  it('gives the chart the height of el minus the bar', async () => {
    const { el } = draw(fixtureSpec('smoke-timeseries'), { onRefresh: jest.fn() });
    await waitForState(el, 'ready');
    // In the root of the Renderer, the box of the chart is after the bar. The legend takes a part of it.
    const root = el.firstElementChild as HTMLElement;
    expect(root.style.height).toBe('300px');
    expect((root.lastElementChild as HTMLElement).style.height).toBe(`${300 - TOOLBAR_HEIGHT_PX}px`);
  });

  // contract-rule: refresh.2
  // contract-rule: refresh.4
  // contract-rule: refresh.5
  it('calls onRefresh, is busy with the old chart, and shows the result of setRefreshed', async () => {
    const onRefresh = jest.fn();
    const { el, handle } = draw(fixtureSpec('smoke-timeseries'), { onRefresh });
    await waitForState(el, 'ready');
    await userEvent.click(within(el).getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledWith({ cause: 'refresh' });
    const fieldset = el.querySelector('fieldset')!;
    expect(fieldset).toBeDisabled();
    expect(el.querySelector('[_echarts_instance_]')).not.toBeNull();

    act(() => handle.setRefreshed(false, 'bad_data: parse error'));
    expect(fieldset).not.toBeDisabled();
    expect(within(el).getByRole('status').textContent).toBe('Refresh failed: bad_data: parse error');

    await userEvent.click(within(el).getByRole('button', { name: /refresh/i }));
    expect(within(el).getByRole('status').textContent).toBe('');
    act(() => handle.update(fixtureSpec('smoke-timeseries')));
    expect(fieldset).not.toBeDisabled();
  });

  // contract-rule: refresh.3
  it('calls onRefresh with a relative range for a quick range of the time picker', async () => {
    const onRefresh = jest.fn();
    const { el } = draw(fixtureSpec('smoke-timeseries'), { onRefresh });
    await waitForState(el, 'ready');
    await userEvent.click(within(el).getByTestId(/TimePicker Open Button/i));
    await userEvent.click(await screen.findByText('Last 6 hours'));
    expect(onRefresh).toHaveBeenCalledWith({ cause: 'timeRange', from: 'now-6h', to: 'now' });
  });

  it('calls onRefresh with an absolute range for the move back button', async () => {
    const onRefresh = jest.fn();
    const spec = fixtureSpec('smoke-timeseries');
    const { from, to } = (spec.data as { range: { from: number; to: number } }).range;
    const { el } = draw(spec, { onRefresh });
    await waitForState(el, 'ready');
    await userEvent.click(within(el).getByRole('button', { name: /move time range backwards/i }));
    const half = (to - from) / 2;
    expect(onRefresh).toHaveBeenCalledWith({ cause: 'timeRange', from: String(from - half), to: String(to - half) });
  });
});
