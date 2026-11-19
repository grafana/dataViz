import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GAUGE_SHAPE_DEFAULT, gaugeCategoryName, gaugeShapeOptions, gaugeShapePath } from 'editor/gauge';
import { type PanelOptions } from 'types';

/** The "Style" radio (Circle / Arc), as core Gauge. `getGaugeAngles` reads the value. */
export function addGaugeShapeOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addRadio({
    path: gaugeShapePath,
    name: t('gauge.shape.name', 'Style'),
    category: [gaugeCategoryName],
    defaultValue: GAUGE_SHAPE_DEFAULT,
    settings: { options: gaugeShapeOptions },
  });
}
