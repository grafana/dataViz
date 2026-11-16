import { render, waitFor } from '@testing-library/react';
import { getInstanceByDom } from 'lib/echarts/echarts';
import React, { type ReactNode, useLayoutEffect } from 'react';
import { fixtureSpec } from 'test/rendererFixtures';
import { type Prepared, prepare } from './prepare';
import { RendererView } from './RendererView';

const noop = () => {};

describe('RendererView', () => {
  // contract-rule: state.1
  it('gives the commit signal of a new spec in the effects, before the chart gets its option', async () => {
    const onCommit = jest.fn();
    /** The number of commit signals at the layout effects of each commit. */
    const signalsAtLayout: number[] = [];
    /** A parent of the view: its layout effect runs after each layout effect of the view, and before each effect. */
    const Probe = ({ children }: { children: ReactNode }) => {
      useLayoutEffect(() => {
        signalsAtLayout.push(onCommit.mock.calls.length);
      });
      return children;
    };
    const view = (prepared: Prepared) => (
      <Probe>
        <RendererView
          prepared={prepared}
          width={600}
          height={300}
          onViewShown={noop}
          onCommit={onCommit}
          onPanelError={noop}
          onRenderError={noop}
          onChartInit={noop}
        />
      </Probe>
    );

    const { container, rerender } = render(view(prepare(fixtureSpec('smoke-timeseries'))));
    await waitFor(() => expect(container.querySelector('[_echarts_instance_]')).not.toBeNull());
    const chart = getInstanceByDom(container.querySelector('[_echarts_instance_]') as HTMLElement)!;
    const setOption = jest.spyOn(chart, 'setOption');
    const signalsBefore = onCommit.mock.calls.length;

    const next = prepare(fixtureSpec('smoke-barchart'));
    rerender(view(next));

    // No signal at the layout effects: a late `finished` event can come between them and the effects.
    expect(signalsAtLayout.at(-1)).toBe(signalsBefore);
    expect(onCommit).toHaveBeenLastCalledWith(next);
    expect(setOption).toHaveBeenCalled();
    expect(onCommit.mock.invocationCallOrder.at(-1)).toBeLessThan(setOption.mock.invocationCallOrder[0]);
  });
});
