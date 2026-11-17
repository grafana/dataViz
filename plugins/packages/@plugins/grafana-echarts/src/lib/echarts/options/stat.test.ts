import { type StatCell, type StatSparkline, type StatText, type StatValueText } from 'lib/grafana/stat/layout';
import {
  getStatBackgroundElement,
  getStatCellElements,
  getStatPercentChangeElements,
  getStatSeries,
  getStatSparklineElements,
  getStatTitleElement,
  getStatValueElement,
} from './stat';

const FONT = 'Inter, sans-serif';

const title: StatText = {
  text: 'cpu',
  x: 12,
  y: 12,
  align: 'left',
  fontSize: 20,
  fontWeight: 400,
  color: '#ccc',
  maxWidth: 200,
};
const value: StatValueText = {
  text: '72',
  x: 12,
  y: 36,
  align: 'left',
  fontSize: 40,
  fontWeight: 500,
  color: '#73bf69',
  maxWidth: 200,
  suffixFontSize: 24,
};
const sparkline: StatSparkline = {
  segments: [
    [
      [0, 80],
      [50, 60],
      [100, 70],
    ],
  ],
  baseline: 100,
  lineColor: '#73bf69',
  fillColor: 'rgba(115, 191, 105, 0.2)',
};
const cell = (parts: Partial<StatCell> = {}) =>
  ({ x: 0, y: 0, width: 100, height: 100, display: {}, ...parts }) as StatCell;

describe('getStatTitleElement', () => {
  it('is a text at the position of the name, cut at its largest width', () => {
    expect(getStatTitleElement(title, FONT)).toMatchObject({
      type: 'text',
      style: {
        text: 'cpu',
        x: 12,
        y: 12,
        align: 'left',
        verticalAlign: 'top',
        fill: '#ccc',
        fontFamily: FONT,
        fontSize: 20,
        fontWeight: 400,
        lineHeight: 24,
        width: 200,
        overflow: 'truncate',
      },
    });
  });
});

describe('getStatValueElement', () => {
  it('is a plain text when the value has no suffix', () => {
    const element = getStatValueElement(value, FONT);
    expect(element).toMatchObject({
      type: 'text',
      style: { text: '72', fontSize: 40, fontWeight: 500, lineHeight: 48 },
    });
    expect(element).not.toHaveProperty('style.rich');
  });

  it('is a rich text with a smaller suffix on the baseline of the value', () => {
    expect(getStatValueElement({ ...value, suffix: '%' }, FONT)).toMatchObject({
      type: 'text',
      style: {
        text: '{value|72}{suffix|%}',
        x: 12,
        y: 36,
        rich: {
          value: { fontSize: 40, fill: '#73bf69', verticalAlign: 'bottom' },
          suffix: { fontSize: 24, fill: '#73bf69', verticalAlign: 'bottom', padding: [0, 0, 4, 0] },
        },
      },
    });
  });

  it.each(['{', '}', '|'])('is a plain text when the value or the suffix has the rich text character %s', (char) => {
    const inValue = getStatValueElement({ ...value, text: `7${char}2`, suffix: '%' }, FONT);
    const inSuffix = getStatValueElement({ ...value, suffix: char }, FONT);
    expect(inValue).toMatchObject({ style: { text: `7${char}2%` } });
    expect(inSuffix).toMatchObject({ style: { text: `72${char}` } });
    expect(inValue).not.toHaveProperty('style.rich');
  });
});

describe('getStatSparklineElements', () => {
  it('gives the area down to the baseline, then the line, for each segment', () => {
    expect(getStatSparklineElements(sparkline)).toMatchObject([
      {
        type: 'polygon',
        shape: {
          points: [
            [0, 80],
            [50, 60],
            [100, 70],
            [100, 100],
            [0, 100],
          ],
        },
        style: { fill: 'rgba(115, 191, 105, 0.2)' },
      },
      { type: 'polyline', shape: { points: sparkline.segments[0] }, style: { stroke: '#73bf69', lineWidth: 1 } },
    ]);
  });

  it('draws nothing for a segment of one point', () => {
    expect(getStatSparklineElements({ ...sparkline, segments: [[[0, 80]]] })).toEqual([]);
  });
});

describe('getStatBackgroundElement', () => {
  const line = { start: [3, -6] as [number, number], end: [97, 106] as [number, number] };

  it('is a rectangle of the size of the cell, with one color as a solid fill', () => {
    expect(getStatBackgroundElement(cell({ x: 10, y: 20 }), { ...line, colors: ['#f00'] })).toEqual({
      type: 'rect',
      silent: true,
      shape: { x: 10, y: 20, width: 100, height: 100 },
      style: { fill: '#f00' },
    });
  });

  it('fills with a linear gradient in canvas pixels for two colors', () => {
    const element = getStatBackgroundElement(cell(), { ...line, colors: ['#f00', '#00f'] });
    expect(element).toMatchObject({
      style: {
        fill: {
          type: 'linear',
          global: true,
          x: 3,
          y: -6,
          x2: 97,
          y2: 106,
          colorStops: [
            { offset: 0, color: '#f00' },
            { offset: 1, color: '#00f' },
          ],
        },
      },
    });
  });
});

