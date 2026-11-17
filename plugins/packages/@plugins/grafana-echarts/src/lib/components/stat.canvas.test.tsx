import { type FieldConfigSource, ThresholdsMode } from '@grafana/data';
import { BigValueColorMode, BigValueGraphMode, BigValueTextMode } from '@grafana/schema';
import { normalizeCanvasEvents } from 'test/canvas';
import { height, width } from 'test/panel';
import { cpuFrame, gapFrame, mappedFrame, renderStat, seriesFrame, singlePointFrame } from 'test/statCanvas';

// Stat canvas snapshots: a case for each layout and for each editor option. Every test here is a snapshot
// test: the baseline is the assertion, and a reviewer reads it as an image.
//
// The claims about texts and counts are in `stat.integration.test.tsx`, and commit no baseline.
// See `test/statCanvas.tsx` for the harness and the fixtures. The harness panel is 400 x 300.

const valueAndName = { textMode: BigValueTextMode.ValueAndName };

describe('stat canvas snapshots', () => {
  describe('layouts', () => {
    // One value with no name: the value at the center, and the sparkline in the space below the text.
    it('one value, stacked with a sparkline', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame]);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // The name at the top left, the value below it.
    it('one value with its name, stacked with a sparkline', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], valueAndName);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // Four cells of 198.5 x 148.5 in a 2 x 2 grid: stacked, each with its name and a sparkline.
    it('four values in a grid', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([seriesFrame(4)]);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // Twelve cells of less than 100px height: stacked, with no sparkline.
    it('twelve values in a grid, with no space for sparklines', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([seriesFrame(12)]);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // A cell more than 2.5 times as wide as high, and higher than 50px: the name at the left, the value at
    // the right, and the sparkline in the lower half.
    it('wide with a sparkline', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], valueAndName, undefined, { height: 120 });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height: 120 });
    });

    // A wide cell that is not higher than 50px has no sparkline.
    it('wide with no sparkline', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], valueAndName, undefined, { height: 50 });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height: 50 });
    });

    // The same wide cell with the wide layout off: the name above the value.
    it('wide layout off', async () => {
      const { defaultEvents, seriesEvents } = await renderStat(
        [cpuFrame],
        { ...valueAndName, wideLayout: false },
        undefined,
        { height: 120 }
      );

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height: 120 });
    });
  });

  describe('text mode', () => {
    it('Name: the name as the large text', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], { textMode: BigValueTextMode.Name });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    it('None: the sparkline only', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], { textMode: BigValueTextMode.None });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });
  });

  describe('color mode', () => {
    // The value has the text color of the theme. The sparkline keeps the color of the value.
    it('None', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], { colorMode: BigValueColorMode.None });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // The value 72 is above the threshold of 60, so the value and the sparkline are red.
    it('Value, with the color of a threshold', async () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          thresholds: {
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 60, color: 'red' },
            ],
          },
        },
        overrides: [],
      };
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], {}, fieldConfig);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });
  });

  describe('value mappings', () => {
    // The value 72 has a mapping: the panel draws the mapped text, and the text and the sparkline are red.
    it('a mapped text in the color of the mapping', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([mappedFrame]);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });
  });

  describe('graph mode', () => {
    it('None: the value at the center, with no sparkline', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], { graphMode: BigValueGraphMode.None });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });
  });

  describe('sparkline data', () => {
    // Two nulls in the middle of the series: two lines with a gap between them.
    it('a gap for null values', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([gapFrame]);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // A sparkline needs two rows.
    it('a series with one row', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([singlePointFrame]);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });
  });
});
