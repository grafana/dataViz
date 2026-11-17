import { createTheme, FieldType, ReducerID, toDataFrame } from '@grafana/data';
import { applyGrafanaFieldDefaults } from 'test/panel';
import { applyPercentUnitRange, resolveFieldDisplays } from './fieldDisplays';

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
