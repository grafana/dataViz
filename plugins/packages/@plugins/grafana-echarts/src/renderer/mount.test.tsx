import { type ChartInitListener } from 'lib/components/chartInitContext';
import { type PanelErrorSignal } from 'lib/components/panelErrorContext';
import { act } from '@testing-library/react';
import { useEffect } from 'react';
import { fixtureSpec } from 'test/rendererFixtures';
import { mount } from './mount';

/** The props that `mount` gives to the view, so that a test can give the signals of a chart. */
let view: { onPanelError: PanelErrorSignal; onChartInit: ChartInitListener };

/** A view that gives a panel error signal of `null` when it unmounts, as `DataIssueView` does. */
jest.mock('./RendererView', () => ({
  RendererView: (props: typeof view) => {
    view = props;
    useEffect(() => () => props.onPanelError(null), [props]);
    return null;
  },
}));

describe('mount', () => {
  // contract-rule: renderer.5
  it('does not call onState on destroy after a chart drew and then got a panel error', () => {
    const onState = jest.fn();
    const el = document.createElement('div');
    let destroy = () => {};
    act(() => {
      destroy = mount(el, fixtureSpec('smoke-timeseries'), { onState });
    });
    const listeners: Array<() => void> = [];
    view.onChartInit({ on: (_event: string, listener: () => void) => listeners.push(listener) } as never);
    listeners.forEach((listener) => listener());
    view.onPanelError('Two fields have the name v.');
    expect(onState.mock.calls.map(([state]) => state.state)).toEqual(['ready', 'error']);

    act(() => destroy());
    expect(onState).toHaveBeenCalledTimes(2);
    expect(el.hasAttribute('data-viz-state')).toBe(false);
  });
});
