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
let watchesFontLoads = false;
const widthCache = new Map<string, number>();

/** The 2D context that measures the text. `null` when the host has no document or no 2D canvas. */
function getContext(): CanvasRenderingContext2D | null {
  if (context === undefined) {
    context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  return context;
}

/**
 * A width that was measured before its font loaded is the width of a fallback font. When the document loads a
 * font, the cache is cleared, so the next fit measures again.
 * https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/loadingdone_event
 */
function watchFontLoads() {
  if (watchesFontLoads || typeof document === 'undefined' || !document.fonts?.addEventListener) {
    return;
  }
  watchesFontLoads = true;
  document.fonts.addEventListener('loadingdone', () => widthCache.clear());
}

/** The width of `text` at 14px in the given font. `undefined` when the host cannot measure text. */
function measureWidth(text: string, fontFamily: string, fontWeight: number): number | undefined {
  const font = `${fontWeight} ${MEASURE_FONT_SIZE}px ${fontFamily}`;
  const key = `${font}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const ctx = getContext();
  if (!ctx) {
    return undefined;
  }
  watchFontLoads();
  ctx.font = font;
  const width = ctx.measureText(text).width;
  if (widthCache.size >= CACHE_LIMIT) {
    widthCache.clear();
  }
  widthCache.set(key, width);
  return width;
}

export interface MeasureTextInput {
  text: string;
  /** The font size in pixels. */
  fontSize: number;
  /** The family that draws the text: `theme.typography.fontFamily`. */
  fontFamily: string;
  fontWeight?: number;
}

/** The width of `text` in pixels. `undefined` when the host cannot measure text. */
export function measureTextWidth({
  text,
  fontSize,
  fontFamily,
  fontWeight = 400,
}: MeasureTextInput): number | undefined {
  const width = measureWidth(text, fontFamily, fontWeight);
  return width === undefined ? undefined : (width * fontSize) / MEASURE_FONT_SIZE;
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
  /** The largest font size in pixels. Unset gives no limit. */
  maxSize?: number;
}

/**
 * The font size in pixels at which `text` fits the box in width and in height, and not more than `maxSize`.
 * In a host that cannot measure text, the width is not a limit: the result is the size for the height.
 */
export function fitFontSize(input: FitFontSizeInput): number {
  const { text, width, height, lineHeight, fontFamily, fontWeight = 400, maxSize = Infinity } = input;
  const textWidth = measureWidth(text, fontFamily, fontWeight);
  const sizeForWidth = textWidth === undefined ? Infinity : (width / (textWidth + WIDTH_PADDING)) * MEASURE_FONT_SIZE;
  const sizeForHeight = height / lineHeight;
  return Math.min(sizeForWidth, sizeForHeight, maxSize);
}
