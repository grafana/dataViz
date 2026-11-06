import { StateReporter } from './stateReporter';

const ready = { state: 'ready' as const, notices: [] };
const failed = { state: 'error' as const, error: { code: 'invalid-spec', message: 'm' }, notices: [] };
/** Runs the `onState` calls that the reporter queued as microtasks. */
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('StateReporter', () => {
  // contract-rule: state.1
  // contract-rule: state.2
  it('sets data-viz-state, and data-viz-error only for an error', () => {
    const el = document.createElement('div');
    const reporter = new StateReporter(el, undefined);
    reporter.rendering();
    expect(el.getAttribute('data-viz-state')).toBe('rendering');
    reporter.report(failed);
    expect([el.getAttribute('data-viz-state'), el.getAttribute('data-viz-error')]).toEqual(['error', 'invalid-spec']);
    reporter.report(ready);
    expect([el.getAttribute('data-viz-state'), el.getAttribute('data-viz-error')]).toEqual(['ready', null]);
    reporter.stop();
    expect(el.hasAttribute('data-viz-state')).toBe(false);
  });

  // contract-rule: renderer.5
  it('ignores each report after stop', async () => {
    const el = document.createElement('div');
    const onState = jest.fn();
    const reporter = new StateReporter(el, onState);
    reporter.stop();
    reporter.report(ready);
    await flush();
    expect(onState).not.toHaveBeenCalled();
    expect(el.hasAttribute('data-viz-state')).toBe(false);
  });

  // contract-rule: renderer.5
  it('sets the attributes at once, and does not call onState after a stop before the microtask', async () => {
    const el = document.createElement('div');
    const onState = jest.fn();
    const reporter = new StateReporter(el, onState);
    reporter.report(ready);
    expect(el.getAttribute('data-viz-state')).toBe('ready');
    expect(onState).not.toHaveBeenCalled();
    reporter.stop();
    await flush();
    expect(onState).not.toHaveBeenCalled();
  });

  // contract-rule: state.12
  it('calls onState for a final state and for each change, not for rendering or the same value', async () => {
    const onState = jest.fn();
    const reporter = new StateReporter(document.createElement('div'), onState);
    reporter.rendering();
    expect(onState).not.toHaveBeenCalled();
    reporter.report(ready);
    reporter.report({ state: 'ready', notices: [] });
    reporter.rendering();
    reporter.report(ready);
    await flush();
    expect(onState).toHaveBeenCalledTimes(1);
    reporter.report({ state: 'ready', notices: [{ code: 'unit-unknown', message: 'u' }] });
    reporter.report(failed);
    await flush();
    expect(onState.mock.calls.map(([state]) => state)).toEqual([
      ready,
      { state: 'ready', notices: [{ code: 'unit-unknown', message: 'u' }] },
      failed,
    ]);
  });

  // contract-rule: state.13
  it('writes a throwing onState to the console, and keeps the state', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const el = document.createElement('div');
    const thrown = new Error('app bug');
    new StateReporter(el, () => {
      throw thrown;
    }).report(failed);
    await flush();
    expect(error).toHaveBeenCalledWith('grafana-viz:', thrown);
    expect(el.getAttribute('data-viz-state')).toBe('error');
    error.mockRestore();
  });

  it('gives onState a copy', async () => {
    const states: unknown[] = [];
    const state = { state: 'ready' as const, notices: [{ code: 'c', message: 'm' }] };
    new StateReporter(document.createElement('div'), (value) => states.push(value)).report(state);
    await flush();
    expect(states[0]).toEqual(state);
    expect(states[0]).not.toBe(state);
  });
});
