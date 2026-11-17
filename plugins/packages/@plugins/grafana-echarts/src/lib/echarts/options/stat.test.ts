import { type StatCell, type StatSparkline, type StatText, type StatValueText } from 'lib/grafana/stat/layout';
import {
  getStatCellElements,
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

describe('getStatCellElements', () => {
  it('puts the sparkline below the name and the value', () => {
    const types = getStatCellElements(cell({ title, value, sparkline }), FONT).map((element) => element.type);
    expect(types).toEqual(['polygon', 'polyline', 'text', 'text']);
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
