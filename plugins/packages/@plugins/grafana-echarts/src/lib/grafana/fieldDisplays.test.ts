import {
  createTheme,
  type DataFrame,
  type FieldConfig,
  FieldType,
  getDisplayProcessor,
  ReducerID,
  toDataFrame,
} from '@grafana/data';
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
    // Core uses `last` for an empty list, which gives no value for this field.
    const data = () => frames({ cpu: [10, 40, null] });
    expect(resolve(data(), { calcs: [] })[0].display.numeric).toBe(40);
    expect(resolve(data(), { calcs: [ReducerID.last] })[0].display.numeric).toBeNaN();
  });

  it('gives one value with no number for a number field with no row', () => {
    // A query that returns no row has this shape. The result is not empty, so a caller must test the value.
    const [display, ...rest] = resolve(frames({ cpu: [] }));
    expect(rest).toEqual([]);
    expect(display.display.text).toBe('');
    expect(display.display.numeric).toBeNaN();
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

  it('gives the text of the `noValue` option for a number field with no row', () => {
    // Grafana copies the option to the config of each field. The test registry does not have the option.
    const noRows = applyGrafanaFieldDefaults([
      toDataFrame({ fields: [{ name: 'cpu', type: FieldType.number, values: [], config: { noValue: 'N/A' } }] }),
    ]);
    expect(resolveWith({ frames: noRows }).display.text).toBe('N/A');
  });

  it('removes the placeholder of a `noValue` option too', () => {
    const noNumbers = frames({ host: ['a', 'b'] });
    const withNoValue = { defaults: { noValue: 'N/A' }, overrides: [] };
    expect(resolveWith({ frames: noNumbers, fieldConfig: withNoValue })).toBeUndefined();
  });
});

/**
 * One frame with one number field. The field has a display processor with the time zone, as the fields that
 * Grafana gives a panel.
 */
const numberFrame = (values: number[], config: FieldConfig = {}, timeZone?: string) => {
  const frame = toDataFrame({ fields: [{ name: 'load', type: FieldType.number, values, config }] });
  frame.fields[0].display = getDisplayProcessor({ field: frame.fields[0], theme, timeZone });
  return frame;
};

describe('withFieldRange', () => {
  it('gives a copy with the range and its delta', () => {
    const input = numberFrame([45, 55]).fields[0];
    const processor = input.display;
    const ranged = withFieldRange(input, { min: 20, max: 80 }, theme, undefined);
    expect(ranged.state?.range).toEqual({ min: 20, max: 80, delta: 60 });
    expect(ranged).not.toBe(input);
    expect(input.state?.range).toBeUndefined();
    expect(input.display).toBe(processor);
  });

  it('gives the copy a display processor that reads the new range', () => {
    const input = numberFrame([45, 55]).fields[0];
    // In the range of the data, 45 to 55, the value 50 is at 50%.
    expect(input.display?.(50).percent).toBeCloseTo(0.5, 9);
    expect(withFieldRange(input, { min: 0, max: 200 }, theme, undefined).display?.(50).percent).toBeCloseTo(0.25, 9);
  });

  it('keeps the time zone of the dashboard for a value with a date unit', () => {
    // 2023-11-14 22:13:20 in UTC, which is the time zone of the tests.
    const frame = numberFrame([1700000000000], { unit: 'dateTimeAsIso' }, 'Asia/Tokyo');
    const ranged = {
      ...frame,
      fields: frame.fields.map((field) => withFieldRange(field, { min: 0, max: 1 }, theme, 'Asia/Tokyo')),
    };
    const text = (data: DataFrame[]) =>
      resolveFieldDisplays({
        frames: data,
        fieldConfig,
        reduceOptions: undefined,
        defaultCalc: ReducerID.lastNotNull,
        replaceVariables,
        theme,
        timeZone: 'Asia/Tokyo',
      })[0].display.text;
    expect(text([frame])).toBe('2023-11-15 07:13:20');
    expect(text([ranged])).toBe('2023-11-15 07:13:20');
  });

  it('keeps the other state of the field', () => {
    const input = { ...numberFrame([45, 55]).fields[0], state: { displayName: 'Load' } };
    expect(withFieldRange(input, { min: 0, max: 1 }, theme, undefined).state?.displayName).toBe('Load');
  });
});

describe('applyPercentUnitRange', () => {
  const percentFrame = (unit: string, config: FieldConfig = {}) => [numberFrame([45, 55], { unit, ...config })];

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
    const processor = percentInput[0].fields[0].display;
    expect(applyPercentUnitRange(input, theme)[0].fields[0]).toBe(input[0].fields[0]);
    applyPercentUnitRange(percentInput, theme);
    expect(percentInput[0].fields[0].state?.range).toBeUndefined();
    expect(percentInput[0].fields[0].display).toBe(processor);
  });

  it('makes the value of a percent field fill its part of 0 to 100', () => {
    const [display] = resolve(applyPercentUnitRange(percentFrame('percent'), theme));
    expect(display.field.min).toBe(0);
    expect(display.field.max).toBe(100);
    // Without the range of the unit, the last value is at 100% of the range of the data.
    expect(display.display.percent).toBeCloseTo(0.55, 9);
  });
});
