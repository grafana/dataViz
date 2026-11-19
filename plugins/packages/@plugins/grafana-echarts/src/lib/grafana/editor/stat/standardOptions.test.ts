import { type FieldColorConfigSettings, FieldColorModeId, FieldConfigProperty } from '@grafana/data';
import { STANDARD_FIELD_OPTIONS } from 'lib/grafana/editor/common/fieldConfig';
import { STAT_FIELD_OPTIONS } from 'lib/grafana/editor/stat/standardOptions';

describe('stat standard Color option', () => {
  const color = STAT_FIELD_OPTIONS[FieldConfigProperty.Color];
  const settings: FieldColorConfigSettings = color.settings;

  it('has the thresholds color mode as the default, as core Stat', () => {
    expect(color.defaultValue).toEqual({ mode: FieldColorModeId.Thresholds });
  });

  it('shows the thresholds scheme first and keeps the by-value schemes', () => {
    expect(settings.preferThresholdsMode).toBe(true);
    expect(settings.byValueSupport).toBe(true);
  });

  it('has no "Color series by" option', () => {
    expect(settings.bySeriesSupport).toBeUndefined();
  });

  it('keeps the shared Filterable option', () => {
    expect(STAT_FIELD_OPTIONS[FieldConfigProperty.Filterable]).toBe(
      STANDARD_FIELD_OPTIONS[FieldConfigProperty.Filterable]
    );
  });
});
