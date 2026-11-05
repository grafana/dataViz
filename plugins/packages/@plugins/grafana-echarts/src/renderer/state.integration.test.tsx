import { FieldType } from '@grafana/data';
import { act, screen, waitFor } from '@testing-library/react';
import { getInstanceByDom } from 'lib/echarts/echarts';
import { fixtureSpec, fixtureState } from 'test/rendererFixtures';
import { type RenderState } from './contract/renderer-api';
import { render } from './index';

/** An element with a size: jsdom has no layout, so `clientWidth` and `clientHeight` are 0. */
function sizedElement(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: 300 });
  document.body.appendChild(el);
  return el;
}

/** Renders `spec` and waits for the first final state. */
async function draw(spec: unknown) {
  const el = sizedElement();
  const states: RenderState[] = [];
  const handle = render(el, spec, { onState: (state) => states.push(state) });
  await waitFor(() => expect(el.getAttribute('data-viz-state')).not.toBe('rendering'));
  return { el, states, handle };
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
  document.body.innerHTML = '';
});

describe('the state of a draw', () => {
  // contract-rule: fixtures.10
  // contract-rule: state.3
  // contract-rule: state.4
  it.each([
    'error-invalid-spec',
    'error-unsupported-spec-version',
    'error-unsupported-panel-type',
    'error-all-queries-failed',
    'no-data',
    'partial-error',
  ])('%s gives the state of its state.json', async (set) => {
    const expected = fixtureState(set);
    const { el, states } = await draw(fixtureSpec(set));
    await waitFor(() => expect(states.at(-1)).toEqual(expected));
    expect(states).toHaveLength(1);
    expect(el.getAttribute('data-viz-state')).toBe(expected.state);
    expect(el.getAttribute('data-viz-error')).toBe(expected.error?.code ?? null);
  });

  it('shows the error message in place of the chart, one line for each failed query', async () => {
    await draw(fixtureSpec('error-all-queries-failed'));
    const alert = screen.getByRole('alert');
    expect(alert.children).toHaveLength(2);
    expect(alert.textContent).toContain('Query B failed: context deadline exceeded');
  });

  it('shows No data for frames with no rows', async () => {
    await draw(fixtureSpec('no-data'));
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  // contract-rule: state.5
  it('gives panel-error when the panel shows its own error view, with the notices', async () => {
    const spec = fixtureSpec('smoke-timeseries');
    (spec.panel as Record<string, unknown>).fieldConfig = { defaults: { unit: 'foo' } };
    (spec.data as { results: unknown }).results = {
      A: {
        status: 200,
        frames: [
          {
            schema: {
              fields: [
                { name: 'time', type: FieldType.time },
                { name: 'v', type: FieldType.number },
                { name: 'v', type: FieldType.number },
              ],
            },
            data: {
              values: [
                [1, 2],
                [1, 2],
                [3, 4],
              ],
            },
          },
        ],
      },
    };
    const { states } = await draw(spec);
    const message = 'Two fields have the name v. Rename one with Organize fields.';
    expect(states.at(-1)).toEqual({
      state: 'error',
      error: { code: 'panel-error', message },
      notices: [{ code: 'unit-unknown', message: 'Unit foo is not a Grafana unit. The values show with no unit.' }],
    });
    expect(screen.getByRole('alert').textContent).toBe(message);
  });

  // contract-rule: state.12
  it('does not call onState again for a second draw with the same state', async () => {
    const { el, states } = await draw(fixtureSpec('smoke-timeseries'));
    expect(states).toEqual([{ state: 'ready', notices: [] }]);
    const chart = getInstanceByDom(el.querySelector('[_echarts_instance_]') as HTMLElement)!;
    let finished = 0;
    chart.on('finished', () => {
      finished++;
    });
    act(() => chart.resize({ width: 500, height: 250 }));
    await waitFor(() => expect(finished).toBeGreaterThan(0));
    expect(states).toHaveLength(1);
  });

  // contract-rule: state.13
  it('keeps the state when onState throws, and writes the error to the console', async () => {
    const el = sizedElement();
    const thrown = new Error('app bug');
    render(el, fixtureSpec('smoke-timeseries'), {
      onState: () => {
        throw thrown;
      },
    });
    await waitFor(() => expect(el.getAttribute('data-viz-state')).toBe('ready'));
    expect(consoleError).toHaveBeenCalledWith('grafana-viz:', thrown);
  });

  // contract-rule: renderer.5
  it('removes the attributes on destroy', async () => {
    const { el, handle } = await draw(fixtureSpec('smoke-timeseries'));
    act(() => handle.destroy());
    expect(el.hasAttribute('data-viz-state')).toBe(false);
  });
});
