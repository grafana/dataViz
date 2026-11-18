import { createTheme } from '@grafana/data';
import { ComparisonOperation, type MapLayerOptions } from '@grafana/schema';
import { getGeoJsonLayers, getGeoJsonSrcs, getLayerSrc } from './geojson';
import { type GeoJsonFeature, setGeoJsonSource } from './geojsonSource';

const theme = createTheme();
const green = theme.visualization.getColorByName('dark-green');

const square = [
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 0],
  ],
];
const feature = (geometry: GeoJsonFeature['geometry'], properties: Record<string, unknown> = {}): GeoJsonFeature => ({
  type: 'Feature',
  geometry,
  properties,
});

setGeoJsonSource('test.geojson', {
  type: 'FeatureCollection',
  features: [
    feature({ type: 'Polygon', coordinates: square }, { name: 'a', pop: 5 }),
    feature({ type: 'Polygon', coordinates: square }, { name: 'b', pop: 50, fill: 'red', 'fill-opacity': 1 }),
    feature({ type: 'LineString', coordinates: square[0] }, { stroke: 'blue', 'stroke-width': 3 }),
    feature({ type: 'Point', coordinates: [0, 0] }, { 'marker-size': 9 }),
    feature(null),
  ],
});

const layer = (config: object): MapLayerOptions => ({
  type: 'geojson',
  name: 'g',
  config: { src: 'test.geojson', ...config },
});
const styles = (config: object) => getGeoJsonLayers([layer(config)], theme)[0].features.map((f) => f.style);

describe('GeoJSON layer styles', () => {
  it('gives the core default style: dark green, a fill alpha of 0.4, a line width of 1 and a radius of 5', () => {
    const [a] = styles({});
    expect(a).toEqual({ color: green, fillOpacity: 0.4, lineWidth: 1, radius: 5 });
  });

  it('reads the fill, stroke and marker properties of each feature, as core', () => {
    const [, b, line, point] = styles({});
    expect(b).toMatchObject({ color: 'red', fillOpacity: 1 });
    expect(line).toMatchObject({ color: 'blue', lineWidth: 3 });
    expect(point).toMatchObject({ color: green, radius: 9, fillOpacity: 0.8 });
  });

  it('gives the style of the first rule that matches, else the default style', () => {
    const rules = [
      { check: { property: 'pop', operation: ComparisonOperation.GT, value: 10 }, style: { color: { fixed: 'blue' } } },
      {
        check: { property: 'name', operation: ComparisonOperation.EQ, value: 'a' },
        style: { color: { fixed: 'red' } },
      },
      {
        check: { property: 'pop', operation: ComparisonOperation.GTE, value: 0 },
        style: { color: { fixed: 'green' } },
      },
    ];
    const [a, b, line] = styles({ rules });
    expect(a.color).toBe(theme.visualization.getColorByName('red'));
    // The feature `fill` property replaces the rule color.
    expect(b.color).toBe('red');
    // A missing property is `null`; `>=` then checks equality, as core `compareValues`.
    expect(line.color).toBe('blue');
    expect(styles({ rules: rules.slice(2) })[3].color).toBe(green);
  });

  it('draws no feature for a file that is not loaded, and skips the other layer types', () => {
    expect(getGeoJsonLayers([layer({ src: 'missing.geojson' }), { type: 'markers', name: 'm' }], theme)).toEqual([
      { features: [], layerIndex: 0 },
    ]);
  });

  it('gives the core default file for an unset src', () => {
    expect(getGeoJsonSrcs([{ type: 'geojson', name: 'g' }, layer({})])).toEqual([
      'public/maps/countries.geojson',
      'test.geojson',
    ]);
  });

  it('reads a src that is not a non-empty string as the core default: a number, an object, a boolean or an empty src', () => {
    const src = (value: unknown) => getLayerSrc({ type: 'geojson', config: { src: value as string } });
    expect(src('public/maps/usa-states.geojson')).toBe('public/maps/usa-states.geojson');
    expect(src(5)).toBe('public/maps/countries.geojson');
    expect(src({})).toBe('public/maps/countries.geojson');
    expect(src(true)).toBe('public/maps/countries.geojson');
    expect(src('')).toBe('public/maps/countries.geojson');
  });
});
