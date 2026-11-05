// The panels that the Renderer draws: one entry for each row of `contract/registry/panel-types.json`.
// `./setup` must be the first import: it fills the registries that the modules below read when they load.
import './setup';
import {
  type CustomTransformOperator,
  type DataFrame,
  type DataTransformerConfig,
  type PanelPlugin,
} from '@grafana/data';
import { type ChartFamily } from 'lib/echarts/charts/autoSeriesType';
import { registerGeoChart } from 'lib/echarts/geo/chart';
import { plugin as cartesian } from 'modules/cartesian/module';
import { plugin as geo } from 'modules/geo/module';
import { plugin as heatmap } from 'modules/heatmap/module';
import { plugin as hierarchy } from 'modules/hierarchy/module';
import { plugin as multivariate } from 'modules/multivariate/module';
import { plugin as partToWhole } from 'modules/part-to-whole/module';
import { relationsDataTransformations } from 'modules/relations/dataTransformations';
import { plugin as relations } from 'modules/relations/module';
import { plugin as stateTimeline } from 'modules/state-timeline/module';
import { plugin as statusHistory } from 'modules/status-history/module';
import { plugin as stream } from 'modules/stream/module';

/** The transformations that a panel registers on Grafana with `setSystemTransformations`. */
type SystemTransformations = (ctx: {
  series: DataFrame[];
}) => Array<DataTransformerConfig | CustomTransformOperator> | undefined;

export interface PanelEntry {
  /** The option types differ for each panel. The Renderer reads only the generic parts. */
  plugin: PanelPlugin;
  /** The `family` that the module gives to `makeLazyPanel`. */
  family: ChartFamily;
  /**
   * Called with the frames before the field overrides, as Grafana does. The Renderer calls it itself: the
   * `@grafana/data` of the App can lack `setSystemTransformations` (see `lib/grafana/panelDataTransformations.ts`).
   */
  systemTransformations?: SystemTransformations;
}

// The geo module loads the basemap with an `import()` before its first draw. The Renderer bundle has no chunks,
// so it registers the basemap here, once.
registerGeoChart();

// The heatmap module also preloads core's heatmap transformer from the host registry. Outside Grafana that registry
// is empty, so the preload gives nothing, and the panel draws the frames as they are. The Renderer does not call it.
export const PANELS: Record<string, PanelEntry> = {
  'grafana-echartscartesian-panel': { plugin: cartesian, family: 'cartesian' },
  'grafana-echartsgeo-panel': { plugin: geo, family: 'geo' },
  'grafana-echartsheatmap-panel': { plugin: heatmap, family: 'heatmap' },
  'grafana-echartshierarchy-panel': { plugin: hierarchy, family: 'hierarchy' },
  'grafana-echartsmultivariate-panel': { plugin: multivariate, family: 'multivariate' },
  'grafana-echartsparttowhole-panel': { plugin: partToWhole, family: 'part-to-whole' },
  'grafana-relations-panel': {
    plugin: relations,
    family: 'relations',
    systemTransformations: relationsDataTransformations,
  },
  'grafana-echartsstatetimeline-panel': { plugin: stateTimeline, family: 'timeline' },
  'grafana-echartsstatushistory-panel': { plugin: statusHistory, family: 'status-history' },
  'grafana-echartsstream-panel': { plugin: stream, family: 'stream' },
};
