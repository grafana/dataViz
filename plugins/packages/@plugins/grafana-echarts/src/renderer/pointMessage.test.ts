import { FieldType, toDataFrame } from '@grafana/data';
import { timeHeader } from 'lib/echarts/tooltip/timeHeader';
import { askInChat } from './pointMessage';

describe('the point in Ask in chat', () => {
  it('sends a category and a text value without numeric coordinates or a query ID', () => {
    const frame = toDataFrame({ fields: [{ name: 'Status', type: FieldType.string, values: ['healthy'] }] });
    const source = { field: frame.fields[0], rowIndex: 0 };
    const onMessage = jest.fn();
    askInChat([frame], onMessage).resolve(
      {
        header: { label: 'API', value: '' },
        rows: [{ label: 'Status', value: 'Healthy', source }],
      },
      source
    )?.();
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
    askInChat([frame], onMessage).resolve(
      {
        header: { label: '', value: '0', coordinate: { type: 'number', value: 0 } },
        rows: [{ label: 'Value', value: '3 req/s', rawValue: 3, source }],
      },
      source
    )?.();
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
    askInChat([frame], onMessage).resolve(
      {
        header: timeHeader(Date.UTC(2026, 0, 1, 10), 'utc', Date.UTC(2026, 0, 1, 11)),
        rows: [{ label: 'State', value: 'OK', source }],
      },
      source
    )?.();
    expect(onMessage.mock.calls[0][0].point).toEqual({
      x: '2026-01-01 10:00:00 - 2026-01-01 11:00:00',
      y: 'OK',
      xType: 'time',
      xRaw: Date.UTC(2026, 0, 1, 10),
      xIso: '2026-01-01T10:00:00.000Z',
    });
  });

  it('has no handler for a point that has no value row', () => {
    const frame = toDataFrame({ fields: [{ name: 'node', type: FieldType.string, values: ['api'] }] });
    const source = { field: frame.fields[0], rowIndex: 0 };
    const action = askInChat([frame], jest.fn());
    const header = { label: 'api', value: '' };
    expect(action.resolve({ header, rows: [{ label: '→ db', value: '50' }] }, source)).toBeUndefined();
    expect(action.resolve({ header, rows: [{ label: 'Value', value: '', source }] }, source)).toBeUndefined();
  });

  it('sends the refId of the origin frame for a field that the chart made', () => {
    const frame = toDataFrame({ refId: 'B', fields: [{ name: 'latency', type: FieldType.number, values: [12, 15] }] });
    const count = { ...frame.fields[0], values: [2], state: { origin: { frameIndex: 1, fieldIndex: 0 } } };
    const source = { field: count, rowIndex: 0 };
    const onMessage = jest.fn();
    askInChat([toDataFrame({ refId: 'A', fields: [] }), frame], onMessage).resolve(
      { header: { label: 'Bucket', value: '12 - 16' }, rows: [{ label: 'latency', value: '2', source }] },
      source
    )?.();
    expect(onMessage.mock.calls[0][0].series).toEqual({ name: 'latency', labels: {}, refId: 'B' });
  });
});
