import { createTheme, FieldColorModeId, type FieldConfigSource, FieldMatcherID } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';
import {
  applyLegendOverrides,
  changeSeriesColorConfig,
  getHiddenSeriesNames,
  getMarkPositionOverride,
  getSeriesColorOverride,
  readLegendOverrides,
  setMarkPositionsConfig,
  toggleSeriesVisibilityConfig,
} from 'lib/grafana/fields/seriesConfig';

const theme = createTheme();

const emptyConfig = (): FieldConfigSource => ({ defaults: {}, overrides: [] });

const names = ['cpu', 'mem', 'disk'];

describe('changeSeriesColorConfig', () => {
  it('adds a byName fixed color override', () => {
    const result = changeSeriesColorConfig(emptyConfig(), 'cpu', '#ff0000');

    expect(result.overrides).toEqual([
      {
        matcher: { id: FieldMatcherID.byName, options: 'cpu' },
        properties: [{ id: 'color', value: { mode: FieldColorModeId.Fixed, fixedColor: '#ff0000' } }],
      },
    ]);
  });

  it('replaces the color on an existing byName override, preserving other properties', () => {
    const config: FieldConfigSource = {
      defaults: {},
      overrides: [
        {
          matcher: { id: FieldMatcherID.byName, options: 'cpu' },
          properties: [
            { id: 'unit', value: 'bytes' },
            { id: 'color', value: { mode: FieldColorModeId.Fixed, fixedColor: '#000000' } },
          ],
        },
      ],
    };

    const result = changeSeriesColorConfig(config, 'cpu', '#00ff00');

    expect(result.overrides).toHaveLength(1);
    expect(result.overrides[0].properties).toEqual([
      { id: 'unit', value: 'bytes' },
      { id: 'color', value: { mode: FieldColorModeId.Fixed, fixedColor: '#00ff00' } },
    ]);
  });
});

describe('setMarkPositionsConfig', () => {
  const at = (name: string, x: number, y: number) => new Map([[name, { x, y }]]);

  it('writes both axes onto one byName override', () => {
    const result = setMarkPositionsConfig(emptyConfig(), at('gateway', 60, 150));

    expect(result.overrides).toEqual([
      {
        matcher: { id: FieldMatcherID.byName, options: 'gateway' },
        properties: [
          { id: 'custom.fixedX', value: 60 },
          { id: 'custom.fixedY', value: 150 },
        ],
      },
    ]);
  });

  // Dragging a node twice must move it, not accumulate two positions — and it must not
  // wipe whatever else the user configured on that mark.
  it('replaces an earlier position and preserves other properties', () => {
    const first = changeSeriesColorConfig(emptyConfig(), 'gateway', '#ff0000');
    const placed = setMarkPositionsConfig(first, at('gateway', 10, 20));

    const moved = setMarkPositionsConfig(placed, at('gateway', 30, 40));

    expect(moved.overrides).toHaveLength(1);
    expect(moved.overrides[0].properties).toEqual([
      { id: 'color', value: { mode: FieldColorModeId.Fixed, fixedColor: '#ff0000' } },
      { id: 'custom.fixedX', value: 30 },
      { id: 'custom.fixedY', value: 40 },
    ]);
  });

  /**
   * A graph drag writes the layout **as drawn** — every node, not just the one that moved —
   * because the unpinned ones are seeded around whichever nodes are pinned. Recording only
   * the dragged node re-seeds all its neighbours around it on the next render, which reads as
   * the graph rearranging itself. See `useRelationsPersistence`.
   */
  it('writes one override per mark in a single config', () => {
    const result = setMarkPositionsConfig(
      emptyConfig(),
      new Map([
        ['gateway', { x: 1, y: 2 }],
        ['api', { x: 3, y: 4 }],
      ])
    );

    expect(result.overrides.map((rule) => rule.matcher.options)).toEqual(['gateway', 'api']);
    expect(result.overrides[1].properties).toEqual([
      { id: 'custom.fixedX', value: 3 },
      { id: 'custom.fixedY', value: 4 },
    ]);
  });
});

