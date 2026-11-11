import { geoNotices } from './geoNotices';

describe('geoNotices', () => {
  // contract-rule: state.11
  it('gives geo-map-tiles for a tile basemap and a tile layer', () => {
    expect(
      geoNotices({
        basemap: { type: 'default', name: 'Layer 0' },
        layers: [
          { type: 'xyz', name: 'Tiles' },
          { type: 'markers', name: 'Layer 1' },
        ],
      })
    ).toEqual([
      {
        code: 'geo-map-tiles',
        message:
          'Map layer Layer 0 (default) needs map tiles from the network. The vector basemap is drawn in its place.',
      },
      {
        code: 'geo-map-tiles',
        message: 'Map layer Tiles (xyz) needs map tiles from the network. The vector basemap is drawn in its place.',
      },
    ]);
  });

  it('gives geo-offline-file for a GeoJSON file that is not the bundled countries file', () => {
    expect(
      geoNotices({
        layers: [
          { type: 'geojson', name: 'States', config: { src: 'public/maps/usa-states.geojson' } },
          { type: 'geojson', name: 'Countries', config: { src: 'public/maps/countries.geojson' } },
          { type: 'geojson', name: 'Default' },
        ],
      })
    ).toEqual([
      {
        code: 'geo-offline-file',
        message: 'Map layer States: public/maps/usa-states.geojson is not available offline.',
      },
    ]);
  });

  it('reads a GeoJSON src that is not text as the panel does: the core default, so no notice', () => {
    expect(geoNotices({ layers: [{ type: 'geojson', name: 'Bad', config: { src: 5 } }] })).toEqual([]);
  });

  it('gives geo-offline-file for a lookup gazetteer that is not bundled', () => {
    const lookup = (gazetteer: string) => ({ type: 'markers', name: 'L', location: { mode: 'lookup', gazetteer } });
    expect(geoNotices({ layers: [lookup('public/gazetteer/countries.json')] })).toEqual([]);
    expect(geoNotices({ layers: [lookup('https://example.com/places.json')] })).toEqual([
      { code: 'geo-offline-file', message: 'Map layer L: https://example.com/places.json is not available offline.' },
    ]);
  });

  it('gives nothing for the plugin defaults and for values that are not layers', () => {
    expect(geoNotices({})).toEqual([]);
    expect(geoNotices({ basemap: 'default', layers: [null, 3, { name: 'no type' }] })).toEqual([]);
  });
});
