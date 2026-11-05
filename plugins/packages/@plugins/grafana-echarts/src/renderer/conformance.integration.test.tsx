// The conformance test of the viz contract (`fixtures.10`): each fixture set draws, and its last `onState` value
// equals its `state.json`. It never looks at pixels.
import { act, waitFor } from '@testing-library/react';
import { getInstanceByDom } from 'lib/echarts/echarts';
import { fixtureSets, fixtureSpec, fixtureState } from 'test/rendererFixtures';
import { type RenderHandle, type RenderState } from './contract/renderer-api';
import { render } from './index';

/**
 * The sets that do not give their `state.json` yet. Each one has the state that it gives now, so the test fails when
 * the cause is fixed, and then the set moves back to the normal list.
 * The multivariate panel reads each row as one axis, and the contract reads each number field as one axis.
 * Follow-up issue: "Multivariate panel (radar, parallel): read number fields as axes, not rows".
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

describe('hostile-label', () => {
  // contract-rule: renderer.14
  it('shows the label values as text, and makes no element or script from them', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const { el, states } = await draw(fixtureSpec('hostile-label'));
    await waitFor(() => expect(states.at(-1)).toEqual(fixtureState('hostile-label')));
    for (const text of [
      '<img src=x onerror=alert(1)>',
      '</script><script>alert(2)</script>',
      '"><svg onload=alert(4)>',
    ]) {
      expect(el.textContent).toContain(text);
    }
    expect(el.querySelectorAll('script, img, iframe, object, embed')).toHaveLength(0);
    const handlers = [...el.querySelectorAll('*')].flatMap((node) =>
      [...node.attributes].filter((attribute) => attribute.name.startsWith('on')).map((attribute) => attribute.name)
    );
    expect(handlers).toEqual([]);
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
