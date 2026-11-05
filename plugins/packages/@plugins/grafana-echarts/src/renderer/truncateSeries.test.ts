import { type DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { truncateSeries } from './truncateSeries';

const frame = (name: string, numbers: number) =>
  toDataFrame({
    name,
    fields: [
      { name: 'time', type: FieldType.time, values: [1] },
      ...Array.from({ length: numbers }, (_, i) => ({ name: `${name}-${i}`, type: FieldType.number, values: [i] })),
    ],
  });

const names = (series: DataFrame[]) => series.map((f) => f.fields.map((field) => field.name));

describe('truncateSeries', () => {
  // contract-rule: state.10
  it('keeps the first series in frame and field order, and counts the rest', () => {
    const { series, omitted } = truncateSeries([frame('a', 2), frame('b', 2), frame('c', 1)], 3);
    expect(omitted).toBe(2);
    expect(names(series)).toEqual([
      ['time', 'a-0', 'a-1'],
      ['time', 'b-0'],
    ]);
  });

  it('gives the same frames when there are not more series than the limit', () => {
    const frames = [frame('a', 2), frame('b', 1)];
    const result = truncateSeries(frames, 3);
    expect(result).toEqual({ series: frames, omitted: 0 });
    expect(result.series).toBe(frames);
  });

  it('keeps a frame with no number field', () => {
    const text = toDataFrame({ fields: [{ name: 's', type: FieldType.string, values: ['x'] }] });
    expect(names(truncateSeries([frame('a', 2), text], 1).series)).toEqual([['time', 'a-0'], ['s']]);
  });
});
