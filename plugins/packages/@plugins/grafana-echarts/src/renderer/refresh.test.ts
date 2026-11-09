import { RefreshController, type RefreshStatus } from './refresh';
import { REFRESH_TIMEOUT_MS } from './registry';

function controller(onRefresh = jest.fn()) {
  const statuses: RefreshStatus[] = [];
  const refresh = new RefreshController(onRefresh, (status) => statuses.push(status));
  return { refresh, onRefresh, statuses, last: () => refresh.current };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('RefreshController', () => {
  // contract-rule: refresh.4
  it('is busy after a request, and a request while busy does nothing', () => {
    const { refresh, onRefresh, last } = controller();
    refresh.request({ cause: 'refresh' });
    expect(onRefresh).toHaveBeenCalledWith({ cause: 'refresh' });
    expect(last()).toEqual({ busy: true });
    refresh.request({ cause: 'timeRange', from: 'now-6h', to: 'now' });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  // contract-rule: refresh.5
  it('ends the busy state with each result', () => {
    const { refresh, last } = controller();
    refresh.request({ cause: 'refresh' });
    refresh.setRefreshed(true);
    expect(last()).toEqual({ busy: false, message: undefined });

    refresh.request({ cause: 'refresh' });
    refresh.setRefreshed(false, 'bad_data: parse error');
    expect(last()).toEqual({ busy: false, message: 'Refresh failed: bad_data: parse error' });

    refresh.request({ cause: 'refresh' });
    refresh.setRefreshed(false);
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
    const { refresh, statuses } = controller();
    refresh.setRefreshed(false, 'early');
    expect(statuses).toEqual([]);

    refresh.request({ cause: 'refresh' });
    refresh.setRefreshed(true);
    refresh.setRefreshed(false, 'second');
    expect(refresh.current.message).toBeUndefined();

    refresh.request({ cause: 'refresh' });
    jest.advanceTimersByTime(REFRESH_TIMEOUT_MS);
    refresh.setRefreshed(true);
    expect(refresh.current.message).toBe('Refresh failed: no result in time.');
  });

  // contract-rule: refresh.7
  it('ends the busy state when onRefresh throws, and writes the error to the console', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const thrown = new Error('host gone');
    const { refresh, last } = controller(
      jest.fn(() => {
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

  it('stops the timer on dispose', () => {
    const { refresh, statuses } = controller();
    refresh.request({ cause: 'refresh' });
    refresh.dispose();
    jest.advanceTimersByTime(REFRESH_TIMEOUT_MS);
    expect(statuses).toEqual([{ busy: true }]);
  });
});
