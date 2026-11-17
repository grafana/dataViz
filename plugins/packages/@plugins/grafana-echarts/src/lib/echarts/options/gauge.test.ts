import { type GaugeValue } from 'lib/echarts/converters/gauge';
import {
  type GaugeItem,
  type GaugeSeriesContext,
  getGaugeAngles,
  getGaugeBandSeries,
  getGaugeBarSeries,
  getGaugeSeries,
} from './gauge';

const value: GaugeValue = {
  name: 'cpu',
  text: '72%',
  numeric: 72,
  min: 0,
  max: 100,
  color: '#ff9830',
  thresholds: [
    { to: 0.6, color: 'green' },
    { to: 1, color: 'red' },
  ],
  hasDisplayName: false,
};

const item = (extra: Partial<GaugeItem> = {}, valueExtra: Partial<GaugeValue> = {}): GaugeItem => ({
  value: { ...value, ...valueExtra },
  center: [200, 215],
  geometry: {
    centerX: 200,
    centerY: 215,
    outerRadius: 190,
    radius: 175,
    barWidth: 30,
    bandOuterRadius: 200,
    bandWidth: 5,
  },
  text: { value: { fontSize: 40, offsetY: -10 }, name: { fontSize: 16, offsetY: 20 } },
  ...extra,
});

const context: GaugeSeriesContext = {
  angles: getGaugeAngles('gauge'),
  style: { trackColor: '#222', valueTextColor: '#eee', nameTextColor: '#999', fontFamily: 'Inter' },
  zlevel: 3,
};

describe('getGaugeAngles', () => {
  it('gives an arc of 220 degrees with the opening down', () => {
    expect(getGaugeAngles('gauge')).toEqual({ startAngle: 200, endAngle: -20 });
  });

  it('gives a circle that starts at the top and goes around one time', () => {
    expect(getGaugeAngles('circle')).toEqual({ startAngle: 90, endAngle: -270 });
  });
});

describe('getGaugeBandSeries', () => {
  const band = getGaugeBandSeries(item(), context);

  it('draws the threshold stops as the axis line, at the band radius and width', () => {
    expect(band.radius).toBe(200);
    expect(band.axisLine).toEqual({
      lineStyle: {
        width: 5,
        color: [
          [0.6, 'green'],
          [1, 'red'],
        ],
      },
    });
  });

  it('has no data, no text and no pointer events', () => {
    expect(band.data).toEqual([]);
    expect(band.detail).toEqual({ show: false });
    expect(band.title).toEqual({ show: false });
    expect(band.silent).toBe(true);
  });
});

describe('getGaugeBarSeries', () => {
  it('draws a track for the full range and a progress arc in the value color', () => {
    const bar = getGaugeBarSeries(item(), context);
    expect(bar).toMatchObject({
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      zlevel: 3,
      center: [200, 215],
      radius: 190,
      min: 0,
      max: 100,
      axisLine: { lineStyle: { width: 30, color: [[1, '#222']] } },
      progress: { show: true, width: 30, itemStyle: { color: '#ff9830' } },
      data: [{ value: 72, name: 'cpu' }],
    });
  });

  it('hides the parts of an ECharts gauge that core Gauge does not have', () => {
    const bar = getGaugeBarSeries(item(), context);
    expect([bar.pointer, bar.axisTick, bar.splitLine, bar.axisLabel]).toEqual(Array(4).fill({ show: false }));
  });

  it('shows the value text as it is, also when it has braces', () => {
    const bar = getGaugeBarSeries(item({}, { text: '{value} ms' }), context);
    const formatter = bar.detail?.formatter;
    expect(typeof formatter === 'function' ? formatter(72) : formatter).toBe('{value} ms');
    expect(bar.detail).toMatchObject({ show: true, fontSize: 40, offsetCenter: [0, -10], color: '#eee' });
  });

  it('shows the name with its own size, position and color', () => {
    const bar = getGaugeBarSeries(item(), context);
    expect(bar.title).toMatchObject({ show: true, fontSize: 16, offsetCenter: [0, 20], color: '#999' });
  });

  it('hides a text that the layout does not have', () => {
    const bar = getGaugeBarSeries(item({ text: {} }), context);
    expect(bar.detail).toEqual({ show: false });
    expect(bar.title).toEqual({ show: false });
  });

  it.each([
    ['above the maximum', 140, 100],
    ['below the minimum', -20, 0],
  ])('draws a value %s at the limit', (_, numeric, drawn) => {
    const bar = getGaugeBarSeries(item({}, { numeric }), context);
    expect(bar.data).toEqual([{ value: drawn, name: 'cpu' }]);
  });

  it('draws no progress arc for a value that is not a number', () => {
    const bar = getGaugeBarSeries(item({}, { numeric: NaN }), context);
    expect(bar.progress).toMatchObject({ show: false });
    expect(bar.data).toEqual([{ value: 0, name: 'cpu' }]);
  });
});

describe('getGaugeSeries', () => {
  it('gives the band, then the bar', () => {
    const series = getGaugeSeries(item(), context);
    expect(series.map((entry) => entry.radius)).toEqual([200, 190]);
  });

  it('gives the bar only when the gauge has no band', () => {
    const noBand = item({ geometry: { ...item().geometry, bandWidth: 0, bandOuterRadius: 0 } });
    expect(getGaugeSeries(noBand, context)).toHaveLength(1);
  });
});
