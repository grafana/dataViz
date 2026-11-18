// The Add annotation UI of the Renderer on a drawn chart (`renderer.49` to `renderer.67`). The pointer goes through
// the real pipeline of zrender (see `test/tooltipPointer.tsx`). `annotate.test.ts` has the rules of the form state.
import { type AnnotateRequest, type RenderHandle, type RenderOptions } from '@grafana/viz-contract/renderer-api';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { type EChartsType } from 'echarts';
import { ANNOTATION_EDITOR_ATTR } from 'lib/components/annotations/AnnotationForm';
import { TOOLTIP_OFFSET } from 'lib/components/tooltip/constants';
import { ANNOTATION_SERIES_ID } from 'lib/echarts/options/annotations';
import { getChart } from 'test/canvas';
import { fixtureSpec } from 'test/rendererFixtures';
import { clickAt, dispatch, type Modifiers, tooltipText } from 'test/tooltipPointer';
import { render } from './index';
import { ANNOTATE_TIMEOUT_MS } from './registry';

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

/** Draws `spec` and waits for the first final state. `onAnnotate: false` gives the App no `onAnnotate`. */
async function draw(
  spec: unknown,
  { onAnnotate = true, ...options }: Omit<RenderOptions, 'onAnnotate'> & { onAnnotate?: boolean } = {}
) {
  const el = sizedElement();
  const requests: AnnotateRequest[] = [];
  const handle = render(el, spec, {
    ...options,
    ...(onAnnotate ? { onAnnotate: (request) => requests.push(request) } : {}),
  });
  handles.push(handle);
  await waitFor(() => expect(el.getAttribute('data-viz-state')).not.toBe('rendering'));
  return { el, handle, requests, chart: getChart(el).chart! };
}

const SET = 'prometheus-line';
type Range = { from: number; to: number };
const rangeOf = (spec: Record<string, unknown>) => (spec.data as { range: Range }).range;

/** The canvas pixel of the middle point of the first series of `prometheus-line`, where a hover shows the tooltip. */
function pointPixel(chart: EChartsType): [number, number] {
  type Frame = { data: { values: number[][] } };
  const { results } = fixtureSpec(SET).data as { results: Record<string, { frames: Frame[] }> };
  const [times, values] = results.A.frames[0].data.values;
  const middle = Math.floor(times.length / 2);
  const [x, y] = chart.convertToPixel({ seriesIndex: 0 }, [times[middle], values[middle]]);
  return [x, y];
}

/** The time at a canvas x, as a save of the form gives it. */
const timeAt = (chart: EChartsType, x: number): number => Math.round(chart.convertFromPixel({ xAxisIndex: 0 }, x));

/** Press, move and release, as a brush drag. */
const drag = async (chart: EChartsType, fromX: number, toX: number, y: number, modifiers: Modifiers = {}) => {
  await dispatch(chart, 'mousemove', fromX, y, modifiers);
  await dispatch(chart, 'mousedown', fromX, y, modifiers);
  await dispatch(chart, 'mousemove', (fromX + toX) / 2, y, modifiers);
  await dispatch(chart, 'mousemove', toX, y, modifiers);
  await dispatch(chart, 'mouseup', toX, y, modifiers);
};

const pin = async (chart: EChartsType, x: number, y: number) => {
  await dispatch(chart, 'mousemove', x, y);
  await clickAt(chart, x, y);
};

const CTRL = { ctrlKey: true };
const formEl = (): HTMLElement | null => document.querySelector<HTMLElement>(`[${ANNOTATION_EDITOR_ATTR}]`);
const textField = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
const button = (name: string) => screen.getByRole('button', { name });
const addButton = () => screen.queryByRole('button', { name: 'Add annotation' });
const setText = (text: string) => fireEvent.change(textField(), { target: { value: text } });
const addTag = (tag: string) => {
  const input = screen.getByPlaceholderText('Add tags');
  fireEvent.change(input, { target: { value: tag } });
  fireEvent.keyDown(input, { key: 'Enter' });
};
const save = () => act(() => fireEvent.click(button('Save')));

