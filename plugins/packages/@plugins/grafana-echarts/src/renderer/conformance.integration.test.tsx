// The conformance test of the viz contract (`fixtures.10`): each fixture set draws, and its last `onState` value
// equals its `state.json`. It never looks at pixels.
import { type RenderHandle, type RenderState } from '@grafana/viz-contract/renderer-api';
import { act, waitFor } from '@testing-library/react';
import { getInstanceByDom } from 'lib/echarts/echarts';
import { getChart } from 'test/canvas';
import { fixtureSets, fixtureSpec, fixtureState } from 'test/rendererFixtures';
import { dispatch, tooltipText } from 'test/tooltipPointer';
import { render } from './index';

/**
 * The sets that do not give their `state.json` yet. Each one has the state that it gives now, so the test fails when
 * the cause is fixed, and then the set moves back to the normal list.
 * The multivariate panel reads each row as one axis, and the contract reads each number field as one axis.
 * Follow-up issue: https://github.com/grafana/dataViz/issues/148
 */
const KNOWN_MISMATCHES: Record<string, RenderState> = {
  'smoke-radar': {
    state: 'error',
    error: {
      code: 'panel-error',
      message: 'Radar needs 3 or more axes. Each row is one axis. Add rows to the query.',
    },
    notices: [],
  },
};

/** An element with an inline size: the jsdom shim of `jest-setup.js` reads `clientWidth` from the style. */
function sizedElement(): HTMLElement {
  const el = document.createElement('div');
  el.style.width = '600px';
  el.style.height = '300px';
  document.body.appendChild(el);
  return el;
}

/** The handles of a test. Each one is destroyed before the DOM is cleared, so React unmounts its portals first. */
const handles: RenderHandle[] = [];

/** Draws `spec` and waits for the first final state. */
async function draw(spec: unknown) {
  const el = sizedElement();
  const states: RenderState[] = [];
  handles.push(render(el, spec, { onState: (state) => states.push(state) }));
  await waitFor(() => expect(el.getAttribute('data-viz-state')).not.toBe('rendering'));
  return { el, states };
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => handles.splice(0).forEach((handle) => handle.destroy()));
  consoleError.mockRestore();
  document.body.innerHTML = '';
});

const sets = fixtureSets();

describe('the fixture sets of the contract', () => {
  // contract-rule: fixtures.10
  it.each(sets.filter((set) => !(set in KNOWN_MISMATCHES)))('%s gives the state of its state.json', async (set) => {
    const expected = fixtureState(set);
    const { el, states } = await draw(fixtureSpec(set));
    await waitFor(() => expect(states.at(-1)).toEqual(expected));
    expect(el.getAttribute('data-viz-state')).toBe(expected.state);
    expect(el.getAttribute('data-viz-error')).toBe(expected.error?.code ?? null);
  });

  it.each(Object.keys(KNOWN_MISMATCHES))('%s gives its known state, not its state.json', async (set) => {
    const { states } = await draw(fixtureSpec(set));
    await waitFor(() => expect(states.at(-1)).toEqual(KNOWN_MISMATCHES[set]));
    expect(KNOWN_MISMATCHES[set]).not.toEqual(fixtureState(set));
  });

  it('smoke-parallel draws one axis for each row, not one axis for each number field (known mismatch)', async () => {
    // The same cause as smoke-radar. The state is `ready`, so only the axis names show the mismatch.
    const { el } = await draw(fixtureSpec('smoke-parallel'));
    const chart = getInstanceByDom(el.querySelector<HTMLElement>('[_echarts_instance_]')!)!;
    const axes = chart.getOption().parallelAxis as Array<{ name: string }>;
    expect(axes.map((axis) => axis.name)).toEqual(['h0', 'h1', 'h2']);
  });
});

/** One series of each frame of a spec: its label value and the time and value of its middle point. */
function seriesPoints(spec: Record<string, unknown>): Array<{ text: string; point: [number, number] }> {
  type Frame = { schema: { fields: Array<{ labels?: Record<string, string> }> }; data: { values: number[][] } };
  const results = (spec.data as { results: Record<string, { frames: Frame[] }> }).results;
  return Object.values(results).flatMap((result) =>
    result.frames.map(({ schema, data }) => {
      const [times, values] = data.values;
      const middle = Math.floor(times.length / 2);
      const text = schema.fields.flatMap((field) => Object.values(field.labels ?? {})).join();
      return { text, point: [times[middle], values[middle]] as [number, number] };
    })
  );
}

/** The elements and the `on*` attributes in `root` that only markup in a label value can make. */
function markup(root: HTMLElement): string[] {
  return [...root.querySelectorAll('*')].flatMap((node) => [
    ...(node.matches('script, img, iframe, object, embed') ? [node.tagName.toLowerCase()] : []),
    ...[...node.attributes].filter((attribute) => attribute.name.startsWith('on')).map((attribute) => attribute.name),
  ]);
}

describe('hostile-label', () => {
  // No tag: `fixtures.4` names the set, and the Source owns that rule. The contract has no Renderer rule for it.
  it('shows the label values as text in the chart and the tooltip, and makes no element or script from them', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const spec = fixtureSpec('hostile-label');
    const { el, states } = await draw(spec);
    await waitFor(() => expect(states.at(-1)).toEqual(fixtureState('hostile-label')));
    const series = seriesPoints(spec);
    expect(series.length).toBeGreaterThan(0);
    for (const { text } of series) {
      expect(el.textContent).toContain(text);
    }
    expect(markup(el)).toEqual([]);

    // The tooltip is a portal on `document.body`, outside `el`. Series `i` is frame `i` of the spec.
    const chart = getChart(el).chart!;
    for (const [seriesIndex, { text, point }] of series.entries()) {
      const [x, y] = chart.convertToPixel({ seriesIndex }, point) as number[];
      await dispatch(chart, 'mousemove', x, y);
      expect(tooltipText()).toContain(text);
      expect(markup(document.body)).toEqual([]);
    }
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
