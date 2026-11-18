import { colorManipulator } from '@grafana/data';
import {
  getBackgroundGradientColors,
  getBackgroundGradientLine,
  getBackgroundSparklineLineColor,
  getBackgroundTextColor,
} from './colors';

const GREEN = '#73BF69';
const YELLOW = '#FADE2A';
const LIGHT_TEXT = 'rgb(247, 248, 250)';
const DARK_TEXT = 'rgb(32, 34, 38)';

describe('getBackgroundTextColor', () => {
  it('gives light text on a color that is not bright', () => {
    expect(getBackgroundTextColor(GREEN, true)).toBe(LIGHT_TEXT);
    expect(getBackgroundTextColor(GREEN, false)).toBe(LIGHT_TEXT);
  });

  it('gives dark text on a bright color', () => {
    expect(getBackgroundTextColor(YELLOW, true)).toBe(DARK_TEXT);
  });

  it('gives the text color of the theme on a color that is almost transparent', () => {
    expect(getBackgroundTextColor('rgba(250, 222, 42, 0.2)', true)).toBe(LIGHT_TEXT);
    expect(getBackgroundTextColor('rgba(250, 222, 42, 0.2)', false)).toBe(DARK_TEXT);
  });

  it('reads a color name', () => {
    expect(getBackgroundTextColor('gray', true)).toBe(LIGHT_TEXT);
    expect(getBackgroundTextColor('white', true)).toBe(DARK_TEXT);
  });
});

describe('getBackgroundSparklineLineColor', () => {
  it('adds 40% of the channel range to each channel, to a maximum of 255', () => {
    // rgb(115, 191, 105) + 102 = rgb(217, 255, 207).
    expect(getBackgroundSparklineLineColor(GREEN)).toBe('#d9ffcf');
  });

  it('keeps the alpha of the color', () => {
    expect(getBackgroundSparklineLineColor('rgba(0, 0, 0, 0.5)')).toBe('rgba(102, 102, 102, 0.5)');
  });
});

describe('getBackgroundGradientColors', () => {
  // Red is `hsl(0, 100%, 50%)`.
  const RED = 'rgb(255, 0, 0)';

  it('shifts the hue by 8 degrees each way, and makes the colors darker in a dark theme', () => {
    expect(getBackgroundGradientColors(RED, true)).toEqual([
      colorManipulator.rgbToHex(colorManipulator.hslToRgb('hsl(8, 100%, 35%)')),
      colorManipulator.rgbToHex(colorManipulator.hslToRgb('hsl(352, 100%, 45%)')),
    ]);
  });

  it('makes the colors lighter in a light theme, by 70% of the amount', () => {
    expect(getBackgroundGradientColors(RED, false)).toEqual([
      colorManipulator.rgbToHex(colorManipulator.hslToRgb('hsl(8, 100%, 60.5%)')),
      colorManipulator.rgbToHex(colorManipulator.hslToRgb('hsl(352, 100%, 53.5%)')),
    ]);
  });

  it('keeps a color with no saturation gray', () => {
    expect(getBackgroundGradientColors('rgb(128, 128, 128)', true)).toEqual(['#5a5a5a', '#737373']);
  });

  it('keeps the alpha of the color', () => {
    const [start] = getBackgroundGradientColors('rgba(255, 0, 0, 0.5)', true);
    expect(start).toBe('rgba(179, 24, 0, 0.5)');
  });
});

describe('getBackgroundGradientLine', () => {
  it('gives a line at 120 degrees through the center of the rectangle, with its ends at the corners', () => {
    const { start, end } = getBackgroundGradientLine({ x: 0, y: 0, width: 200, height: 100 });
    // The half length is (200 * sin(120) + 100 * |cos(120)|) / 2 = 111.6, in the direction (0.866, 0.5).
    expect(start[0]).toBeCloseTo(3.35, 1);
    expect(start[1]).toBeCloseTo(-5.8, 1);
    expect(end[0]).toBeCloseTo(196.65, 1);
    expect(end[1]).toBeCloseTo(105.8, 1);
  });

  it('moves with the rectangle', () => {
    const atOrigin = getBackgroundGradientLine({ x: 0, y: 0, width: 200, height: 100 });
    const moved = getBackgroundGradientLine({ x: 50, y: 20, width: 200, height: 100 });
    expect(moved.start[0] - atOrigin.start[0]).toBeCloseTo(50);
    expect(moved.end[1] - atOrigin.end[1]).toBeCloseTo(20);
  });
});