/** The times of the annotation lines and bands that the chart draws. */
function marks(chart: EChartsType) {
  type Mark = { xAxis: number };
  type Series = { id?: string; markLine?: { data: Mark[] }; markArea?: { data: Array<[Mark, Mark]> } };
  const series = (chart.getOption().series as Series[]).find((item) => item.id === ANNOTATION_SERIES_ID);
  return {
    lines: (series?.markLine?.data ?? []).map((line) => line.xAxis),
    bands: (series?.markArea?.data ?? []).map(([start, end]) => [start.xAxis, end.xAxis]),
  };
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => handles.splice(0).forEach((handle) => handle.destroy()));
  jest.useRealTimers();
  consoleError.mockRestore();
  document.body.innerHTML = '';
});

describe('who gets the Add annotation UI', () => {
  // contract-rule: renderer.49
  it('shows no button and opens no form with no onAnnotate', async () => {
    const { chart } = await draw(fixtureSpec(SET), { onAnnotate: false });
    const [x, y] = pointPixel(chart);
    await pin(chart, x, y);
    expect(tooltipText()).not.toBe('');
    expect(addButton()).toBeNull();
    await clickAt(chart, x, y, CTRL);
    await drag(chart, x, x + 60, y, CTRL);
    expect(formEl()).toBeNull();
  });

  // contract-rule: renderer.49
  it('shows no button and opens no form on a chart with no time axis', async () => {
    const { chart } = await draw(fixtureSpec('smoke-histogram'));
    const y = chart.getHeight() / 2;
    // Not each x has a bar: hover across the plot until a tooltip shows, then pin it.
    for (let x = 60; x < chart.getWidth() && tooltipText() === ''; x += 20) {
      await dispatch(chart, 'mousemove', x, y);
      if (tooltipText() !== '') {
        await clickAt(chart, x, y);
      }
    }
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(addButton()).toBeNull();
    await clickAt(chart, chart.getWidth() / 2, y, CTRL);
    expect(formEl()).toBeNull();
  });

  // A difference from `renderer.49` (docs/renderer.md, Differences from the contract). This test fails when the
  // stream chart gets the Add annotation UI.
  it('opens no form on a streamgraph, which has a time axis but no time brush', async () => {
    const { chart } = await draw(fixtureSpec('smoke-streamgraph'));
    await clickAt(chart, chart.getWidth() / 2, chart.getHeight() / 2, CTRL);
    expect(formEl()).toBeNull();
  });

  // contract-rule: renderer.66
  it('shows the button in the pinned tooltip, and a click closes the tooltip and opens the form at its time', async () => {
    const { chart, requests } = await draw(fixtureSpec(SET));
    const [x, y] = pointPixel(chart);
    await dispatch(chart, 'mousemove', x, y);
    expect(addButton()).toBeNull();
    await clickAt(chart, x, y);
    await act(async () => fireEvent.click(addButton()!));
    expect(formEl()).not.toBeNull();
    // The hide of the tooltip renders on the next animation frame.
    await waitFor(() => expect(tooltipText()).toBe(''));
    setText('Deploy');
    await save();
    expect(requests).toEqual([{ id: expect.any(String), time: timeAt(chart, x), text: 'Deploy', tags: [] }]);
  });
});

