import { createTheme, type DataFrame, type FieldConfigSource, FieldType, toDataFrame } from '@grafana/data';
import { radarToEChartsOption } from 'lib/echarts/converters/radar';

const theme = createTheme();

const tableFrame = (): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'team', type: FieldType.string, values: ['Sales', 'Admin'] },
      { name: 'Budget', type: FieldType.number, values: [43, 10] },
      { name: 'Actual', type: FieldType.number, values: [50, 14] },
      { name: 'Forecast', type: FieldType.number, values: [30, 28] },
    ],
  });

const hide = (name: string): FieldConfigSource => ({
  defaults: {},
  overrides: [
    {
      matcher: { id: 'byName', options: name },
      properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: false } }],
    },
  ],
});

describe('radarToEChartsOption', () => {
  describe('number fields = indicators, rows = polygons', () => {
    it('maps each number field to an indicator and each row to a polygon', () => {
      const result = radarToEChartsOption([tableFrame()], theme);

      expect(result).not.toBeNull();
      expect(result!.indicator.map((i) => i.name)).toEqual(['Budget', 'Actual', 'Forecast']);

      expect(result!.data).toMatchObject([
        { name: 'Sales', value: [43, 50, 30] },
        { name: 'Admin', value: [10, 14, 28] },
      ]);
    });

    it('colors each polygon from its own palette color', () => {
      const result = radarToEChartsOption([tableFrame()], theme);
      const [first, second] = result!.data.map((polygon) => polygon.itemStyle.color);

      expect(first).toEqual(expect.any(String));
      expect(second).not.toBe(first);
    });

    it('takes a byName fixed-color override on the row name', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {},
        overrides: [
          {
            matcher: { id: 'byName', options: 'Admin' },
            properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
          },
        ],
      };

      const result = radarToEChartsOption([tableFrame()], theme, fieldConfig);

      expect(result!.data[1].itemStyle.color).toBe(theme.visualization.getColorByName('red'));
    });

    it('computes per-indicator max as the largest polygon value on each axis', () => {
      const result = radarToEChartsOption([tableFrame()], theme);

      // Budget: max(43, 10) = 43; Actual: max(50, 14) = 50; Forecast: max(30, 28) = 30
      expect(result!.indicator).toEqual([
        { name: 'Budget', max: 43 },
        { name: 'Actual', max: 50 },
        { name: 'Forecast', max: 30 },
      ]);
    });

    it('leaves out a hidden row, from the polygons and from the indicator max', () => {
      const result = radarToEChartsOption([tableFrame()], theme, hide('Sales'));

      expect(result!.data.map((polygon) => polygon.name)).toEqual(['Admin']);
      expect(result!.items.map((item) => item.rowIndex)).toEqual([1]);
      expect(result!.indicator.map((i) => i.max)).toEqual([10, 14, 28]);
    });
  });

  describe('fallbacks', () => {
    it('uses row indices as polygon names when no string field exists', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'Budget', type: FieldType.number, values: [1, 2] },
          { name: 'Actual', type: FieldType.number, values: [3, 4] },
          { name: 'Forecast', type: FieldType.number, values: [5, 6] },
        ],
      });

      const result = radarToEChartsOption([frame], theme);

      expect(result!.data).toMatchObject([
        { name: '0', value: [1, 3, 5] },
        { name: '1', value: [2, 4, 6] },
      ]);
    });

    it('uses the first frame that has a numeric field', () => {
      const noNumeric = toDataFrame({
        fields: [{ name: 'team', type: FieldType.string, values: ['a', 'b'] }],
      });

      const result = radarToEChartsOption([noNumeric, tableFrame()], theme);

      expect(result!.indicator.map((i) => i.name)).toEqual(['Budget', 'Actual', 'Forecast']);
    });

    it('leaves the indicator max unset on an axis with no value', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'team', type: FieldType.string, values: ['a'] },
          { name: 'Budget', type: FieldType.number, values: [null] },
          { name: 'Actual', type: FieldType.number, values: [3] },
        ],
      });

      expect(radarToEChartsOption([frame], theme)!.indicator).toEqual([{ name: 'Budget' }, { name: 'Actual', max: 3 }]);
    });
  });

  describe('no usable data', () => {
    it('returns null for an empty frame list', () => {
      expect(radarToEChartsOption([], theme)).toBeNull();
    });

    it('returns null when no frame has a numeric field', () => {
      const frame = toDataFrame({
        fields: [{ name: 'team', type: FieldType.string, values: ['a', 'b'] }],
      });

      expect(radarToEChartsOption([frame], theme)).toBeNull();
    });
  });
});
