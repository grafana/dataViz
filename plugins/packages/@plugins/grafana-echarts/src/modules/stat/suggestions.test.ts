import { createDataFrame, FieldType, getPanelDataSummary, VisualizationSuggestionScore } from '@grafana/data';
import { STAT_MAX_VALUES, STAT_PREVIEW_MAX_SERIES } from 'lib/echarts/charts/suggestionLimits';
import { statSuggestionsSupplier } from './suggestions';

const timeFrame = (numericFields: number) =>
  createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
      ...Array.from({ length: numericFields }, (_, index) => ({
        name: `value-${index}`,
        type: FieldType.number,
        values: [1, 2, 3],
      })),
    ],
  });

describe('statSuggestionsSupplier', () => {
  it('suggests one Stat card for a time series, with the last value of each field', () => {
    const result = statSuggestionsSupplier(getPanelDataSummary([timeFrame(2)]));

    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({
      name: 'Stat',
      score: VisualizationSuggestionScore.OK,
      options: { seriesType: 'stat', reduceOptions: { values: false, calcs: ['lastNotNull'] } },
    });
  });

  it('suggests the card for number fields with no time field', () => {
    const frame = createDataFrame({ fields: [{ name: 'total', type: FieldType.number, values: [42] }] });
    expect(statSuggestionsSupplier(getPanelDataSummary([frame]))).toHaveLength(1);
  });

  it('suggests nothing for data with no number field', () => {
    const frame = createDataFrame({ fields: [{ name: 'host', type: FieldType.string, values: ['a', 'b'] }] });
    expect(statSuggestionsSupplier(getPanelDataSummary([frame]))).toBeUndefined();
  });

  it('suggests nothing for no data', () => {
    expect(statSuggestionsSupplier(getPanelDataSummary([]))).toBeUndefined();
  });

  it('suggests nothing above the limit of values', () => {
    expect(statSuggestionsSupplier(getPanelDataSummary([timeFrame(STAT_MAX_VALUES)]))).toHaveLength(1);
    expect(statSuggestionsSupplier(getPanelDataSummary([timeFrame(STAT_MAX_VALUES + 1)]))).toBeUndefined();
    const frames = Array.from({ length: STAT_MAX_VALUES + 1 }, () => timeFrame(1));
    expect(statSuggestionsSupplier(getPanelDataSummary(frames))).toBeUndefined();
  });

  it('limits the series of the preview card and marks it as a preview', () => {
    const [card] = statSuggestionsSupplier(getPanelDataSummary([timeFrame(2)]))!;
    expect(card.cardOptions?.maxSeries).toBe(STAT_PREVIEW_MAX_SERIES);

    const preview = { options: { ...card.options } };
    card.cardOptions?.previewModifier?.(preview);
    expect(preview.options).toMatchObject({ isPreview: true, legend: { showLegend: false } });
  });
});