/**
 * The by-name read, for a mark Grafana's override engine cannot reach: a relations node
 * derived from an edge's endpoints has no field, so `custom.fixedX` never lands on one.
 */
describe('getMarkPositionOverride', () => {
  it('round-trips a written position', () => {
    const config = setMarkPositionsConfig(emptyConfig(), new Map([['gateway', { x: 60, y: 150 }]]));

    expect(getMarkPositionOverride(config, 'gateway')).toEqual({ x: 60, y: 150 });
    expect(getMarkPositionOverride(config, 'api')).toBeUndefined();
  });

  // Half a pair lays the node out at `[NaN, NaN]` under `layout: 'none'` and takes every link
  // touching it with it, so a partial override is no position at all.
  it('ignores an override with only one axis', () => {
    const config: FieldConfigSource = {
      defaults: {},
      overrides: [
        {
          matcher: { id: FieldMatcherID.byName, options: 'gateway' },
          properties: [{ id: 'custom.fixedX', value: 60 }],
        },
      ],
    };

    expect(getMarkPositionOverride(config, 'gateway')).toBeUndefined();
  });

  it('ignores a non-numeric value', () => {
    const config: FieldConfigSource = {
      defaults: {},
      overrides: [
        {
          matcher: { id: FieldMatcherID.byName, options: 'gateway' },
          properties: [
            { id: 'custom.fixedX', value: '60' },
            { id: 'custom.fixedY', value: 150 },
          ],
        },
      ],
    };

    expect(getMarkPositionOverride(config, 'gateway')).toBeUndefined();
  });
});

describe('getSeriesColorOverride', () => {
  it('returns the fixed color for a name, or undefined', () => {
    const config = changeSeriesColorConfig(emptyConfig(), 'cpu', '#abcdef');

    expect(getSeriesColorOverride(config, 'cpu', theme)).toBe('#abcdef');
    expect(getSeriesColorOverride(config, 'mem', theme)).toBeUndefined();
  });

  it('resolves a named Grafana color to a CSS color', () => {
    const config = changeSeriesColorConfig(emptyConfig(), 'cpu', 'dark-red');

    expect(getSeriesColorOverride(config, 'cpu', theme)).toBe(theme.visualization.getColorByName('dark-red'));
    expect(getSeriesColorOverride(config, 'cpu', theme)).not.toBe('dark-red');
  });
});

