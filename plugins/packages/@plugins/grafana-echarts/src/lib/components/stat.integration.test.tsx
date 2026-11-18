import { type DataFrame, LoadingState } from '@grafana/data';
import { BigValueGraphMode, BigValueTextMode } from '@grafana/schema';
import { render } from '@testing-library/react';
import { getComponent, getSeriesCanvasEvents } from 'test/panel';
import { cpuFrame, drawnTexts, renderStat, seriesFrame, singlePointFrame, statCanvasOptions } from 'test/statCanvas';

// Stat integration tests: claims about what the panel draws, with no baseline. The pictures are in
// `stat.canvas.test.tsx`.

const strokeCount = (events: Array<{ type: string }>) => events.filter((event) => event.type === 'stroke').length;

describe('stat panel', () => {
  it('draws the last value of the series, with its unit', async () => {
    const { seriesEvents } = await renderStat([cpuFrame]);
    expect(drawnTexts(seriesEvents).join('')).toBe('72%');
  });

  it('draws the name of each value when the panel has more than one value', async () => {
    const { seriesEvents } = await renderStat([seriesFrame(2)]);
    expect(drawnTexts(seriesEvents)).toEqual(expect.arrayContaining(['server-1', 'server-2']));
  });

  it('draws no name for one value when the panel has a title', async () => {
    const { seriesEvents } = await renderStat([cpuFrame]);
    expect(drawnTexts(seriesEvents)).not.toContain('cpu');
  });

  it('draws the name of one value when the panel has no title', async () => {
    const { seriesEvents } = await renderStat([cpuFrame], {}, undefined, { title: '' });
    expect(drawnTexts(seriesEvents)).toContain('cpu');
  });

  it('draws only the name in the Name text mode', async () => {
    const { seriesEvents } = await renderStat([cpuFrame], { textMode: BigValueTextMode.Name });
    expect(drawnTexts(seriesEvents)).toEqual(['cpu']);
  });

  it('draws no text in the None text mode', async () => {
    const { seriesEvents } = await renderStat([cpuFrame], { textMode: BigValueTextMode.None });
    expect(drawnTexts(seriesEvents)).toEqual([]);
  });

  it('draws one sparkline line for each value', async () => {
    const { seriesEvents } = await renderStat([seriesFrame(2)]);
    expect(strokeCount(seriesEvents)).toBe(2);
  });

  it('draws no sparkline when the graph mode is None', async () => {
    const { seriesEvents } = await renderStat([cpuFrame], { graphMode: BigValueGraphMode.None });
    expect(strokeCount(seriesEvents)).toBe(0);
  });

  it('draws no sparkline for a series with one row', async () => {
    const { seriesEvents } = await renderStat([singlePointFrame]);
    expect(strokeCount(seriesEvents)).toBe(0);
    expect(drawnTexts(seriesEvents).join('')).toBe('35');
  });

  it('draws the last value of each update while the data streams', async () => {
    const component = (frames: DataFrame[]) =>
      getComponent(frames, 'stat', statCanvasOptions(), { state: LoadingState.Streaming }, undefined, 'stat');
    const { container, rerender } = render(component([singlePointFrame]));
    expect(drawnTexts((await getSeriesCanvasEvents(container)).seriesEvents).join('')).toBe('35');

    rerender(component([cpuFrame]));
    expect(drawnTexts((await getSeriesCanvasEvents(container)).seriesEvents).join('')).toBe('72%');
  });

  it.each([50, 200])('draws the name of each of %s values, and no name is cut', async (count) => {
    const { seriesEvents } = await renderStat([seriesFrame(count)]);
    const names = Array.from({ length: count }, (_, index) => `server-${index + 1}`);
    expect(drawnTexts(seriesEvents)).toEqual(expect.arrayContaining(names));
  });
});
