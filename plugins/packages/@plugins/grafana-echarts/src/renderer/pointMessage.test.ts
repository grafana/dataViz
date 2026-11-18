import { FieldType, toDataFrame } from '@grafana/data';
import { timeHeader } from 'lib/echarts/tooltip/timeHeader';
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

  it('sends the start and the end of a timeline segment on one line', () => {
    const frame = toDataFrame({ fields: [{ name: 'State', type: FieldType.string, values: ['OK'] }] });
    const source = { field: frame.fields[0], rowIndex: 0 };
    const onMessage = jest.fn();
    askInChat([frame], onMessage).onClick(
      {
        header: timeHeader(Date.UTC(2026, 0, 1, 10), 'utc', Date.UTC(2026, 0, 1, 11)),
        rows: [{ label: 'State', value: 'OK', source }],
      },
      source
    );
    expect(onMessage.mock.calls[0][0].point).toEqual({
      x: '2026-01-01 10:00:00 - 2026-01-01 11:00:00',
      y: 'OK',
      xType: 'time',
      xRaw: Date.UTC(2026, 0, 1, 10),
      xIso: '2026-01-01T10:00:00.000Z',
    });
  });
});
