import { FieldType, toDataFrame } from '@grafana/data';
import { askInChat } from './pointMessage';

describe('the point in Ask in chat', () => {
  it('sends a category and a text value without numeric coordinates or a query ID', () => {
    const frame = toDataFrame({ fields: [{ name: 'Status', type: FieldType.string, values: ['healthy'] }] });
    const source = { field: frame.fields[0], rowIndex: 0 };
    const onMessage = jest.fn();
    askInChat([frame], onMessage).onClick(
      {
        header: { label: 'API', value: '' },
        rows: [{ label: 'Status', value: 'Healthy', source }],
      },
      source
    );
    expect(onMessage.mock.calls).toEqual([
      [
        {
          target: 'point',
          series: { name: 'Status', labels: {} },
          point: { x: 'API', y: 'Healthy', xType: 'string' },
        },
      ],
    ]);
  });

  it('keeps zero and sends the plotted value of a numeric bucket', () => {
    const frame = toDataFrame({ fields: [{ name: 'Count', type: FieldType.number, values: [14] }] });
    const source = { field: frame.fields[0], rowIndex: 0 };
    const onMessage = jest.fn();
    askInChat([frame], onMessage).onClick(
      {
        header: { label: '', value: '0', coordinate: { type: 'number', value: 0 } },
        rows: [{ label: 'Value', value: '3 req/s', rawValue: 3, source }],
      },
      source
    );
    expect(onMessage.mock.calls).toEqual([
      [
        {
          target: 'point',
          series: { name: 'Count', labels: {} },
          point: { x: '0', y: '3 req/s', xType: 'number', xRaw: 0, yRaw: 3 },
        },
      ],
    ]);
  });
});
