import { dateTime, type TimeRange } from '@grafana/data';
import { shiftTimeRange, toRefreshRequest, zoomOutTimeRange } from './timeRangeRequest';

const absolute = (from: number, to: number): TimeRange => ({
  from: dateTime(from),
  to: dateTime(to),
  raw: { from: dateTime(from), to: dateTime(to) },
});

describe('toRefreshRequest', () => {
  // contract-rule: refresh.3
  it('keeps a relative pick relative', () => {
    const range = { ...absolute(1000, 2000), raw: { from: 'now-6h', to: 'now' } };
    expect(toRefreshRequest(range)).toEqual({ cause: 'timeRange', from: 'now-6h', to: 'now' });
  });

  it('gives an absolute pick as epoch milliseconds', () => {
    expect(toRefreshRequest(absolute(1790349877294, 1790353477294))).toEqual({
      cause: 'timeRange',
      from: '1790349877294',
      to: '1790353477294',
    });
  });
});

describe('time picker moves', () => {
  it('moves by half the range, as Grafana does', () => {
    expect(toRefreshRequest(shiftTimeRange(absolute(1000, 3000), -1))).toMatchObject({ from: '0', to: '2000' });
    expect(toRefreshRequest(shiftTimeRange(absolute(1000, 3000), 1))).toMatchObject({ from: '2000', to: '4000' });
  });

  it('zooms out to double the range around its center', () => {
    expect(toRefreshRequest(zoomOutTimeRange(absolute(1000, 3000)))).toMatchObject({ from: '0', to: '4000' });
  });
});