describe('toggleSeriesVisibilityConfig', () => {
  it('isolates the clicked series on plain click (hides the rest)', () => {
    const result = toggleSeriesVisibilityConfig(
      emptyConfig(),
      'cpu',
      SeriesVisibilityChangeMode.ToggleSelection,
      names
    );

    expect(getHiddenSeriesNames(result, names)).toEqual(new Set(['mem', 'disk']));
  });

  it('writes a single hideSeriesFrom byNames-exclude system override (core shape)', () => {
    const result = toggleSeriesVisibilityConfig(
      emptyConfig(),
      'cpu',
      SeriesVisibilityChangeMode.ToggleSelection,
      names
    );

    expect(result.overrides).toEqual([
      {
        __systemRef: 'hideSeriesFrom',
        matcher: {
          id: FieldMatcherID.byNames,
          options: { mode: 'exclude', names: ['cpu'], prefix: 'All except:', readOnly: true },
        },
        properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: true } }],
      },
    ]);
  });

  it('restores all series when clicking the already-isolated series', () => {
    const isolated = toggleSeriesVisibilityConfig(
      emptyConfig(),
      'cpu',
      SeriesVisibilityChangeMode.ToggleSelection,
      names
    );

    const restored = toggleSeriesVisibilityConfig(isolated, 'cpu', SeriesVisibilityChangeMode.ToggleSelection, names);

    expect(restored.overrides).toEqual([]);
    expect(getHiddenSeriesNames(restored, names)).toEqual(new Set());
  });

  it('re-isolates a different series on plain click (replaces the override)', () => {
    const isolatedCpu = toggleSeriesVisibilityConfig(
      emptyConfig(),
      'cpu',
      SeriesVisibilityChangeMode.ToggleSelection,
      names
    );

    const isolatedMem = toggleSeriesVisibilityConfig(
      isolatedCpu,
      'mem',
      SeriesVisibilityChangeMode.ToggleSelection,
      names
    );

    expect(isolatedMem.overrides).toHaveLength(1);
    expect(getHiddenSeriesNames(isolatedMem, names)).toEqual(new Set(['cpu', 'disk']));
  });

  it('toggles a single series on append (ctrl/cmd click)', () => {
    const hidden = toggleSeriesVisibilityConfig(
      emptyConfig(),
      'mem',
      SeriesVisibilityChangeMode.AppendToSelection,
      names
    );
    expect(getHiddenSeriesNames(hidden, names)).toEqual(new Set(['mem']));

    const shown = toggleSeriesVisibilityConfig(hidden, 'mem', SeriesVisibilityChangeMode.AppendToSelection, names);
    expect(getHiddenSeriesNames(shown, names)).toEqual(new Set());
  });

  it('preserves unrelated color overrides when toggling visibility', () => {
    const withColor = changeSeriesColorConfig(emptyConfig(), 'cpu', '#ff0000');

    const result = toggleSeriesVisibilityConfig(withColor, 'mem', SeriesVisibilityChangeMode.AppendToSelection, names);

    expect(getSeriesColorOverride(result, 'cpu', theme)).toBe('#ff0000');
    expect(getHiddenSeriesNames(result, names)).toEqual(new Set(['mem']));
  });
});

describe('readLegendOverrides and applyLegendOverrides', () => {
  const specColor = changeSeriesColorConfig(emptyConfig(), 'cpu', '#111111');
  const hideMem = (config: FieldConfigSource) =>
    toggleSeriesVisibilityConfig(config, 'mem', SeriesVisibilityChangeMode.AppendToSelection, names);

  it('reads no change when the legend changed nothing', () => {
    expect(readLegendOverrides(specColor, specColor)).toEqual({ hide: undefined, colors: new Map() });
  });

  it('reads the visibility change and the color change of the legend, and not the overrides of the viz spec', () => {
    const next = hideMem(changeSeriesColorConfig(specColor, 'mem', '#222222'));
    const legend = readLegendOverrides(next, specColor);
    expect([...legend.colors.keys()]).toEqual(['mem']);
    expect(legend.hide).toBeDefined();
    const applied = applyLegendOverrides(specColor, legend);
    expect(getHiddenSeriesNames(applied, names)).toEqual(new Set(['mem']));
    expect(getSeriesColorOverride(applied, 'cpu', theme)).toBe('#111111');
    expect(getSeriesColorOverride(applied, 'mem', theme)).toBe('#222222');
  });

  it('reads that the user showed each series, also when the viz spec hides some', () => {
    const specHides = hideMem(emptyConfig());
    const legend = readLegendOverrides(hideMem(specHides), specHides);
    expect(legend.hide).toBeNull();
    expect(getHiddenSeriesNames(applyLegendOverrides(specHides, legend), names)).toEqual(new Set());
  });

  it('gives the legend changes priority over the overrides of the viz spec', () => {
    const legend = readLegendOverrides(
      hideMem(changeSeriesColorConfig(emptyConfig(), 'cpu', '#222222')),
      emptyConfig()
    );
    // A new viz spec hides `disk` and gives `cpu` another color.
    const newSpec = changeSeriesColorConfig(
      toggleSeriesVisibilityConfig(emptyConfig(), 'disk', SeriesVisibilityChangeMode.AppendToSelection, names),
      'cpu',
      '#333333'
    );
    const applied = applyLegendOverrides(newSpec, legend);
    expect(getHiddenSeriesNames(applied, names)).toEqual(new Set(['mem']));
    expect(getSeriesColorOverride(applied, 'cpu', theme)).toBe('#222222');
  });
});
