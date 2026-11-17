import { createTheme, dateTime, type TimeRange, type ValueFormatter } from '@grafana/data';
import { seriesTypePath } from 'editor/constants';
import { type SeriesType } from 'editor/types';
import { supportedChartSeriesTypes } from 'lib/echarts/charts/registry';
import { type ChartContext } from 'lib/echarts/charts/types';
import { type HeatmapLayout } from 'lib/echarts/options/types';
import { type PanelOptions } from 'types';
import { panelTypeToAxis } from './converters';

const timeRange: TimeRange = {
  from: dateTime(0),
  to: dateTime(1),
  raw: { from: 'now-1h', to: 'now' },
};

const formatValue: ValueFormatter = (value) => ({ text: String(value) });

// `panelTypeToAxis` only reads `seriesType` and `options.heatmapLayout`; the rest
// of the context is filled with inert defaults so the axis mapping can be tested
// in isolation.
const makeContext = (seriesType: SeriesType, heatmapLayout?: HeatmapLayout): ChartContext => ({
  frames: [],
  theme: createTheme(),
  timeZone: 'utc',
  timeRange,
  options: {
    [seriesTypePath]: seriesType,
    ...(heatmapLayout ? { heatmapLayout } : {}),
  } as PanelOptions,
  seriesType,
  formatValue,
  replaceVariables: (value: string) => value,
  fieldConfig: { defaults: {}, overrides: [] },
});

describe('panelTypeToAxis', () => {
  it('maps cartesian and heatmap families to a time axis when a time field is present', () => {
    expect(panelTypeToAxis(makeContext('line'))).toBe('time');
    expect(panelTypeToAxis(makeContext('bar'))).toBe('time');
    expect(panelTypeToAxis(makeContext('scatter'))).toBe('time');
    expect(panelTypeToAxis(makeContext('heatmap'))).toBe('time');
  });

  it('maps the cartesian family to a category axis when no time field is present', () => {
    expect(panelTypeToAxis(makeContext('line'), false)).toBe('category');
    expect(panelTypeToAxis(makeContext('bar'), false)).toBe('category');
    expect(panelTypeToAxis(makeContext('scatter'), false)).toBe('category');
  });

  it('keeps the binned heatmap layout on a time axis regardless of the time field', () => {
    expect(panelTypeToAxis(makeContext('heatmap'), false)).toBe('time');
    expect(panelTypeToAxis(makeContext('heatmap', 'binned'), false)).toBe('time');
  });

  it('maps the matrix heatmap layout to a category axis (category x category grid) regardless of the time field', () => {
    // Matrix renders on category x category axes, so the manual layout wins over
    // the heatmap family's default time axis even if a time field is present.
    expect(panelTypeToAxis(makeContext('heatmap', 'matrix'))).toBe('category');
    expect(panelTypeToAxis(makeContext('heatmap', 'matrix'), false)).toBe('category');
  });

  it('maps non-cartesian families to a category axis', () => {
    expect(panelTypeToAxis(makeContext('pie'))).toBe('category');
    expect(panelTypeToAxis(makeContext('funnel'))).toBe('category');
    expect(panelTypeToAxis(makeContext('radar'))).toBe('category');
  });

  // A routed series type with no axis mapping crashes its panel (the geo `map` type did, #362). Candlestick
  // without a time field throws on purpose (see below), so this test gives a time field.
  it.each(supportedChartSeriesTypes)('maps the routed series type %s to an axis', (type) => {
    expect(() => panelTypeToAxis(makeContext(type))).not.toThrow();
  });

  it('maps the geo family to a category axis, with or without a time field', () => {
    expect(panelTypeToAxis(makeContext('map'))).toBe('category');
    expect(panelTypeToAxis(makeContext('map'), false)).toBe('category');
  });

  it('keeps the stream family on a time axis, with or without a time field', () => {
    // The `singleAxis` river is time-ordered by contract; a response with no time
    // field yields no layers at all rather than falling back to a category axis.
    expect(panelTypeToAxis(makeContext('themeRiver'))).toBe('time');
    expect(panelTypeToAxis(makeContext('themeRiver'), false)).toBe('time');
  });

  it('keeps the timeline family on a time axis, with or without a time field', () => {
    expect(panelTypeToAxis(makeContext('custom'))).toBe('time');
    expect(panelTypeToAxis(makeContext('custom'), false)).toBe('time');
  });

  it('routes multi-value types by axis support: candlestick needs a time field, boxplot falls back to category', () => {
    expect(panelTypeToAxis(makeContext('candlestick'))).toBe('time');
    expect(panelTypeToAxis(makeContext('boxplot'))).toBe('time');
    expect(panelTypeToAxis(makeContext('boxplot'), false)).toBe('category');
    // candlestick has no category-axis fallback, so a time-less frame is unsupported
    expect(() => panelTypeToAxis(makeContext('candlestick'), false)).toThrow();
  });

  it('throws for a type that no chart module draws', () => {
    expect(() => panelTypeToAxis(makeContext('lines'))).toThrow();
  });

  it('gives the gauge family a category axis, with and without a time field', () => {
    expect(panelTypeToAxis(makeContext('gauge'))).toBe('category');
    expect(panelTypeToAxis(makeContext('gauge'), false)).toBe('category');
  });
});
