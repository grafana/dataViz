import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getInstanceByDom } from 'lib/echarts/echarts';
import { fixtureSpec } from 'test/rendererFixtures';
import { type RenderHandle, type RenderOptions, type RenderState } from './contract/renderer-api';
import { render } from './index';

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

let consoleError: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => handles.splice(0).forEach((handle) => handle.destroy()));
  consoleError.mockRestore();
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
    const el = document.createElement('div');
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

  // contract-rule: renderer.10
  it('fills el and follows a size change', async () => {
    const callbacks: ResizeObserverCallback[] = [];
    const Original = global.ResizeObserver;
    global.ResizeObserver = class extends Original {
      constructor(callback: ResizeObserverCallback) {
        super(callback);
        callbacks.push(callback);
      }
    };
    try {
      const { el } = draw(fixtureSpec('smoke-timeseries'));
      await waitForState(el, 'ready');
      expect(chartOf(el).getWidth()).toBe(600);
      el.style.width = '500px';
      act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
      await waitFor(() => expect(chartOf(el).getWidth()).toBe(500));
    } finally {
      global.ResizeObserver = Original;
    }
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
    expect(chartOf(el).getHeight()).toBeLessThan(300 - 39);
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
