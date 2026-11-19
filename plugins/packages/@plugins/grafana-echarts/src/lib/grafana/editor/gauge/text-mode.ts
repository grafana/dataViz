import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GAUGE_TEXT_MODE_DEFAULT, gaugeCategoryName, gaugeTextModeOptions, gaugeTextModePath } from 'editor/gauge';
import { type PanelOptions } from 'types';

/** The "Text mode" select, as core Gauge. `resolveGaugeTextParts` reads the value. */
export function addGaugeTextModeOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addSelect({
    path: gaugeTextModePath,
    name: t('gauge.text-mode.name', 'Text mode'),
    category: [gaugeCategoryName],
    defaultValue: GAUGE_TEXT_MODE_DEFAULT,
    settings: { options: gaugeTextModeOptions },
  });
}
