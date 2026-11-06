import { FieldType } from '@grafana/data';
import { fixtureSets, fixtureSpec } from 'test/rendererFixtures';
import { PANELS } from './panels';
import { parseSpec } from './parseSpec';
import { withoutCallOuts } from './callOuts';
import { themeOf, toPanelProps } from './toPanelProps';
import { type VizSpec } from './vizSpec';

const parse = (input: unknown): VizSpec => {
  const result = parseSpec(input);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.spec;
};

const withFieldConfig = (fieldConfig: unknown) => {
  const spec = fixtureSpec('smoke-timeseries');
  (spec.panel as Record<string, unknown>).fieldConfig = fieldConfig;
  return parse(spec);
};

const cartesian = PANELS['grafana-echartscartesian-panel'];
const numberFields = (spec: VizSpec) =>
  toPanelProps(spec, cartesian).data.series.flatMap((f) => f.fields.filter((field) => field.type === FieldType.number));

describe('toPanelProps', () => {
  // contract-rule: spec.10
  it('gives the plugin defaults to the options', () => {
    const props = toPanelProps(parse(fixtureSpec('smoke-timeseries')), cartesian);
    expect(props.options).toMatchObject({
      seriesType: 'line',
      legend: expect.any(Object),
      tooltip: expect.any(Object),
    });
    expect(props.family).toBe('cartesian');
  });

  it('applies the field config to the frames: unit, and display', () => {
    const fields = numberFields(withFieldConfig({ defaults: { unit: 'reqps' } }));
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.config.unit).toBe('reqps');
      expect(field.display!(1234).suffix).toContain('req/s');
    }
  });

  it('applies an override by name', () => {
    const name = numberFields(parse(fixtureSpec('smoke-timeseries')))[0].name;
    const fields = numberFields(
      withFieldConfig({
        defaults: {},
        overrides: [{ matcher: { id: 'byName', options: name }, properties: [{ id: 'unit', value: 'bytes' }] }],
      })
    );
    expect(fields.find((field) => field.name === name)?.config.unit).toBe('bytes');
  });

  // contract-rule: renderer.12
  it('gives no data links and no actions, in the defaults and in the overrides', () => {
    const link = [{ title: 't', url: 'https://example.com' }];
    const spec = withFieldConfig({
      defaults: { links: link, actions: [{ title: 'a' }], unit: 'short' },
      overrides: [
        {
          matcher: { id: 'byType', options: 'number' },
          properties: [
            { id: 'links', value: link },
            { id: 'unit', value: 'bytes' },
          ],
        },
      ],
    });
    const props = toPanelProps(spec, cartesian);
    expect(props.fieldConfig.defaults).not.toHaveProperty('links');
    expect(props.fieldConfig.defaults).not.toHaveProperty('actions');
    expect(props.fieldConfig.overrides[0].properties.map((property) => property.id)).toEqual(['unit']);
    for (const field of numberFields(spec)) {
      expect(field.config.links ?? []).toEqual([]);
      expect(field.getLinks?.({}) ?? []).toEqual([]);
    }
    // The ad-hoc filter buttons come from `PanelContext.onAddAdHocFilter`. The Renderer gives no `PanelContext`.
    expect(Object.keys(props)).not.toContain('onAddAdHocFilter');
  });

  // contract-rule: renderer.12
  it('gives no data links for links that a data source puts in the frames', () => {
    const spec = fixtureSpec('smoke-timeseries') as { data: { results: Record<string, { frames: unknown[] }> } };
    for (const json of Object.values(spec.data.results).flatMap((result) => result.frames)) {
      for (const field of (json as { schema: { fields: Array<{ config?: object }> } }).schema.fields) {
        field.config = { ...field.config, links: [{ title: 't', url: 'https://evil.example/x' }] };
      }
    }
    const fields = toPanelProps(parse(spec), cartesian).data.series.flatMap((f) => f.fields);
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.config.links).toBeUndefined();
      expect(field.getLinks?.({ valueRowIndex: 0 })).toEqual([]);
    }
  });

  it('removes call-out properties and keeps the rest', () => {
    expect(
      withoutCallOuts({
        defaults: { links: [], unit: 'short' },
        overrides: [{ matcher: { id: 'byName', options: 'a' }, properties: [{ id: 'actions', value: [] }] }],
      })
    ).toEqual({
      defaults: { unit: 'short' },
      overrides: [{ matcher: { id: 'byName', options: 'a' }, properties: [] }],
    });
  });

  // contract-rule: renderer.11
  it('uses the theme of the spec, dark by default', () => {
    expect(themeOf('dark').isDark).toBe(true);
    expect(themeOf('light').isLight).toBe(true);
  });

  // contract-rule: renderer.14
  it('gives the time zone of the spec and the time range of data.range', () => {
    const spec = { ...parse(fixtureSpec('epoch-range')), timeZone: 'utc' };
    const props = toPanelProps(spec, cartesian);
    expect(props.timeZone).toBe('utc');
    expect(props.timeRange.from.valueOf()).toBe(spec.data.range.from);
    expect(props.timeRange.to.valueOf()).toBe(spec.data.range.to);
  });
});

describe('toPanelProps for each fixture set', () => {
  const sets = fixtureSets().filter((set) => !set.startsWith('error-'));

  it.each(sets)('%s: builds the props with the frames of the spec', (set) => {
    const spec = parse(fixtureSpec(set));
    const props = toPanelProps(spec, PANELS[spec.panel.type]);
    const rows = props.data.series.reduce((sum, frame) => sum + frame.length, 0);
    expect(rows > 0).toBe(set !== 'no-data');
    for (const frame of props.data.series) {
      for (const field of frame.fields) {
        expect(field.display).toBeDefined();
      }
    }
  });
});
