import { ThresholdsMode } from '@grafana/data';
import { normalizeCanvasEvents } from 'test/canvas';
import { gaugeFieldConfig, gaugeFrame, renderGauge } from 'test/gaugeCanvas';
import { height, width } from 'test/panel';

// Gauge canvas snapshots. Each case renders the real panel with the gauge family and pins the draw calls of the
// series layer. `modules/gauge/parity.md` names the case that pins each option.

const size = { width, height };
const oneValue = () => [gaugeFrame({ cpu: [10, 40, 72] })];
const fourValues = () => [gaugeFrame({ cpu: [72], memory: [35], disk: [91], network: [58] })];

describe('gauge canvas renders', () => {
  describe('shape', () => {
    it('arc (the default)', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge(oneValue());
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });

    it('circle', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge(oneValue(), { shape: 'circle' });
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });
  });

  describe('thresholds', () => {
    it('no threshold band', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge(oneValue(), { showThresholdMarkers: false });
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });

    it('percentage thresholds on a range that is not 0 to 100', async () => {
      const config = gaugeFieldConfig({
        min: 20,
        max: 60,
        thresholds: {
          mode: ThresholdsMode.Percentage,
          steps: [
            { value: -Infinity, color: 'blue' },
            { value: 50, color: 'red' },
          ],
        },
      });
      const { defaultEvents, seriesEvents } = await renderGauge([gaugeFrame({ temperature: [45] }, config)]);
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });
  });

  describe('value position', () => {
    it('at the minimum', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge([gaugeFrame({ cpu: [0] })]);
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });

    it('at the maximum', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge([gaugeFrame({ cpu: [100] })]);
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });

    it('above the maximum draws a full bar', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge([gaugeFrame({ cpu: [140] })]);
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });

    it('below the minimum draws an empty bar', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge([gaugeFrame({ cpu: [-20] })]);
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });

    it('no value draws the track only', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge([gaugeFrame({ cpu: [null] })]);
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });
  });

  describe('bar width', () => {
    it('thin bar', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge(oneValue(), { barWidthFactor: 0.1 });
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });

    it('wide bar', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge(oneValue(), { barWidthFactor: 1 });
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });
  });

  describe('text mode', () => {
    it('value and name', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge(oneValue(), { textMode: 'value_and_name' });
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });

    it('name', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge(oneValue(), { textMode: 'name' });
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });

    it('none', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge(oneValue(), { textMode: 'none' });
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });
  });

  describe('many values', () => {
    it('four gauges in a grid, with names', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge(fourValues());
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });

    it('four circles in a grid', async () => {
      const { defaultEvents, seriesEvents } = await renderGauge(fourValues(), { shape: 'circle' });
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });
  });

  describe('units', () => {
    it('percent unit uses the range 0 to 100', async () => {
      const config = gaugeFieldConfig({ min: undefined, max: undefined, unit: 'percent' });
      const { defaultEvents, seriesEvents } = await renderGauge([gaugeFrame({ load: [45, 55] }, config)]);
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, size);
    });
  });
});
