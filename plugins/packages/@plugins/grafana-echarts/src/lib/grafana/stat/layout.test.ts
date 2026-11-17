import { type DataFrame, ReducerID } from '@grafana/data';
import { BigValueColorMode, BigValueGraphMode, BigValueJustifyMode, BigValueTextMode } from '@grafana/schema';
import { resolveStatOptions, type StatRenderOptions } from 'editor/stat';
import { resolveFieldDisplays } from 'lib/grafana/fieldDisplays';
import { applyGrafanaFieldDefaults, defaultTimeRange, theme } from 'test/panel';
import { cpuFrame, seriesFrame, singlePointFrame } from 'test/statCanvas';
import {
  BACKGROUND_SPARKLINE_FILL,
  getBackgroundGradientColors,
  getBackgroundSparklineLineColor,
  getBackgroundTextColor,
} from './colors';
import { layoutStatCells, resolveStatTextMode, STAT_CELL_SPACING, STAT_LINE_HEIGHT } from './layout';
import { applyGlobalFieldRange } from './range';

const displays = (frames: DataFrame[], sparkline = true) =>
  resolveFieldDisplays({
    frames: applyGlobalFieldRange(applyGrafanaFieldDefaults(frames), theme),
    fieldConfig: { defaults: {}, overrides: [] },
    reduceOptions: undefined,
    defaultCalc: ReducerID.lastNotNull,
    replaceVariables: (value) => value,
    theme,
    sparkline,
  });

const layout = (
  frames: DataFrame[],
  width: number,
  height: number,
  options: Partial<StatRenderOptions> = {},
  sparkline = options.graphMode !== BigValueGraphMode.None
) =>
  layoutStatCells({
    width,
    height,
    values: displays(frames, sparkline),
    options: { ...resolveStatOptions({} as Parameters<typeof resolveStatOptions>[0]), ...options },
    theme,
    timeRange: defaultTimeRange,
  });

const valueAndName = { textMode: BigValueTextMode.ValueAndName };

describe('resolveStatTextMode', () => {
  it('keeps the automatic mode for a panel with a title', () => {
    expect(resolveStatTextMode(BigValueTextMode.Auto, false, 'CPU')).toBe(BigValueTextMode.Auto);
  });

  it('shows the names for a panel with no title, or with a display name in the field config', () => {
    expect(resolveStatTextMode(BigValueTextMode.Auto, false, '')).toBe(BigValueTextMode.ValueAndName);
    expect(resolveStatTextMode(BigValueTextMode.Auto, false, undefined)).toBe(BigValueTextMode.ValueAndName);
    expect(resolveStatTextMode(BigValueTextMode.Auto, true, 'CPU')).toBe(BigValueTextMode.ValueAndName);
  });

  it('keeps a mode that is not the automatic mode', () => {
    expect(resolveStatTextMode(BigValueTextMode.Value, true, '')).toBe(BigValueTextMode.Value);
  });
});