describe('getStatPercentChangeElements', () => {
  const text: StatText = { ...title, text: '106%', x: 40, color: '#73bf69', fontWeight: 500 };

  it('is the arrow in the square of the icon, then the text, in one color', () => {
    const [arrow, label] = getStatPercentChangeElements(
      { text, icon: { direction: 'up', x: 12, y: 14, size: 20 } },
      FONT
    );
    expect(arrow).toMatchObject({
      type: 'path',
      shape: { x: 12, y: 14, width: 20, height: 20, layout: 'center' },
      style: { fill: '#73bf69' },
    });
    expect(label).toMatchObject({ type: 'text', style: { text: '106%', x: 40, fill: '#73bf69', fontWeight: 500 } });
  });

  it('has a different arrow for a decrease', () => {
    const path = (direction: 'up' | 'down') =>
      getStatPercentChangeElements({ text, icon: { direction, x: 0, y: 0, size: 20 } }, FONT)[0];
    expect(path('down')).not.toEqual(path('up'));
  });

  it('is only the text for a percent change with no arrow', () => {
    expect(getStatPercentChangeElements({ text }, FONT).map((element) => element.type)).toEqual(['text']);
  });
});

describe('getStatCellElements', () => {
  it('puts the percent change above all other parts', () => {
    const percentChange = { text: title, icon: { direction: 'up' as const, x: 0, y: 0, size: 10 } };
    const types = getStatCellElements(cell({ title, value, sparkline, percentChange }), FONT).map(
      (element) => element.type
    );
    expect(types).toEqual(['polygon', 'polyline', 'text', 'text', 'path', 'text']);
  });

  it('puts the sparkline below the name and the value', () => {
    const types = getStatCellElements(cell({ title, value, sparkline }), FONT).map((element) => element.type);
    expect(types).toEqual(['polygon', 'polyline', 'text', 'text']);
  });

  it('puts the background below all other parts', () => {
    const background = {
      start: [0, 0] as [number, number],
      end: [100, 100] as [number, number],
      colors: ['#f00'] as [string],
    };
    const types = getStatCellElements(cell({ background, title, value, sparkline }), FONT).map(
      (element) => element.type
    );
    expect(types).toEqual(['rect', 'polygon', 'polyline', 'text', 'text']);
  });

  it('gives no element for a cell with no part', () => {
    expect(getStatCellElements(cell(), FONT)).toEqual([]);
  });
});

describe('getStatSeries', () => {
  const api = (width: number, height: number) =>
    ({ getWidth: () => width, getHeight: () => height }) as Parameters<
      NonNullable<ReturnType<typeof getStatSeries>['renderItem']>
    >[1];
  const params = (dataIndex: number) =>
    ({ dataIndex }) as Parameters<NonNullable<ReturnType<typeof getStatSeries>['renderItem']>>[0];

  it('is a custom series with no coordinate system and one data item for each value', () => {
    const series = getStatSeries({ count: 3, layout: () => [], fontFamily: FONT, zlevel: 2 });
    expect(series).toMatchObject({ type: 'custom', coordinateSystem: 'none', zlevel: 2, data: [0, 1, 2] });
  });

  it('draws each cell from the layout for the size of the chart', () => {
    const layout = jest.fn((width: number) => [cell({ title: { ...title, x: width } }), cell({ value })]);
    const { renderItem } = getStatSeries({ count: 2, layout, fontFamily: FONT });

    expect(renderItem!(params(0), api(400, 300))).toMatchObject({
      type: 'group',
      children: [{ type: 'text', style: { text: 'cpu', x: 400 } }],
    });
    expect(renderItem!(params(1), api(400, 300))).toMatchObject({ children: [{ style: { text: '72' } }] });
    expect(layout).toHaveBeenCalledWith(400, 300);
  });

  it('makes the layout one time for a size, and again for a new size', () => {
    const layout = jest.fn(() => [cell({ value }), cell({ value })]);
    const { renderItem } = getStatSeries({ count: 2, layout, fontFamily: FONT });

    renderItem!(params(0), api(400, 300));
    renderItem!(params(1), api(400, 300));
    expect(layout).toHaveBeenCalledTimes(1);

    renderItem!(params(0), api(500, 300));
    expect(layout).toHaveBeenCalledTimes(2);
  });

  it('draws nothing for a data item with no cell', () => {
    const { renderItem } = getStatSeries({ count: 1, layout: () => [], fontFamily: FONT });
    expect(renderItem!(params(0), api(0, 0))).toBeUndefined();
  });
});
