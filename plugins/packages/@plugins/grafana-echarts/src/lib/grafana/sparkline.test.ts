import { dateTime, type Field, type FieldSparkline, FieldType } from '@grafana/data';
import { getSparklineXRange, getSparklineYRange, layoutSparklineSegments } from './sparkline';

const numberField = (values: Array<number | null>, extra: Partial<Field> = {}): Field => ({
  name: 'value',
  type: FieldType.number,
  values,
  config: {},
  ...extra,
});
const timeField = (values: number[]): Field => ({ name: 'time', type: FieldType.time, values, config: {} });
const withRange = (min: number, max: number, config = {}) =>
  numberField([min, max], { config, state: { range: { min, max, delta: max - min } } });

describe('getSparklineXRange', () => {
  it('is the row index when the sparkline has no x field', () => {
    expect(getSparklineXRange({ y: numberField([1, 2, 3]) })).toEqual([0, 2]);
  });

  it('is the first and the last x value when there is no time range', () => {
    expect(getSparklineXRange({ y: numberField([1, 2]), x: timeField([1000, 5000]) })).toEqual([1000, 5000]);
  });

  it('is the time range of the panel for a time field', () => {
    const sparkline: FieldSparkline = {
      y: numberField([1, 2]),
      x: timeField([1000, 5000]),
      timeRange: { from: dateTime(0), to: dateTime(9000), raw: { from: 'now-9s', to: 'now' } },
    };
    expect(getSparklineXRange(sparkline)).toEqual([0, 9000]);
  });
});

describe('getSparklineYRange', () => {
  it('is the range of the field', () => {
    expect(getSparklineYRange({ y: withRange(10, 90) })).toEqual([10, 90]);
  });

  it('is undefined when the field has no range', () => {
    expect(getSparklineYRange({ y: numberField([1, 2]) })).toBeUndefined();
  });

  it('is made wider by the min and the max of the field config', () => {
    expect(getSparklineYRange({ y: withRange(10, 90, { min: 0, max: 100 }) })).toEqual([0, 100]);
    expect(getSparklineYRange({ y: withRange(10, 90, { min: 20, max: 80 }) })).toEqual([10, 90]);
  });

  it('includes a numeric No value option', () => {
    expect(getSparklineYRange({ y: withRange(10, 90, { noValue: '-5' }) })).toEqual([-5, 90]);
    expect(getSparklineYRange({ y: withRange(10, 90, { noValue: 'N/A' }) })).toEqual([10, 90]);
  });

  it.each([
    ['zero', 0, [0, 1]],
    ['a positive number', 4, [4, 8]],
    ['a negative number', -4, [-8, -4]],
  ])('is made wider when the two ends are %s', (_, value, expected) => {
    expect(getSparklineYRange({ y: withRange(value, value) })).toEqual(expected);
  });
});

describe('layoutSparklineSegments', () => {
  const rect = { x: 10, y: 20, width: 100, height: 50 };

  it('puts the minimum at the bottom and the maximum at the top of the rectangle', () => {
    const segments = layoutSparklineSegments({ y: [0, 10, 5], xRange: [0, 2], yRange: [0, 10], rect });
    expect(segments).toEqual([
      [
        [10, 70],
        [60, 20],
        [110, 45],
      ],
    ]);
  });

  it('uses the x values and the x range', () => {
    const [segment] = layoutSparklineSegments({ x: [25, 50], y: [0, 0], xRange: [0, 100], yRange: [0, 1], rect });
    expect(segment.map(([x]) => x)).toEqual([35, 60]);
  });

  it('starts a new segment after a value that is not a number', () => {
    const segments = layoutSparklineSegments({
      y: [1, 2, null, undefined, NaN, 3, 4],
      xRange: [0, 6],
      yRange: [0, 4],
      rect,
    });
    expect(segments.map((segment) => segment.length)).toEqual([2, 2]);
  });

  it('gives no segment for no numbers', () => {
    expect(layoutSparklineSegments({ y: [null, null], xRange: [0, 1], yRange: [0, 1], rect })).toEqual([]);
  });

  it('puts the points at the middle when a range has no length', () => {
    const [segment] = layoutSparklineSegments({ y: [5, 5], xRange: [3, 3], yRange: [5, 5], rect });
    expect(segment).toEqual([
      [60, 45],
      [60, 45],
    ]);
  });
});
