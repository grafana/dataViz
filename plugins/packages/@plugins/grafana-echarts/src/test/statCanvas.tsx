import { type DataFrame, type FieldConfigSource, FieldType, type PanelProps, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { SERIES_ZLEVEL } from 'test/canvas';
import { getComponent, getSeriesCanvasEvents } from 'test/panel';
import { type PanelOptions } from 'types';

/**
 * Render harness and fixtures shared by the stat family's canvas and integration suites.
 *
 * The series is on `SERIES_ZLEVEL`, so the suites read only the draw calls of the series layer. The panel has
 * no axis, so the default layer has nothing. `getSeriesCanvasEvents` records one forced repaint.
 */
export const statCanvasOptions = (extra: Partial<PanelOptions> = {}): Partial<PanelOptions> => ({
  zLevel: { series: SERIES_ZLEVEL },
  animation: { enabled: false },
  ...extra,
});

export const renderStat = async (
  frames: DataFrame[],
  options: Partial<PanelOptions> = {},
  fieldConfig?: FieldConfigSource,
  panelProps?: Partial<PanelProps<PanelOptions>>
) => {
  const { container } = render(
    getComponent(frames, 'stat', statCanvasOptions(options), undefined, panelProps, 'stat', fieldConfig)
  );
  return getSeriesCanvasEvents(container);
};

const TIMES = [1783137094497, 1783140694497, 1783144294497, 1783147894497];

/** One series over time: the base case. The panel shows the last value, 72, and a sparkline. */
export const cpuFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: TIMES },
    { name: 'cpu', type: FieldType.number, values: [35, 52, 48, 72], config: { unit: 'percent' } },
  ],
});

/** `count` series over time, each in one field of one wide frame. */
export const seriesFrame = (count: number) =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: TIMES },
      ...Array.from({ length: count }, (_, index) => ({
        name: `server-${index + 1}`,
        type: FieldType.number,
        values: TIMES.map((_, row) => 10 + index * 7 + row * (index % 2 === 0 ? 4 : -2)),
      })),
    ],
  });

/** A series with one row. A sparkline needs two points, so the cell has none. */
export const singlePointFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [TIMES[0]] },
    { name: 'cpu', type: FieldType.number, values: [35] },
  ],
});

/** A series with a null in the middle. The sparkline has a gap there. */
export const gapFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [...TIMES, TIMES[3] + 3600000, TIMES[3] + 7200000] },
    { name: 'cpu', type: FieldType.number, values: [35, 52, null, null, 48, 72] },
  ],
});

/** The texts that the series layer draws, in paint order. */
export const drawnTexts = (events: Array<{ type: string; props?: Record<string, unknown> }>) =>
  events.filter((event) => event.type === 'fillText').map((event) => String(event.props?.text));
