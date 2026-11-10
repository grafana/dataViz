import { type FieldConfigSource, FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getComponent, getSeriesCanvasEvents, height, width } from 'test/panel';
import { type PanelOptions } from 'types';

// Multivariate canvas snapshots, mirroring `part-to-whole.canvas.test.tsx`.
// Both render types share the multivariate model — each number field is one
// `parallelAxis` / radar indicator, each row one polyline / polygon (colored by
// the row's palette color) — so they share the render options below and
// differ only in the seriesType the panel resolves. Most cases exercise
// parallel, whose options are the richer set; the radar block at the bottom
// covers the other branch. Series are placed on SERIES_ZLEVEL, so only that
// series-layer draw call set is committed (the axes paint on the default layer);
// see `Panel.canvas.test.tsx` for the layered-capture rationale.
//
// Rendered in Advanced editor mode so the advanced options these tests exercise
// (layout, line width/opacity) are respected as-is. In Default mode
// `applyParallelEditorModeDefaults` resets every advanced option to its default —
// including forcing `animation.enabled` back on, which would clobber the
// `animation: { enabled: false }` these snapshots rely on for determinism. The
// Default-mode reset itself is covered by the `applyParallelEditorModeDefaults`
// unit tests.
const canvasOptions = (extra: Partial<PanelOptions> = {}): Partial<PanelOptions> => ({
  zLevel: { series: SERIES_ZLEVEL },
  animation: { enabled: false },
  editorMode: 'advanced',
  ...extra,
});

const renderParallel = async (
  frames: Parameters<typeof getComponent>[0],
  options: Partial<PanelOptions> = {},
  fieldConfig?: FieldConfigSource,
  panelWidth = width
) => {
  const { container } = render(
    getComponent(
      frames,
      'parallel',
      canvasOptions(options),
      undefined,
      { width: panelWidth },
      'multivariate',
      fieldConfig
    )
  );
  return getSeriesCanvasEvents(container);
};

