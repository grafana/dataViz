import { createTheme, FieldType, NullValueMode, toDataFrame } from '@grafana/data';
import { applyGlobalFieldRange, findNumericRange } from './range';

const theme = createTheme();

const frame = (fields: Record<string, { values: unknown[]; type?: FieldType; config?: object }>) =>
  toDataFrame({
    fields: Object.entries(fields).map(([name, { values, type = FieldType.number, config = {} }]) => ({
      name,
      type,
      values,
      config,
    })),
  });

describe('findNumericRange', () => {
  it('is the smallest and the largest number of all number fields of all frames', () => {
    const frames = [frame({ a: { values: [5, 20] } }), frame({ b: { values: [-3, 8] }, c: { values: [40, 1] } })];
    expect(findNumericRange(frames)).toEqual({ min: -3, max: 40 });
  });

  it('ignores fields that are not number fields, nulls and NaN', () => {
    const frames = [
      frame({
        time: { values: [1000, 2000], type: FieldType.time },
        name: { values: ['a', 'b'], type: FieldType.string },
        value: { values: [null, 7, NaN, 9] },
      }),
    ];
    expect(findNumericRange(frames)).toEqual({ min: 7, max: 9 });
  });

  it('reads a number that is text in a number field', () => {
    expect(findNumericRange([frame({ value: { values: ['200', '', 50] } })])).toEqual({ min: 50, max: 200 });
  });

  it('reads a null as zero when the field has the null-as-zero mode', () => {
    const frames = [frame({ value: { values: [5, null, 9], config: { nullValueMode: NullValueMode.AsZero } } })];
    expect(findNumericRange(frames)).toEqual({ min: 0, max: 9 });
  });

  it('is undefined when there is no number', () => {
    expect(findNumericRange([frame({ value: { values: [null] } })])).toBeUndefined();
    expect(findNumericRange([])).toBeUndefined();
  });
});

describe('applyGlobalFieldRange', () => {
  const frames = [frame({ a: { values: [5, 20] } }), frame({ b: { values: [-3, 8] } })];

  it('gives each number field the range of all number fields of the panel', () => {
    const ranged = applyGlobalFieldRange(frames, theme, undefined);
    expect(ranged.map((f) => f.fields[0].state?.range)).toEqual([
      { min: -3, max: 20, delta: 23 },
      { min: -3, max: 20, delta: 23 },
    ]);
  });

  it('uses the min and the max of the field config for the end that they give', () => {
    const [ranged] = applyGlobalFieldRange([frame({ a: { values: [5, 20], config: { min: 0 } } })], theme, undefined);
    expect(ranged.fields[0].state?.range).toEqual({ min: 0, max: 20, delta: 20 });
  });

  it('keeps the range that a field has', () => {
    const [input] = [frame({ a: { values: [5, 20] } })];
    input.fields[0].state = { range: { min: 1, max: 2, delta: 1 } };
    const [ranged] = applyGlobalFieldRange([input], theme, undefined);
    expect(ranged.fields[0]).toBe(input.fields[0]);
  });

  it('does not change fields that are not number fields, and does not change the input frames', () => {
    const input = [frame({ time: { values: [1000], type: FieldType.time }, a: { values: [5] } })];
    const [ranged] = applyGlobalFieldRange(input, theme, undefined);
    expect(ranged.fields[0]).toBe(input[0].fields[0]);
    expect(input[0].fields[1].state?.range).toBeUndefined();
  });

  it('gives no range when the panel has no number', () => {
    const input = [frame({ a: { values: [null] } })];
    expect(applyGlobalFieldRange(input, theme, undefined)[0].fields[0]).toBe(input[0].fields[0]);
  });

  it('keeps the time zone of the dashboard for a value with a date unit', () => {
    // 2023-11-14 22:13:20 in UTC, which is the time zone of the tests.
    const input = [frame({ a: { values: [1700000000000], config: { unit: 'dateTimeAsIso' } } })];
    const [ranged] = applyGlobalFieldRange(input, theme, 'Asia/Tokyo');
    expect(ranged.fields[0].display?.(1700000000000).text).toBe('2023-11-15 07:13:20');
  });
});
