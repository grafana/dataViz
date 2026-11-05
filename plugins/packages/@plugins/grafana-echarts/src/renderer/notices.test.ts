import { fixtureSpec, fixtureState } from 'test/rendererFixtures';
import { allNotices, rendererNotices, SERIES_TRUNCATED_PATTERN, toChartNotices } from './notices';
import { parseSpec } from './parseSpec';
import { type VizSpec } from './vizSpec';

const parse = (input: unknown): VizSpec => {
  const result = parseSpec(input);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.spec;
};

const withUnit = (unit: unknown) => {
  const spec = fixtureSpec('smoke-timeseries');
  (spec.panel as Record<string, unknown>).fieldConfig = { defaults: { unit } };
  return parse(spec);
};

describe('rendererNotices', () => {
  // contract-rule: state.8
  it('gives one query-failed notice for each failed query, when another query has no error', () => {
    expect(rendererNotices(parse(fixtureSpec('partial-error')), 0)).toEqual(fixtureState('partial-error').notices);
  });

  it('gives no notices for the smoke sets', () => {
    expect(rendererNotices(parse(fixtureSpec('smoke-timeseries')), 0)).toEqual([]);
  });

  // contract-rule: state.9
  it('gives unit-unknown for a unit that is not a unit id, and nothing for an empty unit', () => {
    expect(rendererNotices(withUnit('foo'), 0)).toEqual([
      { code: 'unit-unknown', message: 'Unit foo is not a Grafana unit. The values show with no unit.' },
    ]);
    expect(rendererNotices(withUnit('reqps'), 0)).toEqual([]);
    expect(rendererNotices(withUnit(''), 0)).toEqual([]);
    expect(rendererNotices(withUnit(3), 0)).toEqual([]);
  });

  // contract-rule: state.10
  it('gives series-truncated with the own message of the Renderer', () => {
    expect(SERIES_TRUNCATED_PATTERN).not.toContain('peak');
    expect(rendererNotices(parse(fixtureSpec('smoke-timeseries')), 7)).toEqual([
      { code: 'series-truncated', message: '7 series are not shown. The first 50 series are drawn.' },
    ]);
  });

  // contract-rule: state.7
  it('puts the notices of the Renderer first, then the notices of the spec', () => {
    const app = { code: 'chart-changed', message: 'The XY chart does not fit the new data. The chart is now a pie.' };
    const spec = { ...withUnit('foo'), notices: [app] };
    expect(allNotices(spec, 0).map((notice) => notice.code)).toEqual(['unit-unknown', 'chart-changed']);
  });
});

describe('toChartNotices', () => {
  it('shows a failed query and a cut as a warning, and the other notices as info', () => {
    expect(
      toChartNotices([
        { code: 'query-failed', message: 'a' },
        { code: 'series-truncated', message: 'b' },
        { code: 'unit-unknown', message: 'c' },
        { code: 'chart-changed', message: 'd' },
      ]).map((notice) => notice.severity)
    ).toEqual(['warning', 'warning', 'info', 'info']);
  });
});