describe('multivariate (parallel) canvas renders', () => {
  // Each number field is one axis; each row is one polyline crossing them.
  const teamsFrame = toDataFrame({
    fields: [
      { name: 'team', type: FieldType.string, values: ['Team A', 'Team B', 'Team C'] },
      { name: 'Speed', type: FieldType.number, values: [80, 60, 70] },
      { name: 'Power', type: FieldType.number, values: [70, 90, 50] },
      { name: 'Range', type: FieldType.number, values: [60, 50, 85] },
      { name: 'Durability', type: FieldType.number, values: [90, 70, 60] },
    ],
  });

  describe('base', () => {
    // One axis per number field, one polyline per row — the default render the
    // other cases build on.
    it('one axis per number field, one polyline per row', async () => {
      const { defaultEvents, seriesEvents } = await renderParallel([teamsFrame]);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, {
        width,
        height,
      });
    });
  });

  describe('smooth', () => {
    // The Default-tier "Smooth" toggle curves each polyline through its axis
    // crossings (ECharts `series.smooth`) instead of straight segments.
    it('curves the polylines through the axis crossings', async () => {
      const { defaultEvents, seriesEvents } = await renderParallel([teamsFrame], { parallelSmooth: true });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, {
        width,
        height,
      });
    });
  });

  describe('layout', () => {
    // Vertical layout stacks the axes top-to-bottom (ECharts `parallel.layout`),
    // so the polylines run down the panel; the default horizontal is covered above.
    it('vertical (axes top-to-bottom)', async () => {
      const { defaultEvents, seriesEvents } = await renderParallel([teamsFrame], { parallelLayout: 'vertical' });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, {
        width,
        height,
      });
    });
  });

  describe('line style', () => {
    // Advanced `series.lineStyle.width`: thicker polylines.
    it('line width', async () => {
      const { defaultEvents, seriesEvents } = await renderParallel([teamsFrame], { parallelLineWidth: 4 });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, {
        width,
        height,
      });
    });

    // Advanced `series.lineStyle.opacity` (0–100 scaled to 0–1): translucent
    // polylines to de-clutter dense bundles.
    it('line opacity', async () => {
      const { defaultEvents, seriesEvents } = await renderParallel([teamsFrame], { parallelLineOpacity: 50 });

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, {
        width,
        height,
      });
    });
  });

  describe('color', () => {
    // A byName fixed-color override pins line 'Team B'. It names a row, so the
    // chart reads it from the `fieldConfig` by name, as pie slices do.
    it('byName fixed-color override', async () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {},
        overrides: [
          {
            matcher: { id: 'byName', options: 'Team B' },
            properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
          },
        ],
      };
      const { defaultEvents, seriesEvents } = await renderParallel([teamsFrame], {}, fieldConfig);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, {
        width,
        height,
      });
    });
  });

  // Issue #782: long axis names in a narrow panel stay inside the canvas.
  describe('narrow panel, long axis names', () => {
    const narrowWidth = 240;
    const hostsFrame = toDataFrame({
      fields: [
        { name: 'host', type: FieldType.string, values: ['web-01', 'db-01'] },
        { name: 'CPU %', type: FieldType.number, values: [62, 81] },
        { name: 'Memory %', type: FieldType.number, values: [71, 88] },
        { name: 'Disk %', type: FieldType.number, values: [34, 77] },
        { name: 'Network Mbit/s', type: FieldType.number, values: [410, 220] },
      ],
    });

    it('horizontal', async () => {
      const { defaultEvents, seriesEvents } = await renderParallel([hostsFrame], {}, undefined, narrowWidth);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, {
        width: narrowWidth,
        height,
      });
    });

    it('vertical', async () => {
      const { defaultEvents, seriesEvents } = await renderParallel(
        [hostsFrame],
        { parallelLayout: 'vertical' },
        undefined,
        narrowWidth
      );

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, {
        width: narrowWidth,
        height,
      });
    });
  });

  describe('edge cases', () => {
    // One row → a single polyline across the axes.
    it('single line (one row)', async () => {
      const singleFrame = toDataFrame({
        fields: [
          { name: 'team', type: FieldType.string, values: ['Team A'] },
          { name: 'Speed', type: FieldType.number, values: [80] },
          { name: 'Power', type: FieldType.number, values: [70] },
          { name: 'Range', type: FieldType.number, values: [60] },
          { name: 'Durability', type: FieldType.number, values: [90] },
        ],
      });

      const { defaultEvents, seriesEvents } = await renderParallel([singleFrame]);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, {
        width,
        height,
      });
    });

    // A null value leaves a gap on that axis rather than plotting a zero, so the
    // polyline breaks there.
    it('null gap (a missing value breaks the polyline)', async () => {
      const gapFrame = toDataFrame({
        fields: [
          { name: 'team', type: FieldType.string, values: ['Team A', 'Team B'] },
          { name: 'Speed', type: FieldType.number, values: [80, 60] },
          { name: 'Power', type: FieldType.number, values: [null, 90] },
          { name: 'Range', type: FieldType.number, values: [60, 50] },
          { name: 'Durability', type: FieldType.number, values: [90, 70] },
        ],
      });

      const { defaultEvents, seriesEvents } = await renderParallel([gapFrame]);

      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, {
        width,
        height,
      });
    });
  });
});

// The family's other render type, over the same frames. Radar's web size is a
// percentage of the canvas rather than a layout box (see `getRadarComponent`),
// so the polygon vertices in this snapshot are what pins the radius down —
// there is no axis-layer geometry to assert against.
describe('multivariate (radar) canvas renders', () => {
  const teamsFrame = toDataFrame({
    fields: [
      { name: 'team', type: FieldType.string, values: ['Team A', 'Team B'] },
      { name: 'Speed', type: FieldType.number, values: [80, 60] },
      { name: 'Power', type: FieldType.number, values: [70, 90] },
      { name: 'Range', type: FieldType.number, values: [60, 50] },
      { name: 'Durability', type: FieldType.number, values: [90, 70] },
    ],
  });

  it('one polygon per row, filling the canvas', async () => {
    const { container } = render(
      getComponent([teamsFrame], 'radar', canvasOptions(), undefined, undefined, 'multivariate', undefined)
    );
    const { defaultEvents, seriesEvents } = await getSeriesCanvasEvents(container);

    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, {
      width,
      height,
    });
  });
});
