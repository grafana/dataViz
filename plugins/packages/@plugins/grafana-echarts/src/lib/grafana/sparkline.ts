// The geometry of a sparkline: the line of the values of one field over time, in a rectangle with no axis.
// The stat panel uses it. This file has no ECharts code.
// It gives the ranges of the `Sparkline` component of `@grafana/ui`:
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/Sparkline/utils.ts
import { type FieldSparkline, FieldType, guessDecimals, roundDecimals } from '@grafana/data';

/** A closed range `[min, max]`. */
export type SparklineRange = [number, number];

/** A point in pixels. */
export type SparklinePoint = [number, number];

export interface SparklineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The x range of the sparkline. A time field uses the time range of the panel, so that the line shows where
 * the data stops in that range. A sparkline with no x field uses the row index.
 */
export function getSparklineXRange(sparkline: FieldSparkline): SparklineRange {
  const { x, y, timeRange } = sparkline;
  if (!x) {
    return [0, y.values.length - 1];
  }
  if (timeRange && x.type === FieldType.time) {
    return [timeRange.from.valueOf(), timeRange.to.valueOf()];
  }
  return [Number(x.values[0]), Number(x.values[x.values.length - 1])];
}

/**
 * The y range of the sparkline: the range of the field (`field.state.range`), made wider by the `min`, `max` and
 * numeric `noValue` of the field config. `undefined` when the field has no range.
 * When the two ends are equal after rounding, the range is made wider, as core does, so that it is not empty.
 */
export function getSparklineYRange(sparkline: FieldSparkline): SparklineRange | undefined {
  const { config, state } = sparkline.y;
  if (typeof state?.range?.min !== 'number' || typeof state.range.max !== 'number') {
    return undefined;
  }
  let min = Math.min(state.range.min, config.min ?? Infinity);
  let max = Math.max(state.range.max, config.max ?? -Infinity);

  const noValue = Number(config.noValue);
  if (config.noValue != null && !Number.isNaN(noValue)) {
    min = Math.min(min, noValue);
    max = Math.max(max, noValue);
  }

  const decimals = config.decimals ?? Math.max(guessDecimals(min), guessDecimals(max));
  const roundedMin = roundDecimals(min, decimals);
  const roundedMax = roundDecimals(max, decimals);
  if (roundedMin !== roundedMax) {
    return [min, max];
  }
  if (roundedMin === 0) {
    return [0, 1];
  }
  return roundedMin < 0 ? [roundedMin * 2, roundedMax] : [roundedMin, roundedMax * 2];
}

/** The position of `value` in `range`, from 0 to 1. A range with no length gives the middle. */
const ratio = (value: number, [min, max]: SparklineRange) => (max === min ? 0.5 : (value - min) / (max - min));

export interface SparklineGeometryInput {
  /** The x values. Unset gives the row index. */
  x?: ArrayLike<number>;
  y: ArrayLike<number | null | undefined>;
  xRange: SparklineRange;
  yRange: SparklineRange;
  /** The rectangle that the ranges fill, in pixels. */
  rect: SparklineRect;
}

/**
 * The points of the line in pixels. A value that is not a number ends a segment, so the line has a gap there.
 * The y axis goes up: the minimum of `yRange` is at the bottom of the rectangle.
 */
export function layoutSparklineSegments(input: SparklineGeometryInput): SparklinePoint[][] {
  const { x, y, xRange, yRange, rect } = input;
  const segments: SparklinePoint[][] = [];
  let segment: SparklinePoint[] = [];

  for (let index = 0; index < y.length; index++) {
    const value = y[index];
    if (typeof value !== 'number' || Number.isNaN(value)) {
      if (segment.length > 0) {
        segments.push(segment);
        segment = [];
      }
      continue;
    }
    segment.push([
      rect.x + ratio(x ? x[index] : index, xRange) * rect.width,
      rect.y + (1 - ratio(value, yRange)) * rect.height,
    ]);
  }
  if (segment.length > 0) {
    segments.push(segment);
  }
  return segments;
}
