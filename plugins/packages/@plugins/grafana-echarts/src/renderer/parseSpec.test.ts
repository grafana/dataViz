import { fixtureSpec, fixtureState } from 'test/rendererFixtures';
import { parseSpec } from './parseSpec';

const valid = () => fixtureSpec('smoke-timeseries');

/** The spec with one field removed, by dotted path. */
function without(path: string): Record<string, unknown> {
  const spec = valid();
  const keys = path.split('.');
  const last = keys.pop()!;
  const parent = keys.reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, spec);
  delete parent[last];
  return spec;
}

const errorOf = (input: unknown) => {
  const result = parseSpec(input);
  return result.ok ? undefined : result.error;
};

describe('parseSpec', () => {
  // contract-rule: state.3
  it.each([
    'specVersion',
    'panel',
    'panel.type',
    'data',
    'data.range',
    'data.range.from',
    'data.range.to',
    'data.capturedAt',
    'data.results',
  ])('gives invalid-spec when %s is missing', (field) => {
    expect(errorOf(without(field))).toEqual({
      code: 'invalid-spec',
      message: `The viz spec is not correct: ${field} is missing.`,
    });
  });

  it.each([null, 'spec', 3, []])('gives invalid-spec for %p, which is not an object', (input) => {
    expect(errorOf(input)).toEqual({
      code: 'invalid-spec',
      message: 'The viz spec is not correct: specVersion is missing.',
    });
  });

  /** The spec with `frame` after the frames of result A, at index 2. */
  const withFrame = (frame: unknown) => {
    const spec = valid();
    (spec.data as { results: { A: { frames: unknown[] } } }).results.A.frames.push(frame);
    return spec;
  };

  // contract-rule: state.3
  it.each([
    ['a frame that is not an object', 'frame', ''],
    ['a frame with no schema', {}, '.schema'],
    ['schema.fields that is not an array', { schema: { fields: {} } }, '.schema.fields'],
    ['a field that is not an object', { schema: { fields: [null] } }, '.schema.fields.0'],
    ['a field with no name', { schema: { fields: [{ name: 'a' }, { type: 'number' }] } }, '.schema.fields.1.name'],
    ['data that is not an object', { schema: {}, data: [] }, '.data'],
    ['data.values that is not an array', { schema: {}, data: { values: {} } }, '.data.values'],
    ['a values entry that is not an array', { schema: {}, data: { values: [[1], 2] } }, '.data.values.1'],
  ])('gives invalid-spec for %s, with the path of the frame', (_, frame, path) => {
    expect(errorOf(withFrame(frame))).toEqual({
      code: 'invalid-spec',
      message: `The viz spec is not correct: data.results.A.frames.2${path} is missing.`,
    });
  });

  it('accepts a frame that matches the frame schema, also with no fields or no data', () => {
    expect(parseSpec(withFrame({ schema: { name: 'no fields' } })).ok).toBe(true);
  });

  it('checks the frames before the spec version', () => {
    const spec = withFrame({});
    spec.specVersion = 99;
    expect(errorOf(spec)?.code).toBe('invalid-spec');
  });

  it('checks the fields in the order of the schema', () => {
    const spec = without('data');
    delete (spec.panel as Record<string, unknown>).type;
    expect(errorOf(spec)?.message).toBe('The viz spec is not correct: panel.type is missing.');
  });

  // contract-rule: fixtures.12
  it.each([
    'error-invalid-spec',
    'error-unsupported-spec-version',
    'error-unsupported-panel-type',
    'error-all-queries-failed',
  ])('gives the error of %s', (set) => {
    expect(errorOf(fixtureSpec(set))).toEqual(fixtureState(set).error);
  });

  // contract-rule: state.18
  it('gives one all-queries-failed line for each result, in the order of the targets', () => {
    const spec = fixtureSpec('error-all-queries-failed');
    (spec.panel as { targets: unknown[] }).targets.reverse();
    expect(
      errorOf(spec)
        ?.message.split('\n')
        .map((line) => line.slice(0, 7))
    ).toEqual(['Query B', 'Query A']);
  });

  it('gives no error when one query has no error', () => {
    expect(parseSpec(fixtureSpec('partial-error')).ok).toBe(true);
  });

  // contract-rule: spec.9
  it('ignores the fields that it does not know', () => {
    expect(parseSpec({ ...valid(), unknownField: { a: 1 } }).ok).toBe(true);
  });

  // contract-rule: spec.14
  it('gives the defaults of the optional fields', () => {
    const result = parseSpec(valid());
    expect(result.ok && result.spec).toMatchObject({
      theme: 'dark',
      timeZone: 'browser',
      notices: [],
      panel: { fieldConfig: { defaults: {}, overrides: [] }, targetRefIds: ['A'] },
    });
  });

  it('keeps the theme, the time zone and the notices of the App', () => {
    const notice = { code: 'chart-changed', message: 'm' };
    const result = parseSpec({ ...valid(), theme: 'light', timeZone: 'utc', notices: [notice, { code: 1 }] });
    expect(result.ok && [result.spec.theme, result.spec.timeZone, result.spec.notices]).toEqual([
      'light',
      'utc',
      [notice],
    ]);
  });

  it('gives overrides: [] when fieldConfig has only defaults, and leaves out an override with no matcher', () => {
    const spec = valid();
    (spec.panel as Record<string, unknown>).fieldConfig = { defaults: { unit: 'reqps' } };
    let result = parseSpec(spec);
    expect(result.ok && result.spec.panel.fieldConfig).toEqual({ defaults: { unit: 'reqps' }, overrides: [] });

    (spec.panel as Record<string, unknown>).fieldConfig = { defaults: {}, overrides: [{ properties: [] }] };
    result = parseSpec(spec);
    expect(result.ok && result.spec.panel.fieldConfig.overrides).toEqual([]);
  });

  // contract-rule: renderer.3
  it('does not throw for any input', () => {
    for (const input of [undefined, () => 1, { specVersion: 1, panel: [], data: 'x' }, { panel: { type: {} } }]) {
      expect(() => parseSpec(input)).not.toThrow();
    }
  });
});
