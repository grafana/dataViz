// The features and the styles of the core Geomap GeoJSON layer.
// Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/geojsonLayer.ts
// and `getStyleConfigState` in https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/style/utils.ts
import { type GrafanaTheme2 } from '@grafana/data';
import { ComparisonOperation, type MapLayerOptions } from '@grafana/schema';
import { DEFAULT_MARKER_STYLE } from './dimensions';
import { COUNTRIES_GEOJSON_SRC, type GeoJsonGeometry, getGeoJsonSource } from './geojsonSource';
import { GEOJSON_LAYER_TYPE, resolveLayers } from './layers';

/** The fixed style values that the GeoJSON layer reads (core `StyleEditor` with `simpleFixedValues`). */
export interface GeoJsonStyleConfig {
  color?: { fixed?: string };
  opacity?: number;
  lineWidth?: number;
  size?: { fixed?: number };
}

/** A style rule: the style of the features whose property matches the check (core `FeatureStyleConfig`). */
export interface GeoJsonStyleRule {
  style?: GeoJsonStyleConfig;
  check?: { property: string; operation: ComparisonOperation; value: string | number | boolean };
}

/** The core GeoJSON layer config (`GeoJSONMapperConfig`). */
export interface GeoJsonConfig {
  src?: string;
  rules?: GeoJsonStyleRule[];
  style?: GeoJsonStyleConfig;
}

/** The core `defaultOptions` of the GeoJSON layer. */
export const DEFAULT_GEOJSON_CONFIG = {
  src: COUNTRIES_GEOJSON_SRC,
  rules: [],
  style: DEFAULT_MARKER_STYLE,
} satisfies GeoJsonConfig;

/** The core `DEFAULT_STYLE_RULE` of a new rule. */
export const DEFAULT_GEOJSON_RULE: GeoJsonStyleRule = {
  style: DEFAULT_MARKER_STYLE,
  check: { property: '', operation: ComparisonOperation.EQ, value: '' },
};

/** The drawn style of one feature, as CSS colors. */
export interface GeoFeatureStyle {
  /** The CSS color of the fill and the stroke. */
  color: string;
  /** The alpha of the fill. Core draws no fill for 0. */
  fillOpacity: number;
  lineWidth: number;
  /** The circle radius of a point, in px. */
  radius: number;
}

/** One feature to draw. */
export interface GeoFeatureShape {
  geometry: GeoJsonGeometry;
  style: GeoFeatureStyle;
}

/** The features of one GeoJSON layer. */
export interface GeoJsonLayerShapes {
  features: GeoFeatureShape[];
  /** The index of the layer in the core layer list. A later layer draws on top. */
  layerIndex: number;
}

/** The core property names of a feature style (`GeoJSONPolyStyles`, `GeoJSONLineStyles`, `GeoJSONPointStyles`). */
const POLY_PROPS = ['fill', 'fill-opacity', 'stroke-width'];
const LINE_PROPS = ['stroke', 'stroke-width'];
const POINT_PROPS = ['marker-color', 'marker-size'];

interface StyleValues {
  color: string;
  opacity: number;
  lineWidth: number;
  size: number;
}

/** Core `getStyleConfigState` `base`: the style values, with the core defaults for each unset value. */
const baseValues = (cfg: GeoJsonStyleConfig | undefined, theme: GrafanaTheme2): StyleValues => ({
  color: theme.visualization.getColorByName(cfg?.color?.fixed ?? DEFAULT_MARKER_STYLE.color.fixed),
  opacity: cfg?.opacity ?? DEFAULT_MARKER_STYLE.opacity,
  lineWidth: cfg?.lineWidth ?? 1,
  size: cfg?.size?.fixed ?? DEFAULT_MARKER_STYLE.size.fixed,
});

/**
 * Core `compareValues`: equality compares the text of the values. A null value is the text `null`.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/transformations/matchers/compareValues.ts
 */
function compareValues(left: unknown, op: ComparisonOperation, right: unknown): boolean {
  if (left == null || right == null) {
    left = left ?? 'null';
    right = right ?? 'null';
    if (op === ComparisonOperation.GTE || op === ComparisonOperation.LTE) {
      op = ComparisonOperation.EQ;
    }
  }
  // The order checks compare as JavaScript does, as core: two strings by text, else as numbers.
  const bothText = typeof left === 'string' && typeof right === 'string';
  const [l, r] = bothText ? [String(left), String(right)] : [Number(left), Number(right)];
  switch (op) {
    case ComparisonOperation.EQ:
      return `${left}` === `${right}`;
    case ComparisonOperation.NEQ:
      return `${left}` !== `${right}`;
    case ComparisonOperation.GT:
      return l > r;
    case ComparisonOperation.GTE:
      return l >= r;
    case ComparisonOperation.LT:
      return l < r;
    case ComparisonOperation.LTE:
      return l <= r;
    default:
      return false;
  }
}

