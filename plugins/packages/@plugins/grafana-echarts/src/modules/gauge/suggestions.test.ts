import {
  createDataFrame,
  DataFrameType,
  FieldColorModeId,
  FieldType,
  getPanelDataSummary,
  VisualizationSuggestionScore,
} from '@grafana/data';
import { GAUGE_MAX_VALUES } from 'lib/echarts/charts/suggestionLimits';
import { gaugeSuggestionsSupplier } from './suggestions';

const numberFrame = (fields: number) =>
  createDataFrame({
    fields: Array.from({ length: fields }, (_, index) => ({
      name: `value-${index}`,
      type: FieldType.number,
      values: [1, 2, 3],
    })),
  });

/** A table: a string field and a number field, with `rows` rows. */
const tableFrame = (rows: number) =>
  createDataFrame({
    fields: [
      { name: 'host', type: FieldType.string, values: Array.from({ length: rows }, (_, index) => `host-${index}`) },
      { name: 'load', type: FieldType.number, values: Array.from({ length: rows }, (_, index) => index) },
    ],
  });

const suggest = (...frames: Array<ReturnType<typeof createDataFrame>>) =>
  gaugeSuggestionsSupplier(getPanelDataSummary(frames));

describe('gaugeSuggestionsSupplier', () => {
  it('suggests an arc and a circle for a number field', () => {
    const result = suggest(numberFrame(1));
    expect(result?.map((suggestion) => suggestion.name)).toEqual(['Gauge', 'Circular gauge']);
    expect(result?.map((suggestion) => suggestion.options?.shape)).toEqual(['gauge', 'circle']);
    expect(result?.every((suggestion) => suggestion.options?.seriesType === 'gauge')).toBe(true);
  });

  it('scores OK for a frame with no numeric frame type, as core Gauge', () => {
    expect(suggest(numberFrame(3))?.every((suggestion) => suggestion.score === VisualizationSuggestionScore.OK)).toBe(
      true
    );
  });

  // https://grafana.com/developers/dataplane/numeric
  it.each([DataFrameType.NumericWide, DataFrameType.NumericLong, DataFrameType.NumericMulti])(
    'scores Good for the frame type %s, as core Gauge',
    (type) => {
      const frame = numberFrame(3);
      frame.meta = { type };
      expect(suggest(frame)?.map((suggestion) => suggestion.score)).toEqual([
        VisualizationSuggestionScore.Good,
        VisualizationSuggestionScore.Good,
      ]);
    }
  );

  it('gives one gauge for each number field with its last value, and no color mode', () => {
    for (const suggestion of suggest(numberFrame(2))!) {
      expect(suggestion.options?.reduceOptions).toEqual({ values: false, calcs: ['lastNotNull'] });
      expect(suggestion.fieldConfig).toEqual({ defaults: {}, overrides: [] });
    }
  });

  it('gives one gauge for each row of a small table, with the palette colors', () => {
    for (const suggestion of suggest(tableFrame(GAUGE_MAX_VALUES))!) {
      expect(suggestion.options?.reduceOptions).toEqual({ values: true, calcs: [] });
      expect(suggestion.fieldConfig?.defaults.color).toEqual({ mode: FieldColorModeId.PaletteClassic });
    }
  });

  it('reduces a table with more rows than the largest number of gauges, and two table frames', () => {
    const cases = [[tableFrame(GAUGE_MAX_VALUES + 1)], [tableFrame(2), tableFrame(2)]];
    for (const frames of cases) {
      for (const suggestion of suggest(...frames)!) {
        expect(suggestion.options?.reduceOptions).toEqual({ values: false, calcs: ['lastNotNull'] });
        expect(suggestion.fieldConfig?.defaults.color).toBeUndefined();
      }
    }
  });

  it('suggests a thin bar and no threshold band, as core Gauge', () => {
    for (const suggestion of suggest(numberFrame(1))!) {
      expect(suggestion.options?.barWidthFactor).toBe(0.3);
      expect(suggestion.options?.showThresholdMarkers).toBe(false);
    }
  });

  it('suggests up to the largest number of gauges, and not above it', () => {
    expect(suggest(numberFrame(GAUGE_MAX_VALUES))).toHaveLength(2);
    expect(suggest(numberFrame(GAUGE_MAX_VALUES + 1))).toBeUndefined();
  });

  it('suggests nothing for no data and for data with no number field', () => {
    expect(suggest()).toBeUndefined();
    expect(
      suggest(createDataFrame({ fields: [{ name: 'host', type: FieldType.string, values: ['a'] }] }))
    ).toBeUndefined();
  });

  it('keeps the options of the suggestion on a preview card', () => {
    const [card] = suggest(tableFrame(3))!;
    const preview = { options: { ...card.options } };
    card.cardOptions?.previewModifier?.(preview as never);
    expect(preview.options).toMatchObject({
      shape: 'gauge',
      barWidthFactor: 0.3,
      showThresholdMarkers: false,
      reduceOptions: { values: true, calcs: [] },
    });
  });
});
