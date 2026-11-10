import { createTheme, type FieldConfigSource, FieldType, toDataFrame } from '@grafana/data';
import { frameToMultivariate } from 'lib/echarts/converters/multivariate';

const theme = createTheme();

/**
 * A merged Prometheus table: `cluster` comes first (labels are sorted) and has one value on every row,
 * so only all string fields together name a row.
 */
const mergedFrame = () =>
  toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [1, 1, 1] },
      { name: 'cluster', type: FieldType.string, values: ['prod', 'prod', 'prod'] },
      { name: 'instance', type: FieldType.string, values: ['a', 'b', 'c'] },
      { name: 'Value #A', type: FieldType.number, values: [1, 2, 3] },
      { name: 'Value #B', type: FieldType.number, values: [4, 5, 6] },
      { name: 'Value #C', type: FieldType.number, values: [7, 8, 9] },
    ],
  });

const names = (fieldConfig?: FieldConfigSource) =>
  frameToMultivariate([mergedFrame()], theme, fieldConfig)!.items.map((item) => item.name);

describe('frameToMultivariate row names', () => {
  it('joins the values of all string fields, so each row has its own name', () => {
    expect(names()).toEqual(['prod a', 'prod b', 'prod c']);
  });

  it('skips an empty string value', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'cluster', type: FieldType.string, values: ['', 'prod'] },
        { name: 'instance', type: FieldType.string, values: ['a', 'b'] },
        { name: 'cpu', type: FieldType.number, values: [1, 2] },
      ],
    });

    expect(frameToMultivariate([frame], theme, undefined)!.items.map((item) => item.name)).toEqual(['a', 'prod b']);
  });

  it('uses the row index when no string field has a value', () => {
    const frame = toDataFrame({ fields: [{ name: 'cpu', type: FieldType.number, values: [1, 2] }] });

    expect(frameToMultivariate([frame], theme, undefined)!.items.map((item) => item.name)).toEqual(['0', '1']);
  });

  // The name is the key of the legend toggle and of a `byName` color override.
  it('hides and colors one row only, by its joined name', () => {
    const fieldConfig: FieldConfigSource = {
      defaults: {},
      overrides: [
        {
          matcher: { id: 'byName', options: 'prod b' },
          properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: false } }],
        },
        {
          matcher: { id: 'byName', options: 'prod c' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
        },
      ],
    };

    const { items } = frameToMultivariate([mergedFrame()], theme, fieldConfig)!;

    expect(items.map((item) => item.hidden)).toEqual([false, true, false]);
    expect(items[2].color).toBe(theme.visualization.getColorByName('red'));
    expect(items[0].color).not.toBe(items[2].color);
  });
});
