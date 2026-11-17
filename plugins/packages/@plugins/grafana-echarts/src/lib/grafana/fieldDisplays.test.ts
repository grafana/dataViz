import { createTheme, FieldType, ReducerID, toDataFrame } from '@grafana/data';
import { applyGrafanaFieldDefaults } from 'test/panel';
import { applyPercentUnitRange, resolveFieldDisplays, withFieldRange } from './fieldDisplays';

const theme = createTheme();
const fieldConfig = { defaults: {}, overrides: [] };
const replaceVariables = (value: string) => value;

const frames = (...frameFields: Array<Record<string, Array<number | string | null>>>) =>
  applyGrafanaFieldDefaults(
    frameFields.map((fields) =>
      toDataFrame({
        fields: Object.entries(fields).map(([name, values]) => ({
          name,
          type: typeof values[0] === 'string' ? FieldType.string : FieldType.number,
          values,
        })),
      })
    )
  );

const resolve = (
  data: ReturnType<typeof frames>,
  reduceOptions?: Parameters<typeof resolveFieldDisplays>[0]['reduceOptions']
) =>
  resolveFieldDisplays({
    frames: data,
    fieldConfig,
    reduceOptions,
    defaultCalc: ReducerID.lastNotNull,
    replaceVariables,
    theme,
  });

describe('resolveFieldDisplays', () => {
  it('gives one value for each number field, reduced with the default calculation', () => {
    const displays = resolve(frames({ cpu: [10, 40, 72], memory: [5, 35, null] }));
    expect(displays.map((display) => [display.display.title, display.display.numeric])).toEqual([
      ['cpu', 72],
      ['memory', 35],
    ]);
  });

  it('uses the calculation of the reduce options', () => {
    const displays = resolve(frames({ cpu: [10, 40, 70] }), { calcs: [ReducerID.mean] });
    expect(displays[0].display.numeric).toBe(40);
  });

  it('uses the default calculation when the list of calculations is empty', () => {
    const displays = resolve(frames({ cpu: [10, 40, 70] }), { calcs: [] });
    expect(displays[0].display.numeric).toBe(70);
  });

  it('gives one value for each row in the all-values mode, up to the limit', () => {
    const displays = resolve(frames({ host: ['a', 'b', 'c'], load: [1, 2, 3] }), { calcs: [], values: true, limit: 2 });
    expect(displays.map((display) => display.display.numeric)).toEqual([1, 2]);
  });

  it('reads all frames', () => {
    expect(resolve(frames({ a: [1] }, { b: [2] }))).toHaveLength(2);
  });

  it('gives no value when no field is a number field', () => {
    expect(resolve(frames({ host: ['a', 'b'] }))).toEqual([]);
  });
});

describe('resolveFieldDisplays options', () => {
  const timeSeries = () =>
    applyGrafanaFieldDefaults([
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
          { name: 'cpu', type: FieldType.number, values: [50, 60, 75] },
        ],
      }),
    ]);

  const resolveWith = (extra: Partial<Parameters<typeof resolveFieldDisplays>[0]>) =>
    resolveFieldDisplays({
      frames: timeSeries(),
      fieldConfig,
      reduceOptions: undefined,
      defaultCalc: ReducerID.lastNotNull,
      replaceVariables,
      theme,
      ...extra,
    })[0];

  it('gives no sparkline and no percent change when they are not requested', () => {
    const display = resolveWith({});
    expect(display.sparkline).toBeUndefined();
    expect(display.display.percentChange).toBeUndefined();
  });

  it('adds the values over time when the sparkline is requested', () => {
    const { sparkline } = resolveWith({ sparkline: true });
    expect(sparkline?.y.values).toEqual([50, 60, 75]);
    expect(sparkline?.x?.values).toEqual([1000, 2000, 3000]);
  });

  it('adds the change from the first value to the last value, in percent, when it is requested', () => {
    // From 50 to 75: the `diffperc` reducer of Grafana gives 50.
    expect(resolveWith({ percentChange: true }).display.percentChange).toBeCloseTo(50, 9);
  });

  it('removes the placeholder of a `noValue` option too', () => {
    const noNumbers = frames({ host: ['a', 'b'] });
    const withNoValue = { defaults: { noValue: 'N/A' }, overrides: [] };
    expect(resolveWith({ frames: noNumbers, fieldConfig: withNoValue })).toBeUndefined();
  });
});

describe('withFieldRange', () => {
  const field = () => toDataFrame({ fields: [{ name: 'load', type: FieldType.number, values: [45, 55] }] }).fields[0];

  it('gives a copy with the range and its delta', () => {
    const input = field();
    const ranged = withFieldRange(input, { min: 20, max: 80 }, theme);
    expect(ranged.state?.range).toEqual({ min: 20, max: 80, delta: 60 });
    expect(ranged).not.toBe(input);
    expect(input.state?.range).toBeUndefined();
  });

  it('gives the copy a display processor that reads the new range', () => {
    const ranged = withFieldRange(field(), { min: 0, max: 200 }, theme);
    expect(ranged.display?.(50).percent).toBeCloseTo(0.25, 9);
  });

  it('keeps the other state of the field', () => {
    const input = { ...field(), state: { displayName: 'Load' } };
    expect(withFieldRange(input, { min: 0, max: 1 }, theme).state?.displayName).toBe('Load');
  });
});

describe('applyPercentUnitRange', () => {
  const percentFrame = (unit: string, config = {}) => [
    toDataFrame({ fields: [{ name: 'load', type: FieldType.number, values: [45, 55], config: { unit, ...config } }] }),
  ];

  it('gives a percent field the range 0 to 100', () => {
    const [frame] = applyPercentUnitRange(percentFrame('percent'), theme);
    expect(frame.fields[0].state?.range).toEqual({ min: 0, max: 100, delta: 100 });
  });

  it('gives a percentunit field the range 0 to 1', () => {
    const [frame] = applyPercentUnitRange(percentFrame('percentunit'), theme);
    expect(frame.fields[0].state?.range).toEqual({ min: 0, max: 1, delta: 1 });
  });

  it('keeps a min and a max that the field has', () => {
    const [frame] = applyPercentUnitRange(percentFrame('percent', { min: 20, max: 80 }), theme);
    expect(frame.fields[0].state?.range).toEqual({ min: 20, max: 80, delta: 60 });
  });

  it('does not change a field with a different unit, and does not change the input frames', () => {
    const input = percentFrame('bytes');
    const percentInput = percentFrame('percent');
    expect(applyPercentUnitRange(input, theme)[0].fields[0]).toBe(input[0].fields[0]);
    applyPercentUnitRange(percentInput, theme);
    expect(percentInput[0].fields[0].state?.range).toBeUndefined();
  });

  it('makes the value of a percent field fill its part of 0 to 100', () => {
    const displays = resolve(applyPercentUnitRange(percentFrame('percent'), theme));
    expect(displays[0].field.min).toBe(0);
    expect(displays[0].field.max).toBe(100);
  });
});
