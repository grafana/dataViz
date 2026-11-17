// The largest font size at which a text fits a box. The gauge and the stat panels use it.
//
// It is the arithmetic of `calculateFontSize` of `@grafana/ui`, with one change: the font family is a parameter.
// `calculateFontSize` measures with the fixed family 'Inter'. In a host with no Inter font, the browser measures
// with its default font, but ECharts draws with the next family of the theme, so the text can overflow its box.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/utils/measureText.ts

/** The font size at which the text is measured. The result scales from it. */
const MEASURE_FONT_SIZE = 14;
/** Core adds 2px to the measured width. */
const WIDTH_PADDING = 2;
const CACHE_LIMIT = 500;

let context: CanvasRenderingContext2D | null | undefined;
const widthCache = new Map<string, number>();

/** The width of `text` at 14px in the given font. `0` when the host has no 2D canvas. */
function measureWidth(text: string, fontFamily: string, fontWeight: number): number {
  const font = `${fontWeight} ${MEASURE_FONT_SIZE}px ${fontFamily}`;
  const key = `${font}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  context ??= document.createElement('canvas').getContext('2d');
  if (!context) {
    return 0;
  }
  context.font = font;
  const width = context.measureText(text).width;
  if (widthCache.size >= CACHE_LIMIT) {
    widthCache.clear();
  }
  widthCache.set(key, width);
  return width;
}

export interface FitFontSizeInput {
  text: string;
  /** The width of the box in pixels. */
  width: number;
  /** The height of the box in pixels. */
  height: number;
  /** The line height as a factor of the font size. */
  lineHeight: number;
  /** The family that draws the text: `theme.typography.fontFamily`. */
  fontFamily: string;
  fontWeight?: number;
}

/** The font size in pixels at which `text` fits the box in width and in height. */
export function fitFontSize({ text, width, height, lineHeight, fontFamily, fontWeight = 400 }: FitFontSizeInput) {
  const sizeForWidth = (width / (measureWidth(text, fontFamily, fontWeight) + WIDTH_PADDING)) * MEASURE_FONT_SIZE;
  const sizeForHeight = height / lineHeight;
  return Math.min(sizeForWidth, sizeForHeight);
}
