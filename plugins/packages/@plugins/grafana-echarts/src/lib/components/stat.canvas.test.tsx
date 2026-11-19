import { VizOrientation } from '@grafana/data';
import { BigValueColorMode, BigValueGraphMode, BigValueJustifyMode, BigValueTextMode } from '@grafana/schema';
import { normalizeCanvasEvents } from 'test/canvas';
import { height, width } from 'test/panel';
import {
  cpuFrame,
  defaultColorFrame,
  gapFrame,
  mappedFrame,
  renderStat,
  seriesFrame,
  singlePointFrame,
  thresholdsFrame,
} from 'test/statCanvas';

// Stat canvas snapshots: a case for each layout and for each editor option. Every test here is a snapshot
// test: the baseline is the assertion, and a reviewer reads it as an image.
//
// The claims about texts and counts are in `stat.integration.test.tsx`, and commit no baseline.
// See `test/statCanvas.tsx` for the harness and the fixtures. The harness panel is 400 x 300.

const valueAndName = { textMode: BigValueTextMode.ValueAndName };

describe('stat canvas snapshots', () => {
  describe('orientation', () => {
    // Three cells, one below the other, each as wide as the panel. The cells are wide and lower than 100px:
    // the name is at the left, the value is at the right, and the sparkline is in the lower half.
    it('Horizontal: one cell for each row of the panel', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([seriesFrame(3)], {
        orientation: VizOrientation.Horizontal,
      });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // Four cells side by side, each as high as the panel: the name is above the value, with a sparkline below.
    it('Vertical: one cell for each column of the panel', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([seriesFrame(4)], {
        orientation: VizOrientation.Vertical,
      });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });
  });

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
      const { defaultEvents, seriesEvents } = await renderStat([thresholdsFrame]);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // The field has thresholds and the default color scheme of the panel. The value 72 is above the threshold
    // of 60, so the value and the sparkline are orange.
    it('Value, with the default color scheme of the panel', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([defaultColorFrame]);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // The cell has a gradient of the red threshold color. The name and the value are light, and the sparkline
    // is a light line with a white area.
    it('Background Gradient', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([thresholdsFrame], {
        ...valueAndName,
        colorMode: BigValueColorMode.Background,
      });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // The cell has the red threshold color as one fill.
    it('Background Solid', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([thresholdsFrame], {
        ...valueAndName,
        colorMode: BigValueColorMode.BackgroundSolid,
      });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // Four cells with a gap between them. Each cell has the gradient of its own color.
    it('Background Gradient, four values in a grid', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([seriesFrame(4)], {
        colorMode: BigValueColorMode.Background,
      });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });
  });

  describe('percent change', () => {
    const withChange = { ...valueAndName, showPercentChange: true };

    // The series goes from 35 to 72: a green arrow up and "106%" are below the value.
    it('an increase, stacked with a sparkline', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], withChange);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // A wide cell: the name at the left, the value in the middle, and the percent change at the right.
    it('wide with no sparkline', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], withChange, undefined, { height: 50 });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height: 50 });
    });

    // Four cells. The series of two of them decrease: a red arrow down and a negative percent.
    it('four values in a grid, with the text alignment Center', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([seriesFrame(4)], {
        showPercentChange: true,
        justifyMode: BigValueJustifyMode.Center,
      });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // The text mode None: the cell shows only the percent change, as large as the cell permits.
    it('the text mode None', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], {
        textMode: BigValueTextMode.None,
        showPercentChange: true,
      });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });
  });

  describe('text size', () => {
    // The name is 40px and the value is 60px, and not the sizes that fit the cell. The sparkline has the
    // space below the two texts.
    it('a set size for the name and for the value', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], {
        ...valueAndName,
        text: { titleSize: 40, valueSize: 60 },
      });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // Four cells. Each value is 24px, and each name is fitted to not more than 70% of that size.
    it('a set size for the value only, four values in a grid', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([seriesFrame(4)], { text: { valueSize: 24 } });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });
  });

  describe('text alignment', () => {
    const centered = { ...valueAndName, justifyMode: BigValueJustifyMode.Center };

    // The name is above the value. The two are at the center of the cell, above the sparkline.
    it('Center, stacked with a sparkline', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], centered);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });

    // The name and the value are in one row at the center of the cell, with no sparkline.
    it('Center, wide with no sparkline', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([cpuFrame], centered, undefined, { height: 50 });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height: 50 });
    });

    // Four cells. Each cell has its name above its value at its center.
    it('Center, four values in a grid', async () => {
      const { defaultEvents, seriesEvents } = await renderStat([seriesFrame(4)], {
        justifyMode: BigValueJustifyMode.Center,
      });

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