describe('the Ctrl and Cmd gestures', () => {
  // contract-rule: renderer.50
  it.each<[string, Modifiers]>([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
  ])('%s + click opens the form at the time of the click', async (_name, modifiers) => {
    const { chart, requests } = await draw(fixtureSpec(SET));
    const [x, y] = pointPixel(chart);
    await clickAt(chart, x - 7, y, modifiers);
    const form = within(formEl()!);
    expect(form.getByRole('textbox', { name: 'Description' })).toBeInTheDocument();
    expect(form.getByPlaceholderText('Add tags')).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    setText('Restart');
    addTag('ops');
    await save();
    expect(requests).toEqual([{ id: expect.any(String), time: timeAt(chart, x - 7), text: 'Restart', tags: ['ops'] }]);
  });

  // contract-rule: renderer.50
  it('Ctrl + drag opens the form for the time range of the drag', async () => {
    const { chart, requests } = await draw(fixtureSpec(SET));
    const [x, y] = pointPixel(chart);
    await drag(chart, x, x + 60, y, CTRL);
    expect(formEl()).not.toBeNull();
    setText('Incident');
    await save();
    expect(requests).toEqual([
      { id: expect.any(String), time: timeAt(chart, x), timeEnd: timeAt(chart, x + 60), text: 'Incident', tags: [] },
    ]);
  });

  // contract-rule: renderer.51
  it('opens no form for a click or a drag with no Ctrl and no Cmd: the click pins the tooltip', async () => {
    const { chart } = await draw(fixtureSpec(SET));
    const [x, y] = pointPixel(chart);
    await drag(chart, x, x + 60, y);
    expect(formEl()).toBeNull();
    await pin(chart, x, y);
    expect(formEl()).toBeNull();
    expect(addButton()).not.toBeNull();
  });
});

describe('the form on screen', () => {
  // contract-rule: renderer.52
  it('moves to a new point with its text, and a click out of it does not close it', async () => {
    const { chart, requests } = await draw(fixtureSpec(SET));
    const [x, y] = pointPixel(chart);
    await clickAt(chart, x, y, CTRL);
    setText('Deploy');
    // A click with no Ctrl pins the tooltip. Its Add annotation button also moves the form.
    await pin(chart, x + 40, y);
    expect(textField().value).toBe('Deploy');
    await act(async () => fireEvent.click(addButton()!));
    expect(document.querySelectorAll(`[${ANNOTATION_EDITOR_ATTR}]`)).toHaveLength(1);
    await clickAt(chart, x + 80, y, CTRL);
    expect(textField().value).toBe('Deploy');
    await save();
    expect(requests.map((request) => request.time)).toEqual([timeAt(chart, x + 80)]);

    // The busy form does not move.
    await clickAt(chart, x, y, CTRL);
    act(() => handles[0].setAnnotated(requests[0].id, false));
    await save();
    expect(requests.map((request) => request.time)).toEqual([timeAt(chart, x + 80), timeAt(chart, x + 80)]);
  });

  // contract-rule: renderer.53
  // contract-rule: renderer.55
  it('closes on Cancel and on Escape, but not while it is busy', async () => {
    const { el, chart, handle, requests } = await draw(fixtureSpec(SET));
    const [x, y] = pointPixel(chart);
    await clickAt(chart, x, y, CTRL);
    fireEvent.click(button('Cancel'));
    expect(formEl()).toBeNull();
    await clickAt(chart, x, y, CTRL);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(formEl()).toBeNull();
    expect(requests).toEqual([]);

    await clickAt(chart, x, y, CTRL);
    setText('Deploy');
    await save();
    expect(button('Saving')).toBeDisabled();
    expect(button('Cancel')).toBeDisabled();
    fireEvent.click(button('Saving'));
    fireEvent.click(button('Cancel'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(textField().value).toBe('Deploy');
    expect(requests).toHaveLength(1);
    // The chart stays.
    expect(getChart(el).chart).toBe(chart);
    act(() => handle.setAnnotated(requests[0].id, false));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(formEl()).toBeNull();
  });

  // contract-rule: renderer.56
  // contract-rule: renderer.60
  it('shows the message of a failed save and of the timeout, and closes after a save that the App confirms', async () => {
    const { chart, handle, requests } = await draw(fixtureSpec(SET));
    const [x, y] = pointPixel(chart);
    await clickAt(chart, x, y, CTRL);
    setText('Deploy');
    addTag('release');
    await save();
    act(() => handle.setAnnotated(requests[0].id, false, 'Permission denied'));
    expect(screen.getByRole('alert')).toHaveTextContent('Annotation not saved: Permission denied');
    expect(textField().value).toBe('Deploy');
    expect(within(formEl()!).getByText('release')).toBeInTheDocument();

    jest.useFakeTimers();
    await save();
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS));
    jest.useRealTimers();
    expect(screen.getByRole('alert')).toHaveTextContent(/^No answer in time\./);
    expect(textField().value).toBe('Deploy');

    await save();
    expect(marks(chart).lines).toEqual([]);
    act(() => handle.setAnnotated(requests[2].id, true));
    expect(formEl()).toBeNull();
    await waitFor(() => expect(marks(chart).lines).toEqual([timeAt(chart, x)]));
  });
});

