import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  GAUGE_BAR_WIDTH_FACTOR_DEFAULT,
  GAUGE_BAR_WIDTH_FACTOR_MAX,
  GAUGE_BAR_WIDTH_FACTOR_MIN,
  gaugeBarWidthFactorPath,
  gaugeCategoryName,
} from 'editor/gauge';
import { type PanelOptions } from 'types';

/** The "Bar width factor" slider, as core Gauge. `layoutGaugeGeometry` reads the value. */
export function addGaugeBarWidthOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addSliderInput({
    path: gaugeBarWidthFactorPath,
    name: t('gauge.bar-width.name', 'Bar width factor'),
    category: [gaugeCategoryName],
    defaultValue: GAUGE_BAR_WIDTH_FACTOR_DEFAULT,
    settings: { min: GAUGE_BAR_WIDTH_FACTOR_MIN, max: GAUGE_BAR_WIDTH_FACTOR_MAX, step: 0.01 },
  });
}
