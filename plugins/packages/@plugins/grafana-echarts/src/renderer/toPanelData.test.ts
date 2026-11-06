import { type DataFrameJSON, DataTopic, FieldType } from '@grafana/data';
import { fixtureSpec } from 'test/rendererFixtures';
import { PANELS } from './panels';
import { parseSpec } from './parseSpec';
import { runSystemTransformations, toSpecData } from './toPanelData';
import { type VizSpec } from './vizSpec';

const parse = (input: unknown): VizSpec => {
  const result = parseSpec(input);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.spec;
};

const frame = (refId: string | undefined, name: string, dataTopic?: DataTopic): DataFrameJSON => ({
  schema: { refId, name, meta: dataTopic ? { dataTopic } : undefined, fields: [{ name: 'v', type: FieldType.number }] },
  data: { values: [[1]] },
});

const spec = (results: VizSpec['data']['results'], targetRefIds: string[]): VizSpec => ({
  ...parse(fixtureSpec('smoke-timeseries')),
  panel: { ...parse(fixtureSpec('smoke-timeseries')).panel, targetRefIds },
  data: { range: { from: 1000, to: 2000 }, capturedAt: 2000, results },
});

const cartesian = PANELS['grafana-echartscartesian-panel'];

describe('toSpecData', () => {
  // contract-rule: spec.11
  it('gives the frames of all results in the order of the targets, and each frame keeps its refId', () => {
    const data = toSpecData(
      spec({ B: { frames: [frame(undefined, 'b')] }, A: { frames: [frame('A', 'a1'), frame('A', 'a2')] } }, ['A', 'B']),
      cartesian
    );
    expect(data.series.map((f) => [f.refId, f.name])).toEqual([
      ['A', 'a1'],
      ['A', 'a2'],
      ['B', 'b'],
    ]);
  });

  // contract-rule: spec.12
  it('gives an annotation frame to annotations, not to series', () => {
    const data = toSpecData(
      spec({ A: { frames: [frame('A', 's'), frame('A', 'n', DataTopic.Annotations)] } }, ['A']),
      cartesian
    );
    expect(data.series.map((f) => f.name)).toEqual(['s']);
    expect(data.annotations.map((f) => f.name)).toEqual(['n']);
  });

  // contract-rule: renderer.12
  it('removes the data links and actions that a data source puts in the field config, in series and annotations', () => {
    const withCallOuts = (name: string, dataTopic?: DataTopic): DataFrameJSON => {
      const json = frame('A', name, dataTopic);
      json.schema!.fields[0].config = {
        unit: 'short',
        links: [{ title: 't', url: 'https://evil.example/x' }],
        actions: [{ title: 'a' }],
      } as never;
      return json;
    };
    const data = toSpecData(
      spec({ A: { frames: [withCallOuts('s'), withCallOuts('n', DataTopic.Annotations)] } }, ['A']),
      cartesian
    );
    for (const field of [...data.series, ...data.annotations].flatMap((f) => f.fields)) {
      expect(field.config).toEqual({ unit: 'short' });
    }
  });

  it('keeps the frames of a result that has an error', () => {
    const data = toSpecData(
      spec({ A: { frames: [frame('A', 'a')] }, B: { frames: [frame('B', 'b')], error: 'x' } }, ['A', 'B']),
      cartesian
    );
    expect(data.series.map((f) => f.name)).toEqual(['a', 'b']);
  });

  it('gives data.range as an absolute time range', () => {
    const { timeRange } = toSpecData(spec({ A: { frames: [] } }, ['A']), cartesian);
    expect([timeRange.from.valueOf(), timeRange.to.valueOf(), timeRange.raw.from.valueOf()]).toEqual([
      1000, 2000, 1000,
    ]);
  });

  // contract-rule: spec.13
  it('keeps hostile label values as strings', () => {
    const data = toSpecData(parse(fixtureSpec('hostile-label')), cartesian);
    const labels = data.series.flatMap((f) => f.fields.flatMap((field) => Object.values(field.labels ?? {})));
    expect(labels).toContain('<img src=x onerror=alert(1)>');
  });

  it('runs the relations transformations: legacy node graph frames become wide frames', () => {
    const data = toSpecData(parse(fixtureSpec('smoke-nodeGraph')), PANELS['grafana-relations-panel']);
    expect(data.series.map((f) => [f.meta?.type, f.fields.map((field) => field.name)])).toEqual([
      ['graph-nodes-wide', ['api', 'db', 'cache']],
      ['graph-edges-wide', ['e1', 'e2']],
    ]);
  });
});

describe('runSystemTransformations', () => {
  it('gives the frames unchanged with no transformations', () => {
    const series = [{ fields: [], length: 0 }];
    expect(runSystemTransformations(cartesian, series)).toBe(series);
  });

  it('throws for a transformer id, which needs the transformer registry of Grafana', () => {
    const entry = { ...cartesian, systemTransformations: () => [{ id: 'merge', options: {} }] };
    expect(() => runSystemTransformations(entry, [])).toThrow('merge');
  });
});
