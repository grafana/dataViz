import { FieldType, toDataFrame } from '@grafana/data';
import { type TopLevelFormatterParams } from 'echarts/types/dist/shared';
import { type TimelineModel } from 'lib/grafana/timeline/types';
import {
  buildTimelineMultiTooltipModel,
  buildTimelineTooltipModel,
  findTimelineSegment,
  type TimelineItem,
} from './timeline';

const field = toDataFrame({ fields: [{ name: 'state', type: FieldType.string, values: ['OK'] }] }).fields[0];
const items: TimelineItem[] = [
  {
    laneIndex: 0,
    lane: { name: 'server A', field, lineWidth: 0, segments: [] },
    segment: {
      start: Date.UTC(2026, 0, 1, 10, 0),
      end: Date.UTC(2026, 0, 1, 11, 5),
      text: 'OK',
      color: 'green',
      fillColor: 'green',
      textColor: 'white',
      rowIndex: 3,
    },
  },
];

describe('buildTimelineTooltipModel', () => {
  it('shows start - end, the lane value with its swatch, and the duration', () => {
    const model = buildTimelineTooltipModel(items, { timeZone: 'utc' })({ dataIndex: 0 } as TopLevelFormatterParams);
    expect(model.header).toEqual({
      label: '',
      value: '2026-01-01 10:00:00 - \n2026-01-01 11:05:00',
      coordinate: { type: 'time', value: items[0].segment.start },
    });
    expect(model.rows).toEqual([
      { color: 'green', label: 'server A', value: 'OK', source: { field, rowIndex: 3 } },
      { label: 'Duration', value: '1h 5m' },
    ]);
    expect(model.source).toEqual({ field, rowIndex: 3 });
  });

  it('shows the sample time and the lane value only in samples mode', () => {
    const model = buildTimelineTooltipModel(items, { timeZone: 'utc', mode: 'samples' })({
      dataIndex: 0,
    } as TopLevelFormatterParams);
    expect(model.header).toEqual({
      label: '',
      value: '2026-01-01 10:00:00',
      coordinate: { type: 'time', value: items[0].segment.start },
    });
    expect(model.rows).toEqual([{ color: 'green', label: 'server A', value: 'OK', source: { field, rowIndex: 3 } }]);
  });
});

const seg = (start: number, end: number, text: string, rowIndex: number) => ({
  start,
  end,
  text,
  color: text === 'OK' ? 'green' : 'red',
  fillColor: 'x',
  textColor: 'white',
  rowIndex,
});
const lane = (name: string, segments: Array<ReturnType<typeof seg>>) => ({ name, field, lineWidth: 0, segments });
const multiModel: TimelineModel = {
  lanes: [lane('A', [seg(0, 10, 'OK', 0), seg(10, 20, 'ERR', 1)]), lane('B', [seg(15, 20, 'OK', 0)])],
  legendItems: [],
};
const at = (time: number) => [{ axisValue: time }] as unknown as TopLevelFormatterParams;

describe('findTimelineSegment', () => {
  it('finds the bar that contains the time, with the end excluded', () => {
    expect(findTimelineSegment(multiModel.lanes[0], 10)?.text).toBe('ERR');
    expect(findTimelineSegment(multiModel.lanes[0], 9.9)?.text).toBe('OK');
    expect(findTimelineSegment(multiModel.lanes[0], 20)).toBeUndefined();
  });

  it('finds the sample cell centred on the time in samples mode', () => {
    const samples = lane('S', [seg(10, 10, 'OK', 0), seg(20, 20, 'ERR', 1)]);
    expect(findTimelineSegment(samples, 14, 10)?.text).toBe('OK');
    expect(findTimelineSegment(samples, 16, 10)?.text).toBe('ERR');
    expect(findTimelineSegment(samples, 30, 10)).toBeUndefined();
  });
});

describe('buildTimelineMultiTooltipModel', () => {
  it('lists the state of each lane at the hovered time', () => {
    const model = buildTimelineMultiTooltipModel(multiModel, { timeZone: 'utc' })(at(16));
    expect(model.header).toEqual({ label: '', value: '1970-01-01 00:00:00', coordinate: { type: 'time', value: 16 } });
    expect(model.rows).toEqual([
      { color: 'red', label: 'A', value: 'ERR', source: { field, rowIndex: 1 } },
      { color: 'green', label: 'B', value: 'OK', source: { field, rowIndex: 0 } },
    ]);
  });

  it('has no row for a lane with no state at that time', () => {
    const model = buildTimelineMultiTooltipModel(multiModel, { timeZone: 'utc' })(at(5));
    expect(model.rows.map((row) => row.label)).toEqual(['A']);
  });
});
