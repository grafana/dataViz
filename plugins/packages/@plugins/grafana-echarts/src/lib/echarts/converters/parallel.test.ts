import { createTheme, type DataFrame, type FieldConfigSource, FieldType, toDataFrame } from '@grafana/data';
import { parallelToEChartsOption } from 'lib/echarts/converters/parallel';

const theme = createTheme();

const tableFrame = (): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'team', type: FieldType.string, values: ['Sales', 'Admin'] },
      { name: 'Budget', type: FieldType.number, values: [43, 10] },
      { name: 'Actual', type: FieldType.number, values: [50, 14] },
      { name: 'Forecast', type: FieldType.number, values: [45, 12] },
    ],
  });

describe('parallelToEChartsOption', () => {
  describe('number fields = axes, rows = lines', () => {
    it('maps each number field to an axis and each row to a polyline', () => {
      const result = parallelToEChartsOption([tableFrame()], theme);

      expect(result).not.toBeNull();
      expect(result!.axes.map((axis) => axis.name)).toEqual(['Budget', 'Actual', 'Forecast']);

      expect(result!.data).toMatchObject([
        { name: 'Sales', value: [43, 50, 45] },
        { name: 'Admin', value: [10, 14, 12] },
      ]);
    });

    it('colors each line from its own palette color', () => {
      const result = parallelToEChartsOption([tableFrame()], theme);
      const [first, second] = result!.data.map((line) => line.lineStyle.color);

      expect(first).toEqual(expect.any(String));
      expect(second).not.toBe(first);
    });

    it('omits a per-axis max — each axis carries only a name (auto-scales, unlike radar)', () => {
      const result = parallelToEChartsOption([tableFrame()], theme);

      expect(result!.axes).toEqual([{ name: 'Budget' }, { name: 'Actual' }, { name: 'Forecast' }]);
    });

    it('draws no line for a row hidden by the legend toggle, and keeps its source row', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {},
        overrides: [
          {
            matcher: { id: 'byName', options: 'Sales' },
            properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: false } }],
          },
        ],
      };

      const result = parallelToEChartsOption([tableFrame()], theme, fieldConfig);

      expect(result!.data.map((line) => line.name)).toEqual(['Admin']);
      expect(result!.items.map((item) => item.rowIndex)).toEqual([1]);
    });
  });

  describe('fallbacks', () => {
    it('uses row indices as line names when no string field exists', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'Budget', type: FieldType.number, values: [1, 2] },
          { name: 'Actual', type: FieldType.number, values: [3, 4] },
        ],
      });

      const result = parallelToEChartsOption([frame], theme);

      expect(result!.data).toMatchObject([
        { name: '0', value: [1, 3] },
        { name: '1', value: [2, 4] },
      ]);
    });

    it('uses the first frame that has a numeric field', () => {
      const noNumeric = toDataFrame({
        fields: [{ name: 'team', type: FieldType.string, values: ['a', 'b'] }],
      });

      const result = parallelToEChartsOption([noNumeric, tableFrame()], theme);

      expect(result!.axes.map((axis) => axis.name)).toEqual(['Budget', 'Actual', 'Forecast']);
    });
  });

  describe('no usable data', () => {
    it('returns null for an empty frame list', () => {
      expect(parallelToEChartsOption([], theme)).toBeNull();
    });

    it('returns null when no frame has a numeric field', () => {
      const frame = toDataFrame({
        fields: [{ name: 'team', type: FieldType.string, values: ['a', 'b'] }],
      });

      expect(parallelToEChartsOption([frame], theme)).toBeNull();
    });
  });
});
