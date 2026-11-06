import { act, waitFor } from '@testing-library/react';
import { getInstanceByDom } from 'lib/echarts/echarts';
import { withLayout } from 'test/layout';
import { fixtureSpec } from 'test/rendererFixtures';
import { render } from './index';

/** An element with a size: jsdom has no layout, so `clientWidth` and `clientHeight` are 0. */
function sizedElement(width = 600, height = 300): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
  document.body.appendChild(el);
  return el;
}

async function chartOf(el: HTMLElement) {
  await waitFor(() => expect(el.querySelector('[_echarts_instance_]')).not.toBeNull());
  const chart = getInstanceByDom(el.querySelector('[_echarts_instance_]') as HTMLElement);
  await waitFor(() => expect(chart?.getOption()?.series).toBeDefined());
  return chart!;
}

type Series = Array<{ type: string; data?: unknown[]; name?: string }>;

describe('render', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // contract-rule: spec.10
  it('draws smoke-timeseries with the cartesian panel and the frames of the spec', async () => {
    const el = sizedElement();
    const handle = render(el, fixtureSpec('smoke-timeseries'));
    const series = (await chartOf(el)).getOption().series as Series;
    expect(series.length).toBeGreaterThan(0);
    expect(series.every((item) => item.type === 'line')).toBe(true);
    act(() => handle.destroy());
    expect(el.querySelector('[_echarts_instance_]')).toBeNull();
  });

  it('draws smoke-nodeGraph with the relations panel, after its system transformations', async () => {
    const el = sizedElement();
    render(el, fixtureSpec('smoke-nodeGraph'));
    const series = (await chartOf(el)).getOption().series as Series;
    const graph = series.find((item) => item.type === 'graph');
    expect(graph?.data).toHaveLength(3);
  });

  // contract-rule: renderer.10
  it('sets the height of an element with no height to defaultHeightPx', () => {
    const el = withLayout(document.createElement('div'));
    document.body.appendChild(el);
    const handle = render(el, fixtureSpec('smoke-timeseries'));
    expect(el.style.height).toBe('400px');
    act(() => handle.destroy());
    expect(el.style.height).toBe('');
  });

  it('gives back the inline height of the element on destroy', () => {
    const el = withLayout(document.createElement('div'));
    el.style.height = '0px';
    document.body.appendChild(el);
    const handle = render(el, fixtureSpec('smoke-timeseries'));
    expect(el.style.height).toBe('400px');
    act(() => handle.destroy());
    expect(el.style.height).toBe('0px');
  });

  // contract-rule: renderer.3
  it('shows the error state for a spec that is not correct, and writes the error with the prefix', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const el = sizedElement();
    render(el, fixtureSpec('error-invalid-spec'));
    await waitFor(() => expect(el.getAttribute('data-viz-state')).toBe('error'));
    expect(el.getAttribute('data-viz-error')).toBe('invalid-spec');
    expect(error).toHaveBeenCalledWith('grafana-viz:', 'The viz spec is not correct: data is missing.');
    error.mockRestore();
  });

  // contract-rule: state.5
  it('shows render-error for a frame that matches the schema but cannot be read', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spec = fixtureSpec('smoke-timeseries') as { data: { results: { A: { frames: unknown[] } } } };
    spec.data.results.A.frames.push({ schema: { name: 'no fields' } });
    const el = sizedElement();
    render(el, spec);
    await waitFor(() =>
      expect([el.getAttribute('data-viz-state'), el.getAttribute('data-viz-error')]).toEqual(['error', 'render-error'])
    );
    expect(error).toHaveBeenCalledWith(
      'grafana-viz:',
      expect.objectContaining({ message: 'JSON needs a fields definition' })
    );
    error.mockRestore();
  });
});