describe('update and destroy', () => {
  /** `prometheus-line` with a time range that starts `ms` later. */
  const shifted = (ms: number) => {
    const spec = fixtureSpec(SET);
    rangeOf(spec).from += ms;
    rangeOf(spec).to += ms;
    return spec;
  };

  // contract-rule: renderer.61
  it('keeps the form, its text, its tags, its busy state and its message after update', async () => {
    const { el, chart, handle, requests } = await draw(fixtureSpec(SET));
    const [x, y] = pointPixel(chart);
    await clickAt(chart, x, y, CTRL);
    setText('Deploy');
    addTag('release');
    await save();
    act(() => handle.update(fixtureSpec(SET)));
    await waitFor(() => expect(el.getAttribute('data-viz-state')).toBe('ready'));
    expect(button('Saving')).toBeDisabled();
    expect(textField().value).toBe('Deploy');

    // The result of the save before the update still applies.
    act(() => handle.setAnnotated(requests[0].id, false, 'boom'));
    act(() => handle.update(fixtureSpec(SET)));
    expect(screen.getByRole('alert')).toHaveTextContent('Annotation not saved: boom');
    expect(textField().value).toBe('Deploy');
    expect(within(formEl()!).getByText('release')).toBeInTheDocument();
  });

  // contract-rule: renderer.61
  it('keeps a form whose time is out of the new time range at the nearest edge of the plot area', async () => {
    const { el, chart, handle, requests } = await draw(fixtureSpec(SET));
    const [x, y] = pointPixel(chart);
    await clickAt(chart, x, y, CTRL);
    const time = timeAt(chart, x);
    setText('Deploy');
    // The form is beside the x of its time, as the tooltip is beside the cursor. jsdom gives the form no size.
    const formX = () => Number(/translateX\((.+?)px\)/.exec(formEl()!.style.transform)?.[1]) - TOOLTIP_OFFSET.x;
    expect(formX()).toBeCloseTo(x);

    // The time of the form is before the new range: the left edge. Then after the new range: the right edge.
    const later = shifted(rangeOf(fixtureSpec(SET)).to - time);
    act(() => handle.update(later));
    await waitFor(() => expect(el.getAttribute('data-viz-state')).toBe('ready'));
    const left = chart.convertToPixel({ xAxisIndex: 0 }, rangeOf(later).from);
    await waitFor(() => expect(formX()).toBeCloseTo(left));
    const earlier = shifted(rangeOf(fixtureSpec(SET)).from - time - 60_000);
    act(() => handle.update(earlier));
    const right = chart.convertToPixel({ xAxisIndex: 0 }, rangeOf(earlier).to);
    await waitFor(() => expect(formX()).toBeCloseTo(right));
    expect(right).toBeGreaterThan(left + 100);

    await save();
    expect(requests).toEqual([{ id: expect.any(String), time, text: 'Deploy', tags: [] }]);
  });

  // contract-rule: renderer.61
  it.each(['smoke-histogram', 'smoke-piechart', 'no-data', 'error-invalid-spec'])(
    'closes the form after an update to %s, which has no time axis',
    async (set) => {
      const { el, chart, handle, requests } = await draw(fixtureSpec(SET));
      const [x, y] = pointPixel(chart);
      await clickAt(chart, x, y, CTRL);
      setText('Deploy');
      await save();
      act(() => handle.update(fixtureSpec(set)));
      await waitFor(() => expect(el.getAttribute('data-viz-state')).not.toBe('rendering'));
      expect(formEl()).toBeNull();
      // The save of the closed form can still complete.
      expect(() => act(() => handle.setAnnotated(requests[0].id, true))).not.toThrow();
      expect(formEl()).toBeNull();
    }
  );

  // contract-rule: renderer.62
  it('does nothing for setAnnotated after destroy', async () => {
    const { el, chart, handle, requests } = await draw(fixtureSpec(SET));
    const [x, y] = pointPixel(chart);
    await clickAt(chart, x, y, CTRL);
    setText('Deploy');
    await save();
    act(() => handle.destroy());
    expect(formEl()).toBeNull();
    act(() => {
      handle.setAnnotated(requests[0].id, true);
      handle.setAnnotated(requests[0].id, false, 'late');
    });
    expect(el.childElementCount).toBe(0);
    expect(formEl()).toBeNull();
    expect(consoleError.mock.calls.filter(([prefix]) => prefix === 'grafana-viz:')).toEqual([]);
  });
});

