// Builds the ECharts gauge series of one gauge from the plain gauge model and its pixel layout.
// This file has no Grafana code. https://echarts.apache.org/en/option.html#series-gauge
import { type GaugeSeriesOption } from 'echarts';
import { type GaugeShape } from 'editor/types';
import { type GaugeValue } from 'lib/echarts/converters/gauge';
import { type GaugeGeometry, type GaugeTextLayout } from 'lib/grafana/gauge/layout';

/** The start and end of the arc, in the degrees of ECharts: 0 is to the right, and the angle grows to the left. */
export interface GaugeAngles {
  startAngle: number;
  endAngle: number;
}

/**
 * The angles of a shape. An arc gauge covers 220 degrees with the opening down, as core Gauge. A circle starts at
 * the top and goes around one time.
 */
export function getGaugeAngles(shape: GaugeShape): GaugeAngles {
  return shape === 'circle' ? { startAngle: 90, endAngle: -270 } : { startAngle: 200, endAngle: -20 };
}

/** The colors and the font of a gauge, as CSS values. */
export interface GaugeStyle {
  /** The part of the bar that the value does not fill. */
  trackColor: string;
  valueTextColor: string;
  nameTextColor: string;
  fontFamily: string;
}

/** One gauge, ready to draw. */
export interface GaugeItem {
  value: GaugeValue;
  /** The center of the gauge, in pixels from the top left corner of the chart. */
  center: [number, number];
  geometry: GaugeGeometry;
  text: GaugeTextLayout;
}

/** What all gauges of a panel share. */
export interface GaugeSeriesContext {
  angles: GaugeAngles;
  style: GaugeStyle;
  /** The canvas layer of the series (`zLevel.series` of the panel options). */
  zlevel?: number;
}

/** The parts of an ECharts gauge that core Gauge does not have. */
const NO_SCALE_PARTS = {
  pointer: { show: false },
  axisTick: { show: false },
  splitLine: { show: false },
  axisLabel: { show: false },
} satisfies GaugeSeriesOption;

/**
 * The threshold band: a thin ring outside the value bar, with the color of each threshold step. It has no data.
 * https://echarts.apache.org/en/option.html#series-gauge.axisLine.lineStyle.color
 */
export function getGaugeBandSeries(item: GaugeItem, { angles, zlevel }: GaugeSeriesContext): GaugeSeriesOption {
  return {
    type: 'gauge',
    ...NO_SCALE_PARTS,
    ...angles,
    zlevel,
    silent: true,
    center: item.center,
    radius: item.geometry.bandOuterRadius,
    axisLine: {
      lineStyle: {
        width: item.geometry.bandWidth,
        color: item.value.thresholds.map((stop) => [stop.to, stop.color]),
      },
    },
    detail: { show: false },
    title: { show: false },
    data: [],
  };
}

/**
 * The value bar: a track for the full range, and a progress arc from the minimum to the value. A value outside
 * the range draws at the nearest limit. A value that is not a number draws the track only.
 * https://echarts.apache.org/en/option.html#series-gauge.progress
 */
export function getGaugeBarSeries(item: GaugeItem, { angles, style, zlevel }: GaugeSeriesContext): GaugeSeriesOption {
  const { value, geometry, text } = item;
  const hasNumber = Number.isFinite(value.numeric);

  return {
    type: 'gauge',
    ...NO_SCALE_PARTS,
    ...angles,
    zlevel,
    center: item.center,
    radius: geometry.outerRadius,
    min: value.min,
    max: value.max,
    axisLine: { lineStyle: { width: geometry.barWidth, color: [[1, style.trackColor]] } },
    progress: { show: hasNumber, width: geometry.barWidth, itemStyle: { color: value.color } },
    detail: text.value
      ? {
          show: true,
          // A function, because ECharts reads `{...}` in a string as a template.
          formatter: () => value.text,
          offsetCenter: [0, text.value.offsetY],
          fontSize: text.value.fontSize,
          fontWeight: 'normal',
          fontFamily: style.fontFamily,
          color: style.valueTextColor,
        }
      : { show: false },
    title: text.name
      ? {
          show: true,
          offsetCenter: [0, text.name.offsetY],
          fontSize: text.name.fontSize,
          fontFamily: style.fontFamily,
          color: style.nameTextColor,
        }
      : { show: false },
    data: [
      { value: hasNumber ? Math.min(Math.max(value.numeric, value.min), value.max) : value.min, name: value.name },
    ],
  };
}

/** The series of one gauge: the threshold band, when it has one, then the value bar. */
export function getGaugeSeries(item: GaugeItem, context: GaugeSeriesContext): GaugeSeriesOption[] {
  const bar = getGaugeBarSeries(item, context);
  return item.geometry.bandWidth > 0 ? [getGaugeBandSeries(item, context), bar] : [bar];
}
