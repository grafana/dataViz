// The geo notices (`state.11`). The geo panel always draws the vector basemap of the bundle, and the Renderer
// fetches no file (`renderer.7`). So a layer that needs map tiles or a file from the network is drawn with no
// network (the vector basemap) or left out, and the Renderer says so.
import { getLayerSrc, isGeoJsonLayer } from 'lib/grafana/geo/geojson';
import { COUNTRIES_GEOJSON_SRC } from 'lib/grafana/geo/geojsonSource';
import { getGazetteer } from 'lib/grafana/geo/gazetteer';
import { type Notice } from './contract/renderer-api';
import { noticeMessage } from './messages';
import { isObject } from './parseSpec';

/**
 * The basemap layer types of core Geomap. Each one draws map tiles from the network.
 * https://github.com/grafana/grafana/tree/main/public/app/plugins/panel/geomap/layers/basemaps
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/registry.ts (`default`)
 */
const TILE_LAYER_TYPES = new Set(['default', 'carto', 'esri-xyz', 'xyz', 'maplibre', 'osm-standard', 'protomaps']);

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

/**
 * The geo notices of `options` of the viz spec: the `basemap` and each entry of `layers`, as core Geomap reads them.
 * The defaults of the plugin give no notice: they need no network.
 */
export function geoNotices(options: Record<string, unknown>): Notice[] {
  const extraLayers: unknown[] = Array.isArray(options.layers) ? options.layers : [];
  const layers = [options.basemap, ...extraLayers].filter(isObject);
  const notices: Notice[] = [];
  for (const layer of layers) {
    const type = text(layer.type);
    if (!type) {
      continue;
    }
    const name = text(layer.name) ?? type;
    if (TILE_LAYER_TYPES.has(type)) {
      notices.push({ code: 'geo-map-tiles', message: noticeMessage('geo-map-tiles', { name, type }) });
    }
    // A GeoJSON file: only the core default (the countries) is in the bundle. The panel reads `src` the same way.
    const src = isGeoJsonLayer(layer) ? getLayerSrc(layer) : COUNTRIES_GEOJSON_SRC;
    if (src !== COUNTRIES_GEOJSON_SRC) {
      notices.push({ code: 'geo-offline-file', message: noticeMessage('geo-offline-file', { name, url: src }) });
    }
    // A gazetteer of the location lookup: only the bundled ones are available.
    const location = isObject(layer.location) ? layer.location : {};
    const gazetteer = text(location.gazetteer);
    if (location.mode === 'lookup' && gazetteer && !getGazetteer(gazetteer)) {
      notices.push({ code: 'geo-offline-file', message: noticeMessage('geo-offline-file', { name, url: gazetteer }) });
    }
  }
  return notices;
}
