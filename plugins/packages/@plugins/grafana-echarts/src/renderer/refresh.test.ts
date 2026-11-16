import { type RefreshRequest } from '@grafana/viz-contract/renderer-api';
import { RefreshController, type RefreshStatus } from './refresh';
import { REFRESH_TIMEOUT_MS } from './registry';

function controller(onRefresh = jest.fn<void, [RefreshRequest]>()) {
  const statuses: RefreshStatus[] = [];
  const refresh = new RefreshController(onRefresh, (status) => statuses.push(status));
  /** The `id` of the last `RefreshRequest`. */
  const lastId = () => onRefresh.mock.calls.at(-1)![0].id;
  return { refresh, onRefresh, statuses, lastId, last: () => refresh.current };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('RefreshController', () => {
  // contract-rule: refresh.4
  it('is busy after a request, and a request while busy does nothing', () => {
    const { refresh, onRefresh, last } = controller();
    refresh.request({ cause: 'refresh' });
    expect(onRefresh).toHaveBeenCalledWith({ id: expect.any(String), cause: 'refresh' });
    expect(last()).toEqual({ busy: true });
    refresh.request({ cause: 'timeRange', from: 'now-6h', to: 'now' });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  // contract-rule: refresh.13
  it('gives each request a new id', () => {
    const { refresh, onRefresh, lastId } = controller();
    for (let i = 0; i < 3; i++) {
      refresh.request({ cause: 'refresh' });
      refresh.setRefreshed(lastId(), true);
    }
    const ids = onRefresh.mock.calls.map(([request]) => request.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('gives ids that two controllers do not share, so a result for an old handle does nothing', () => {
    const first = controller();
    first.refresh.request({ cause: 'refresh' });
    const second = controller();
    second.refresh.request({ cause: 'refresh' });
    expect(second.lastId()).not.toBe(first.lastId());
    second.refresh.setRefreshed(first.lastId(), false, 'old handle');
    expect(second.last()).toEqual({ busy: true });
  });

  // contract-rule: refresh.5
  it('ends the busy state with each result', () => {
    const { refresh, last, lastId } = controller();
    refresh.request({ cause: 'refresh' });
    refresh.setRefreshed(lastId(), true);
    expect(last()).toEqual({ busy: false, message: undefined });

    refresh.request({ cause: 'refresh' });
    refresh.setRefreshed(lastId(), false, 'bad_data: parse error');
    expect(last()).toEqual({ busy: false, message: 'Refresh failed: bad_data: parse error' });

    refresh.request({ cause: 'refresh' });
    refresh.setRefreshed(lastId(), false);
    expect(last()).toEqual({ busy: false, message: 'Refresh failed.' });

    refresh.request({ cause: 'refresh' });
    refresh.updated();
    expect(last()).toEqual({ busy: false, message: undefined });
  });

  it('times out after refreshTimeoutMs', () => {
    const { refresh, last } = controller();
    refresh.request({ cause: 'refresh' });
    jest.advanceTimersByTime(REFRESH_TIMEOUT_MS - 1);
    expect(last().busy).toBe(true);
    jest.advanceTimersByTime(1);
    expect(last()).toEqual({ busy: false, message: 'Refresh failed: no result in time.' });
  });

  // contract-rule: refresh.6
  it('ignores a result before the first request, a second result, and a result after the timeout', () => {
    const { refresh, statuses, lastId } = controller();
    refresh.setRefreshed('1', false, 'early');
    expect(statuses).toEqual([]);

    refresh.request({ cause: 'refresh' });
    refresh.setRefreshed(lastId(), true);
    refresh.setRefreshed(lastId(), false, 'second');
    expect(refresh.current.message).toBeUndefined();

    refresh.request({ cause: 'refresh' });
    jest.advanceTimersByTime(REFRESH_TIMEOUT_MS);
    refresh.setRefreshed(lastId(), true);
    expect(refresh.current.message).toBe('Refresh failed: no result in time.');
  });

  // contract-rule: refresh.6
  it('ignores a result with the id of an older request', () => {
    const { refresh, last, lastId } = controller();
    refresh.request({ cause: 'refresh' });
    const old = lastId();
    jest.advanceTimersByTime(REFRESH_TIMEOUT_MS);
    refresh.request({ cause: 'refresh' });
    refresh.setRefreshed(old, false, 'old');
    expect(last()).toEqual({ busy: true });
    refresh.setRefreshed(lastId(), true);
    expect(last()).toEqual({ busy: false, message: undefined });
  });

  // contract-rule: refresh.7
  it('ends the busy state when onRefresh throws, and writes the error to the console', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const thrown = new Error('host gone');
    const { refresh, last } = controller(
      jest.fn<void, [RefreshRequest]>(() => {
        throw thrown;
      })
    );
    refresh.request({ cause: 'refresh' });
    expect(last()).toEqual({ busy: false, message: 'Refresh failed: host gone' });
    expect(consoleError).toHaveBeenCalledWith('grafana-viz:', thrown);
    jest.advanceTimersByTime(REFRESH_TIMEOUT_MS);
    expect(last().message).toBe('Refresh failed: host gone');
    consoleError.mockRestore();
  });

  // contract-rule: refresh.15
  it('removes each refresh message on update, also after the timeout', () => {
    const { refresh, last, lastId } = controller();
    refresh.request({ cause: 'refresh' });
    jest.advanceTimersByTime(REFRESH_TIMEOUT_MS);
    expect(last().message).toBe('Refresh failed: no result in time.');
    refresh.updated();
    expect(last()).toEqual({ busy: false, message: undefined });

    for (const error of ['bad_data', undefined]) {
      refresh.request({ cause: 'refresh' });
      refresh.setRefreshed(lastId(), false, error);
      expect(last().message).toBeDefined();
      refresh.updated();
      expect(last()).toEqual({ busy: false, message: undefined });
    }
  });

  it('stops the timer on dispose', () => {
    const { refresh, statuses } = controller();
    refresh.request({ cause: 'refresh' });
    refresh.dispose();
    jest.advanceTimersByTime(REFRESH_TIMEOUT_MS);
    expect(statuses).toEqual([{ busy: true }]);
  });
});
