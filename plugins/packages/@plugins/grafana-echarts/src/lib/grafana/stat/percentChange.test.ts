import { createTheme } from '@grafana/data';
import { PercentChangeColorMode } from '@grafana/schema';
import {
  formatPercentChange,
  getPercentChangeColor,
  hasPercentChange,
  measurePercentChange,
  type PercentChangeInput,
  placePercentChange,
} from './percentChange';

const theme = createTheme();
/** Each character is half as wide as the font size. */
const measure = (text: string, fontSize: number) => (text.length * fontSize) / 2;
const metrics = (input: Partial<PercentChangeInput> = {}) =>
  measurePercentChange({ percentChange: 50, valueSize: 60, isRow: false, measure, ...input });

describe('hasPercentChange', () => {
  it('is true for a number, 0 included', () => {
    expect(hasPercentChange(12)).toBe(true);
    expect(hasPercentChange(0)).toBe(true);
  });

  it('is false for no value and for NaN', () => {
    expect(hasPercentChange(undefined)).toBe(false);
    expect(hasPercentChange(NaN)).toBe(false);
  });
});

describe('formatPercentChange', () => {
  it('reads the input as a percent, and gives not more than 3 significant digits', () => {
    expect(formatPercentChange(50)).toBe('50%');
    expect(formatPercentChange(105.714)).toBe('106%');
    expect(formatPercentChange(-3.456)).toBe('-3.46%');
  });
});

describe('measurePercentChange', () => {
  it('gives a font size of the value size divided by 2.5, and an arrow of a third of the value size', () => {
    expect(metrics()).toMatchObject({ text: '50%', fontSize: 24, fontWeight: 500, iconSize: 20, iconGap: 8 });
  });

  it('does not go below 12px for the text, 10px for the arrow and 4px for the space between them', () => {
    expect(metrics({ valueSize: 10 })).toMatchObject({ fontSize: 12, iconSize: 10, iconGap: 4 });
  });

  it('uses the font size that is set, with an arrow 3px smaller', () => {
    expect(metrics({ percentSize: 30 })).toMatchObject({ fontSize: 30, iconSize: 27 });
  });

  it('uses the fitted font size, with an arrow of 80% of it', () => {
    expect(metrics({ percentSize: 30, fittedSize: 100 })).toMatchObject({ fontSize: 100, iconSize: 80 });
  });

  it('gives an arrow up for an increase, an arrow down for a decrease, and no arrow for 0', () => {
    expect(metrics({ percentChange: 5 }).direction).toBe('up');
    expect(metrics({ percentChange: -5 }).direction).toBe('down');
    expect(metrics({ percentChange: 0 }).direction).toBeUndefined();
  });

  it('gives the width of the arrow, the space and the text', () => {
    // '50%' is 3 * 24 / 2 = 36 wide. The arrow is 20, the space is 8.
    expect(metrics().item.width).toBe(64);
    expect(metrics({ percentChange: 0 }).item.width).toBe(2 * 12);
  });

  it('gives no width when the host cannot measure text', () => {
    expect(metrics({ measure: () => undefined }).item.width).toBeUndefined();
  });

  it('is one line high in a column, and moves up by a quarter of a font size above 12px', () => {
    expect(metrics().item).toMatchObject({ height: 24 * 1.2, marginTop: -6 });
    expect(metrics({ valueSize: 10 }).item.marginTop).toBe(0);
  });

  it('is as high as the line of the value in a row, with no margin', () => {
    expect(metrics({ isRow: true }).item).toMatchObject({ height: 60 * 1.2, marginTop: 0 });
  });
});

describe('placePercentChange', () => {
  it('puts the arrow at the left of the item and the text after the arrow and the space', () => {
    const { textX, icon } = placePercentChange(metrics(), { x: 100, align: 'left', y: 0 }, false);
    expect(icon).toMatchObject({ direction: 'up', x: 100, size: 20 });
    expect(textX).toBe(128);
  });

  it('reads the position as the center or the right edge of the item', () => {
    expect(placePercentChange(metrics(), { x: 100, align: 'center', y: 0 }, false).icon!.x).toBe(68);
    expect(placePercentChange(metrics(), { x: 100, align: 'right', y: 0 }, false).icon!.x).toBe(36);
  });

  it('puts the text and the arrow at the vertical center of the item in a column', () => {
    const { textY, icon } = placePercentChange(metrics(), { x: 0, align: 'left', y: 10 }, false);
    expect(textY).toBeCloseTo(10);
    expect(icon!.y + icon!.size / 2).toBeCloseTo(10 + (24 * 1.2) / 2);
  });

  it('puts the text at the vertical center of the item in a row, and the arrow on the baseline of the text', () => {
    const row = metrics({ isRow: true });
    const { textY, icon } = placePercentChange(row, { x: 0, align: 'left', y: 10 }, true);
    const center = 10 + 36;
    expect(textY + (24 * 1.2) / 2).toBeCloseTo(center);
    expect(icon!.y + icon!.size).toBeGreaterThan(center);
    expect(icon!.y + icon!.size).toBeLessThan(center + 24 / 2);
  });

  it('gives no arrow for a change of 0, and puts the text at the left of the item', () => {
    const placed = placePercentChange(metrics({ percentChange: 0 }), { x: 100, align: 'left', y: 0 }, false);
    expect(placed.icon).toBeUndefined();
    expect(placed.textX).toBe(100);
  });
});

describe('getPercentChangeColor', () => {
  const green = theme.visualization.getColorByName('green');
  const red = theme.visualization.getColorByName('red');

  it('Standard: green for an increase, red for a decrease and for 0', () => {
    expect(getPercentChangeColor(5, PercentChangeColorMode.Standard, '#fff', theme)).toBe(green);
    expect(getPercentChangeColor(-5, PercentChangeColorMode.Standard, '#fff', theme)).toBe(red);
    expect(getPercentChangeColor(0, PercentChangeColorMode.Standard, '#fff', theme)).toBe(red);
  });

  it('Inverted: red for an increase, green for a decrease', () => {
    expect(getPercentChangeColor(5, PercentChangeColorMode.Inverted, '#fff', theme)).toBe(red);
    expect(getPercentChangeColor(-5, PercentChangeColorMode.Inverted, '#fff', theme)).toBe(green);
  });

  it('Same as Value: the color of the value text', () => {
    expect(getPercentChangeColor(5, PercentChangeColorMode.SameAsValue, '#abc', theme)).toBe('#abc');
  });
});
