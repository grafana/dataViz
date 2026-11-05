import { screen, waitFor } from '@testing-library/react';
import { fixtureSpec } from 'test/rendererFixtures';
import { type RenderState } from './contract/renderer-api';
import { render } from './index';

// A panel that throws while it renders, as a bug of a chart module does.
jest.mock('lib/components/Panel', () => ({
  Panel: () => {
    throw new Error('raw panel failure');
  },
}));

describe('render-error', () => {
  // contract-rule: state.6
  it('shows the registry message with the panel name, and writes the raw message only to the console', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const el = document.createElement('div');
    document.body.appendChild(el);
    const states: RenderState[] = [];
    render(el, fixtureSpec('smoke-timeseries'), { onState: (state) => states.push(state) });

    const message = 'This data cannot be shown as a XY chart.';
    await waitFor(() =>
      expect(states.at(-1)).toEqual({ state: 'error', error: { code: 'render-error', message }, notices: [] })
    );
    expect(el.getAttribute('data-viz-error')).toBe('render-error');
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(document.body.textContent).not.toContain('raw panel failure');
    expect(consoleError).toHaveBeenCalledWith(
      'grafana-viz:',
      expect.objectContaining({ message: 'raw panel failure' })
    );
    consoleError.mockRestore();
  });
});