describe('the saved annotations', () => {
  /** `prometheus-line` with one annotation frame of the Source at `time`. */
  const withAnnotation = (time: number) => {
    const spec = fixtureSpec(SET);
    const { results } = spec.data as { results: Record<string, { frames: unknown[] }> };
    results.A.frames.push({
      schema: { meta: { dataTopic: 'annotations' }, fields: [{ name: 'time', type: 'time' }] },
      data: { values: [[time]] },
    });
    return spec;
  };

  // contract-rule: renderer.63
  it('draws them at each update with the annotations of the viz spec, and a new render starts with none', async () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const { el, chart, handle, requests } = await draw(fixtureSpec(SET));
    const [x, y] = pointPixel(chart);
    await clickAt(chart, x, y, CTRL);
    setText('Deploy');
    await save();
    act(() => handle.setAnnotated(requests[0].id, true));
    await drag(chart, x + 20, x + 80, y, CTRL);
    setText('Incident');
    await save();
    act(() => handle.setAnnotated(requests[1].id, true));
    const point = timeAt(chart, x);
    const band = [timeAt(chart, x + 20), timeAt(chart, x + 80)];
    await waitFor(() => expect(marks(chart)).toEqual({ lines: [point, ...band], bands: [band] }));

    // A refresh gives a new viz spec with an annotation of the Source.
    const sourceTime = rangeOf(fixtureSpec(SET)).from + 60_000;
    act(() => handle.update(withAnnotation(sourceTime)));
    await waitFor(() => expect(marks(chart)).toEqual({ lines: [sourceTime, point, ...band], bands: [band] }));
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();

    // A new `render` into the same element has no saved annotation.
    handles.push(render(el, fixtureSpec(SET), { onAnnotate: () => {} }));
    await waitFor(() => expect(el.getAttribute('data-viz-state')).toBe('ready'));
    expect(marks(getChart(el).chart!)).toEqual({ lines: [], bands: [] });
  });
});

describe('the form and a refresh', () => {
  // contract-rule: renderer.67
  it('keeps the busy state of the form and of a refresh independent', async () => {
    const onRefresh = jest.fn();
    const { el, chart, handle, requests } = await draw(fixtureSpec(SET), { onRefresh });
    const [x, y] = pointPixel(chart);
    const refresh = () => within(el).getByRole('button', { name: /refresh/i });

    // While the form is busy, Refresh works.
    await clickAt(chart, x, y, CTRL);
    setText('Deploy');
    await save();
    fireEvent.click(refresh());
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(button('Saving')).toBeDisabled();

    // While the chart is busy with the refresh, the user can open, move, save and close the form.
    act(() => handle.setAnnotated(requests[0].id, true));
    expect(formEl()).toBeNull();
    await clickAt(chart, x + 20, y, CTRL);
    await clickAt(chart, x + 40, y, CTRL);
    setText('Restart');
    await save();
    expect(requests.map((request) => request.time)).toEqual([timeAt(chart, x), timeAt(chart, x + 40)]);
    act(() => handle.setAnnotated(requests[1].id, false));
    fireEvent.click(button('Cancel'));
    expect(formEl()).toBeNull();
    expect(refresh()).toBeDisabled();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
