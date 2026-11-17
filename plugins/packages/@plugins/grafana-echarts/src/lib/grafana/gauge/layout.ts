// The pixel layout of one gauge in its cell: the arcs and the center text. This file has no ECharts code.
// The arithmetic is that of the core `RadialGauge` component, so a gauge has the same size as in core Gauge.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/RadialGauge/utils.ts
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/RadialGauge/RadialText.tsx
import { type GaugeShape, type GaugeTextMode } from 'editor/types';
import { fitFontSize } from 'lib/grafana/fitFontSize';

/** The space between two gauges, as core Gauge gives to `VizRepeater`. */
export const GAUGE_CELL_SPACING = 16;

/** The arcs of one gauge, in pixels from the top left corner of its cell. */
export interface GaugeGeometry {
  centerX: number;
  centerY: number;
  /** The outer edge of the value bar. */
  outerRadius: number;
  /** The middle of the value bar. The text layout reads it. */
  radius: number;
  barWidth: number;
  /** The outer edge of the threshold band. `0` when there is no band. */
  bandOuterRadius: number;
  /** `0` when there is no band. */
  bandWidth: number;
}

/**
 * The angle below the horizontal at which the arc ends, as a sine: an arc gauge goes 20 degrees below its center,
 * a circle goes a full radius below it.
 */
const BELOW_CENTER_RATIO: Record<GaugeShape, number> = { gauge: Math.sin((20 * Math.PI) / 180), circle: 1 };

const MIN_BAR_WIDTH = 2;
const MIN_BAND_WIDTH = 4;
const MAX_BAND_WIDTH = 12;
const MIN_BAND_SPACING = 2;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The arcs of a gauge that fills a cell of `width` x `height`. */
export function layoutGaugeGeometry(
  width: number,
  height: number,
  shape: GaugeShape,
  barWidthFactor: number,
  showThresholdBand: boolean
): GaugeGeometry {
  const belowRatio = BELOW_CENTER_RATIO[shape];
  // The largest radius that fits the width, and the largest that fits the height.
  const maxRadius = Math.min(width / 2, height / (1 + belowRatio));
  const barWidth = Math.max(barWidthFactor * (maxRadius / 3), MIN_BAR_WIDTH);

  const bandWidth = showThresholdBand ? clamp(0.2 * Math.pow(barWidth, 0.92), MIN_BAND_WIDTH, MAX_BAND_WIDTH) : 0;
  const bandSpacing = showThresholdBand ? clamp(bandWidth / 2, MIN_BAND_SPACING, MAX_BAND_WIDTH) : 0;
  // The band is the outer ring. The value bar is inside it, after a space.
  const outerRadius = maxRadius - bandWidth - bandSpacing;

  // The gauge is in the vertical middle of the cell.
  const belowCenter = maxRadius * belowRatio;
  const centerY = maxRadius + (height - belowCenter - maxRadius) / 2;

  return {
    centerX: width / 2,
    centerY,
    outerRadius,
    radius: outerRadius - barWidth / 2,
    barWidth,
    bandOuterRadius: showThresholdBand ? maxRadius : 0,
    bandWidth,
  };
}

/** Which texts a gauge shows. */
export interface GaugeTextParts {
  showValue: boolean;
  showName: boolean;
}

/**
 * The texts of a text mode. `auto` shows the name when the panel has more than one gauge, or when the field has a
 * display name of its own.
 */
export function resolveGaugeTextParts(
  mode: GaugeTextMode,
  gaugeCount: number,
  hasDisplayName: boolean
): GaugeTextParts {
  const resolved = mode === 'auto' ? (gaugeCount > 1 || hasDisplayName ? 'value_and_name' : 'value') : mode;
  return {
    showValue: resolved === 'value' || resolved === 'value_and_name',
    showName: resolved === 'name' || resolved === 'value_and_name',
  };
}

/** One text of a gauge: its font size, and its vertical middle in pixels below the gauge center. */
export interface GaugeTextLine {
  fontSize: number;
  offsetY: number;
}

/** The value text. Its prefix and its suffix have a smaller font. */
export interface GaugeValueTextLine extends GaugeTextLine {
  unitFontSize: number;
}

export interface GaugeTextLayout {
  value?: GaugeValueTextLine;
  name?: GaugeTextLine;
}

const LINE_HEIGHT = 1.21;
const VALUE_HEIGHT_TO_RADIUS = 0.82;
const NAME_HEIGHT_TO_RADIUS = 0.45;
/** The text height grows slower than the radius, so the text of a large gauge is not too large. */
const LARGE_RADIUS_DECAY = 0.86;
/** The part of its line height that a text takes from the other text. */
const VALUE_SPACE = 0.7;
const MIN_VALUE_FONT_SIZE = 1;
const MIN_NAME_FONT_SIZE = 10;
/** The font size of the prefix and the suffix, as a part of the value font size. */
const UNIT_TO_VALUE_FONT_SIZE = 0.7;
const MIN_UNIT_FONT_SIZE = 6;

export interface GaugeTextInput {
  geometry: Pick<GaugeGeometry, 'radius' | 'barWidth'>;
  shape: GaugeShape;
  parts: GaugeTextParts;
  /** The texts that set the font sizes: the longest value and the longest name of the panel. */
  valueText: string;
  nameText: string;
  /** The family that draws the text: `theme.typography.fontFamily`. */
  fontFamily: string;
}

/**
 * The font sizes and positions of the center text. All gauges of a panel get the texts of the longest value and
 * the longest name, so they have the same font sizes.
 */
export function layoutGaugeText({ geometry, shape, parts, valueText, nameText, fontFamily }: GaugeTextInput) {
  const { radius, barWidth } = geometry;
  const layout: GaugeTextLayout = {};
  if (!parts.showValue && !parts.showName) {
    return layout;
  }

  const width = radius * 2 - barWidth - radius / 7;
  const scaled = Math.pow(radius, LARGE_RADIUS_DECAY);
  const maxNameHeight = parts.showValue ? NAME_HEIGHT_TO_RADIUS * scaled : radius / 4;
  const fit = (text: string, height: number) =>
    fitFontSize({ text, width, height, lineHeight: LINE_HEIGHT, fontFamily });

  const valueFontSize = Math.max(fit(valueText, VALUE_HEIGHT_TO_RADIUS * scaled), MIN_VALUE_FONT_SIZE);
  const nameFontSize = Math.max(fit(nameText, maxNameHeight), MIN_NAME_FONT_SIZE);
  const valueHeight = valueFontSize * LINE_HEIGHT;
  const nameHeight = nameFontSize * LINE_HEIGHT;

  // An arc gauge has no lower half, so its text moves up from the center.
  const lift = shape === 'gauge' ? (valueHeight + nameHeight) / 4 : 0;
  const valueY = parts.showName ? -nameHeight * (1 - VALUE_SPACE) : 0;

  if (parts.showValue) {
    layout.value = {
      fontSize: valueFontSize,
      unitFontSize: Math.max(valueFontSize * UNIT_TO_VALUE_FONT_SIZE, MIN_UNIT_FONT_SIZE),
      offsetY: valueY - lift,
    };
  }
  if (parts.showName) {
    layout.name = {
      fontSize: nameFontSize,
      offsetY: (parts.showValue ? valueY + valueHeight * VALUE_SPACE : 0) - lift,
    };
  }
  return layout;
}
