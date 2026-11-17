import { createDataFrame, FieldType, getPanelDataSummary, VisualizationSuggestionScore } from '@grafana/data';
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

const suggest = (...frames: Array<ReturnType<typeof createDataFrame>>) =>
  gaugeSuggestionsSupplier(getPanelDataSummary(frames));

describe('gaugeSuggestionsSupplier', () => {
  it('suggests an arc and a circle for a number field', () => {
    const result = suggest(numberFrame(1));
    expect(result?.map((suggestion) => suggestion.name)).toEqual(['Gauge', 'Circular gauge']);
    expect(result?.map((suggestion) => suggestion.options?.shape)).toEqual(['gauge', 'circle']);
    expect(result?.every((suggestion) => suggestion.options?.seriesType === 'gauge')).toBe(true);
  });

  it('scores OK, as core Gauge', () => {
    expect(suggest(numberFrame(3))?.every((suggestion) => suggestion.score === VisualizationSuggestionScore.OK)).toBe(
      true
    );
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

  it('does not draw the threshold band on a preview card', () => {
    const [card] = suggest(numberFrame(1))!;
    const preview = { options: { ...card.options } };
    card.cardOptions?.previewModifier?.(preview as never);
    expect(preview.options.showThresholdMarkers).toBe(false);
    expect(card.options?.showThresholdMarkers).toBeUndefined();
  });
});