describe('layoutStatCells', () => {
  describe('cells', () => {
    it('gives one cell for each value, with the spacing of core Stat between the cells', () => {
      const cells = layout([seriesFrame(2)], 400, 100);
      expect(cells).toHaveLength(2);
      expect(cells[1].x - (cells[0].x + cells[0].width)).toBeCloseTo(STAT_CELL_SPACING, 9);
    });

    it('gives no cell for a panel with no size', () => {
      expect(layout([cpuFrame], 0, 300)).toEqual([]);
    });

    it('keeps the value that each cell shows', () => {
      const cells = layout([seriesFrame(2)], 400, 300);
      expect(cells.map((cell) => cell.display.display.title)).toEqual(['server-1', 'server-2']);
    });
  });

  describe('texts', () => {
    it('shows only the value for one value in the automatic mode, with its unit as the suffix', () => {
      const [cell] = layout([cpuFrame], 400, 300);
      expect(cell.title).toBeUndefined();
      expect(cell.value).toMatchObject({ text: '72', suffix: '%' });
    });

    it('shows the name and the value for more than one value in the automatic mode', () => {
      const cells = layout([seriesFrame(2)], 400, 300);
      expect(cells.map((cell) => cell.title?.text)).toEqual(['server-1', 'server-2']);
    });

    it('shows the name as the large text in the Name mode', () => {
      const [cell] = layout([cpuFrame], 400, 300, { textMode: BigValueTextMode.Name });
      expect(cell.title).toBeUndefined();
      expect(cell.value).toMatchObject({ text: 'cpu', suffix: undefined });
    });

    it('shows no text in the None mode, and keeps the sparkline', () => {
      const [cell] = layout([cpuFrame], 400, 300, { textMode: BigValueTextMode.None });
      expect(cell.title).toBeUndefined();
      expect(cell.value).toBeUndefined();
      expect(cell.sparkline).toBeDefined();
    });

    it('gives the suffix a smaller font than the value', () => {
      const [cell] = layout([cpuFrame], 400, 300);
      expect(cell.value!.fontSize).toBeGreaterThan(26);
      expect(cell.value!.suffixFontSize).toBeCloseTo(cell.value!.fontSize * 0.6, 9);
    });

    it('gives all cells the same font sizes', () => {
      const cells = layout([seriesFrame(4)], 500, 400);
      expect(new Set(cells.map((cell) => cell.value!.fontSize)).size).toBe(1);
      expect(new Set(cells.map((cell) => cell.title!.fontSize)).size).toBe(1);
    });

    it('draws no text that has no space', () => {
      const [cell] = layout([cpuFrame], 14, 14, valueAndName);
      expect(cell.title).toBeUndefined();
      expect(cell.value).toBeUndefined();
    });
  });

  describe('colors', () => {
    it('gives the value the color of the value, and the name the text color of the theme', () => {
      const [cell] = layout([cpuFrame], 400, 300, valueAndName);
      expect(cell.value!.color).toBe(cell.display.display.color);
      expect(cell.title!.color).toBe(theme.colors.text.primary);
    });

    it('gives the value the text color of the theme when the color mode is None', () => {
      const [cell] = layout([cpuFrame], 400, 300, { colorMode: BigValueColorMode.None });
      expect(cell.value!.color).toBe(theme.colors.text.primary);
    });

    it('gives the sparkline the color of the value for its line, and that color with alpha for its area', () => {
      const [cell] = layout([cpuFrame], 400, 300, { colorMode: BigValueColorMode.None });
      expect(cell.sparkline!.lineColor).toBe(cell.display.display.color);
      expect(cell.sparkline!.fillColor).not.toBe(cell.sparkline!.lineColor);
    });

    it('gives a cell no background in the None and Value color modes', () => {
      expect(layout([cpuFrame], 400, 300, { colorMode: BigValueColorMode.None })[0].background).toBeUndefined();
      expect(layout([cpuFrame], 400, 300, { colorMode: BigValueColorMode.Value })[0].background).toBeUndefined();
    });

    it('gives a cell one background color, the color of the value, in the Background Solid color mode', () => {
      const [cell] = layout([cpuFrame], 400, 300, { colorMode: BigValueColorMode.BackgroundSolid });
      expect(cell.background!.colors).toEqual([cell.display.display.color]);
    });

    it('gives a cell a gradient of two colors across the cell in the Background Gradient color mode', () => {
      const cells = layout([seriesFrame(2)], 400, 300, { colorMode: BigValueColorMode.Background });
      for (const cell of cells) {
        const { colors, start, end } = cell.background!;
        expect(colors).toEqual(getBackgroundGradientColors(cell.display.display.color!, theme.isDark));
        // The gradient line goes through the center of the cell.
        expect((start[0] + end[0]) / 2).toBeCloseTo(cell.x + cell.width / 2);
        expect((start[1] + end[1]) / 2).toBeCloseTo(cell.y + cell.height / 2);
      }
    });

    it.each([BigValueColorMode.Background, BigValueColorMode.BackgroundSolid])(
      'gives the texts and the sparkline the colors for a colored background in the %s color mode',
      (colorMode) => {
        const [cell] = layout([cpuFrame], 400, 300, { ...valueAndName, colorMode });
        const valueColor = cell.display.display.color!;
        const textColor = getBackgroundTextColor(valueColor, theme.isDark);
        expect(cell.value!.color).toBe(textColor);
        expect(cell.title!.color).toBe(textColor);
        expect(cell.sparkline!.lineColor).toBe(getBackgroundSparklineLineColor(valueColor));
        expect(cell.sparkline!.fillColor).toBe(BACKGROUND_SPARKLINE_FILL);
      }
    );
  });

  describe('stacked layout with a sparkline', () => {
    it('puts the name at the top left, the value below it, and the sparkline in the space below them', () => {
      const [cell] = layout([cpuFrame], 300, 300, valueAndName);
      const { title, value, sparkline } = cell;

      expect(title).toMatchObject({ x: 12, y: 12, align: 'left' });
      expect(value).toMatchObject({ x: 12, align: 'left' });
      expect(value!.y).toBeCloseTo(12 + title!.fontSize * STAT_LINE_HEIGHT, 9);
      expect(sparkline!.baseline).toBe(300);
      // The top of the sparkline box is the bottom of the two lines of text, without the padding.
      const top = Math.min(...sparkline!.segments.flat().map(([, y]) => y));
      expect(top).toBeGreaterThanOrEqual((title!.fontSize + value!.fontSize) * STAT_LINE_HEIGHT - 1e-9);
    });

    it('makes the name not larger than 30px and not larger than 70% of the value', () => {
      const [cell] = layout([cpuFrame], 1000, 1000, { ...valueAndName, wideLayout: false });
      expect(cell.title!.fontSize).toBeLessThanOrEqual(30);
      expect(cell.title!.fontSize).toBeLessThanOrEqual(cell.value!.fontSize * 0.7 + 1e-9);
    });

    it('puts a value with no name at the center of the cell', () => {
      const [cell] = layout([cpuFrame], 300, 300);
      expect(cell.value).toMatchObject({ x: 150, align: 'center' });
      const valueHeight = cell.value!.fontSize * STAT_LINE_HEIGHT;
      expect(cell.value!.y).toBeCloseTo(12 + (276 - valueHeight) / 2, 9);
    });

    it('makes the sparkline as wide as the cell, over the time range of the panel', () => {
      const [cell] = layout([cpuFrame], 300, 300);
      const xs = cell.sparkline!.segments.flat().map(([x]) => x);
      // The first and the last row are at the two ends of `defaultTimeRange`.
      expect(Math.min(...xs)).toBeCloseTo(0, 9);
      expect(Math.max(...xs)).toBeCloseTo(300, 9);
    });
  });

  describe('stacked layout with no sparkline', () => {
    it('is used when the cell is not higher than 100px', () => {
      const [cell] = layout([cpuFrame], 150, 100, valueAndName);
      expect(cell.sparkline).toBeUndefined();
    });

    it('is used when the graph mode is None, and when the series has one row', () => {
      expect(layout([cpuFrame], 300, 300, { graphMode: BigValueGraphMode.None })[0].sparkline).toBeUndefined();
      expect(layout([singlePointFrame], 300, 300)[0].sparkline).toBeUndefined();
    });

    it('puts the name and the value at the vertical center of the cell', () => {
      const [cell] = layout([cpuFrame], 150, 100, valueAndName);
      const { title, value } = cell;
      const block = (title!.fontSize + value!.fontSize) * STAT_LINE_HEIGHT;
      expect(title!.y).toBeCloseTo(8 + (84 - block) / 2, 9);
      expect(value!.y).toBeCloseTo(title!.y + title!.fontSize * STAT_LINE_HEIGHT, 9);
    });
  });

  describe('wide layout', () => {
    it('is used when the cell is more than 2.5 times as wide as it is high', () => {
      const [wide] = layout([cpuFrame], 251, 100, valueAndName);
      const [stacked] = layout([cpuFrame], 250, 100, valueAndName);
      expect(wide.value!.align).toBe('right');
      expect(stacked.value!.align).toBe('left');
    });

    it('is not used when the wide layout option is off', () => {
      const [cell] = layout([cpuFrame], 600, 100, { ...valueAndName, wideLayout: false });
      expect(cell.value!.align).toBe('left');
    });

    it('puts the name at the left and the value at the right, at the vertical center, with no sparkline', () => {
      const [cell] = layout([cpuFrame], 600, 50, valueAndName);
      const { title, value } = cell;
      expect(cell.sparkline).toBeUndefined();
      expect(title).toMatchObject({ x: 8, align: 'left' });
      expect(value).toMatchObject({ x: 592, align: 'right' });
      expect(title!.y + (title!.fontSize * STAT_LINE_HEIGHT) / 2).toBeCloseTo(25, 9);
      expect(value!.y + (value!.fontSize * STAT_LINE_HEIGHT) / 2).toBeCloseTo(25, 9);
    });

    it('fits a value with no name to the height of the cell', () => {
      const [cell] = layout([cpuFrame], 1000, 50);
      expect(cell.value!.fontSize).toBeCloseTo(34 / STAT_LINE_HEIGHT, 9);
      expect(cell.value).toMatchObject({ x: 500, align: 'center' });
    });

    it('puts the texts at the top and the sparkline in the lower half, for a cell higher than 50px', () => {
      const [cell] = layout([cpuFrame], 600, 120, valueAndName);
      expect(cell.title!.y).toBe(12);
      expect(cell.value!.y).toBe(12);
      const ys = cell.sparkline!.segments.flat().map(([, y]) => y);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(60);
      expect(cell.sparkline!.baseline).toBe(120);
    });
  });

  describe('text sizes', () => {
    it('gives the name and the value the sizes that are set', () => {
      const [cell] = layout([cpuFrame], 300, 300, { ...valueAndName, titleSize: 22, valueSize: 40 });
      expect(cell.title!.fontSize).toBe(22);
      expect(cell.value!.fontSize).toBe(40);
    });

    it('fits the value when only the name has a set size, and does not limit the name to 70% of the value', () => {
      // A stacked cell with no sparkline.
      const [auto] = layout([cpuFrame], 200, 90, valueAndName);
      const [cell] = layout([cpuFrame], 200, 90, { ...valueAndName, titleSize: 60 });
      expect(cell.title!.fontSize).toBe(60);
      expect(cell.title!.fontSize).toBeGreaterThan(cell.value!.fontSize * 0.7);
      // The fit of the value does not subtract the height of a name with a set size, as in core.
      expect(cell.value!.fontSize).toBeGreaterThan(auto.value!.fontSize);
    });

    it('fits the name when only the value has a set size, to not more than 70% of that size', () => {
      // A stacked cell with no sparkline. The fit of the name to the cell gives more than 7px.
      const [cell] = layout([cpuFrame], 200, 90, { ...valueAndName, valueSize: 10 });
      expect(cell.value!.fontSize).toBe(10);
      expect(cell.title!.fontSize).toBeCloseTo(7);
    });

    it('gives the value the full width of a wide cell when the name has a set size', () => {
      const [auto] = layout([cpuFrame], 251, 40, valueAndName);
      const [cell] = layout([cpuFrame], 251, 40, { ...valueAndName, titleSize: 10 });
      expect(cell.title!.fontSize).toBe(10);
      expect(cell.value!.fontSize).toBeGreaterThanOrEqual(auto.value!.fontSize);
    });

    it('puts the value below the name, at the left, when the two do not fit side by side in a wide cell', () => {
      // The Jest canvas measures a text much narrower than a browser, so the cell is small and the sizes large.
      const [fits] = layout([cpuFrame], 60, 20, valueAndName);
      expect(fits.value!.align).toBe('right');

      const [cell] = layout([cpuFrame], 60, 20, { ...valueAndName, titleSize: 200, valueSize: 200 });
      const { title, value } = cell;
      expect(value).toMatchObject({ x: title!.x, align: 'left' });
      expect(value!.y).toBeGreaterThanOrEqual(title!.y + title!.fontSize * STAT_LINE_HEIGHT);
    });

    it('gives the sparkline of a stacked cell the space below texts of the set sizes', () => {
      const [cell] = layout([cpuFrame], 300, 300, { ...valueAndName, titleSize: 20, valueSize: 30 });
      const ys = cell.sparkline!.segments.flat().map(([, y]) => y);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual((20 + 30) * STAT_LINE_HEIGHT);
    });
  });

  describe('text alignment Center', () => {
    const centered = { ...valueAndName, justifyMode: BigValueJustifyMode.Center };
    const lineHeight = (text: { fontSize: number }) => text.fontSize * STAT_LINE_HEIGHT;

    it('puts the name above the value at the center of a stacked cell, with a gap between them', () => {
      const [cell] = layout([cpuFrame], 300, 300, centered);
      const { title, value } = cell;
      expect(title).toMatchObject({ x: 150, align: 'center' });
      expect(value).toMatchObject({ x: 150, align: 'center' });
      const gap = value!.y - (title!.y + lineHeight(title!));
      expect(gap).toBeGreaterThan(0);
      // The name, the gap and the value are one group at the vertical center of the cell.
      expect((title!.y + value!.y + lineHeight(value!)) / 2).toBeCloseTo(150);
    });

    it('keeps the font sizes and the sparkline of the automatic alignment', () => {
      const [auto] = layout([cpuFrame], 300, 300, valueAndName);
      const [center] = layout([cpuFrame], 300, 300, centered);
      expect(center.title!.fontSize).toBe(auto.title!.fontSize);
      expect(center.value!.fontSize).toBe(auto.value!.fontSize);
      expect(center.sparkline).toEqual(auto.sparkline);
    });

    it('puts the name and the value in one row at the center of a wide cell', () => {
      const [cell] = layout([cpuFrame], 600, 100, centered);
      const { title, value } = cell;
      expect(title!.align).toBe('left');
      expect(value!.align).toBe('left');
      expect(value!.x).toBeGreaterThan(title!.x);
      // The two texts have the same vertical center, which is the center of the cell.
      expect(title!.y + lineHeight(title!) / 2).toBeCloseTo(50);
      expect(value!.y + lineHeight(value!) / 2).toBeCloseTo(50);
      // The space at the left of the name is not the padding of the cell: the row is at the center.
      expect(title!.x).toBeGreaterThan(12);
    });

    it('puts the texts at the vertical center of a wide cell with a sparkline, and not at its top', () => {
      const [cell] = layout([cpuFrame], 600, 120, centered);
      expect(cell.sparkline).toBeDefined();
      expect(cell.value!.y + lineHeight(cell.value!) / 2).toBeCloseTo(60);
    });

    it('does not change a cell with no name, which is at the center in each alignment', () => {
      const auto = layout([cpuFrame], 300, 300, { textMode: BigValueTextMode.Value });
      const center = layout([cpuFrame], 300, 300, {
        textMode: BigValueTextMode.Value,
        justifyMode: BigValueJustifyMode.Center,
      });
      expect(center[0].title).toBeUndefined();
      expect(center[0].value).toEqual(auto[0].value);
    });
  });
});