/** The values of core `getFillColor` and of the stroke of `polyStyle` and `circleMarker`. */
const toStyle = (v: StyleValues): GeoFeatureStyle => ({
  color: v.color,
  fillOpacity: Math.min(1, Math.max(0, v.opacity)),
  lineWidth: v.lineWidth,
  radius: v.size,
});

const geometryKind = (type: GeoJsonGeometry['type']) =>
  type === 'Point' || type === 'MultiPoint'
    ? 'point'
    : type === 'Polygon' || type === 'MultiPolygon'
      ? 'polygon'
      : type === 'LineString' || type === 'MultiLineString'
        ? 'line'
        : 'other';

/**
 * The style of one feature, as the core style function: the first rule that matches, else the default style. The
 * `fill`, `stroke` and `marker-*` properties of the feature replace the values of that style.
 */
function getFeatureStyle(
  geometry: GeoJsonGeometry,
  props: Record<string, unknown>,
  checks: Array<{ values: StyleValues; rule?: GeoJsonStyleRule['check'] }>
): GeoFeatureStyle {
  const kind = geometryKind(geometry.type);
  const has = (names: string[]) => names.some((n) => n in props);
  const num = (name: string, fallback: number) => (typeof props[name] === 'number' ? Number(props[name]) : fallback);
  const str = (name: string, fallback: string) => (typeof props[name] === 'string' ? String(props[name]) : fallback);
  // Core has the default style last, with no rule, so a check always matches.
  const { values } = checks.find(
    (c) => !c.rule || compareValues(props[c.rule.property], c.rule.operation, c.rule.value)
  )!;
  if (kind === 'polygon' && has(POLY_PROPS)) {
    return toStyle({
      ...values,
      color: str('fill', values.color),
      opacity: num('fill-opacity', values.opacity),
      lineWidth: num('stroke-width', values.lineWidth),
    });
  }
  if (kind === 'line' && has(LINE_PROPS)) {
    return toStyle({ ...values, color: str('stroke', values.color), lineWidth: num('stroke-width', values.lineWidth) });
  }
  if (kind === 'point' && has(POINT_PROPS)) {
    // Core gives only the color and the size here, so the fill has the `getFillColor` default alpha 0.8 and the
    // line width is 1.
    return toStyle({
      ...values,
      color: str('marker-color', values.color),
      size: num('marker-size', values.size),
      opacity: 0.8,
      lineWidth: 1,
    });
  }
  return toStyle(values);
}

/** The features of one GeoJSON layer. A file that is not loaded gives no features. */
function getGeoJsonShapes(
  layer: Partial<MapLayerOptions<GeoJsonConfig>>,
  layerIndex: number,
  theme: GrafanaTheme2
): GeoJsonLayerShapes {
  const config = { ...DEFAULT_GEOJSON_CONFIG, ...layer.config };
  const data = getGeoJsonSource(getLayerSrc(layer));
  const checks = [
    ...(config.rules ?? []).flatMap((r) => (r.style ? [{ values: baseValues(r.style, theme), rule: r.check }] : [])),
    { values: baseValues(config.style, theme) },
  ];
  const features: GeoFeatureShape[] = [];
  for (const f of data?.features ?? []) {
    if (f.geometry) {
      features.push({ geometry: f.geometry, style: getFeatureStyle(f.geometry, f.properties ?? {}, checks) });
    }
  }
  return { features, layerIndex };
}

/** The features of each `geojson` layer, in the layer order. The layer reads no query data, as core. */
export function getGeoJsonLayers(layers: MapLayerOptions[] | undefined, theme: GrafanaTheme2): GeoJsonLayerShapes[] {
  return resolveLayers(layers).flatMap((layer, index) =>
    isGeoJsonLayer(layer) ? [getGeoJsonShapes(layer, index, theme)] : []
  );
}

/** The `config.src` of each `geojson` layer, with the default for an unset value. */
export const getGeoJsonSrcs = (layers: MapLayerOptions[] | undefined): string[] =>
  resolveLayers(layers).flatMap((layer) => (isGeoJsonLayer(layer) ? [getLayerSrc(layer)] : []));

/** True for a `geojson` layer. It takes any object, so a layer of a viz spec that is not checked can use it too. */
export const isGeoJsonLayer = (layer: { type?: unknown }): layer is MapLayerOptions<GeoJsonConfig> =>
  layer.type === GEOJSON_LAYER_TYPE;

/**
 * The `config.src` of a layer, as text. An unset or empty value gives the core default. A layer of a viz spec is not
 * checked, so `src` can be any JSON value, such as `5` or `true`.
 */
export function getLayerSrc(layer: Partial<MapLayerOptions<GeoJsonConfig>>): string {
  const src: unknown = layer.config?.src;
  return src ? String(src) : COUNTRIES_GEOJSON_SRC;
}
