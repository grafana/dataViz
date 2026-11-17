import { createTheme, FALLBACK_COLOR, type FieldConfig, type FieldDisplay, ThresholdsMode } from '@grafana/data';
import { resolveGaugeRange, resolveGaugeThresholds, resolveGaugeValues } from './gauge';

const theme = createTheme();
const color = (name: string) => theme.visualization.getColorByName(name);

const steps = (...pairs: Array<[number, string]>) => pairs.map(([value, name]) => ({ value, color: name }));
const absolute = (...pairs: Array<[number, string]>): FieldConfig['thresholds'] => ({
  mode: ThresholdsMode.Absolute,
  steps: steps(...pairs),
});

describe('resolveGaugeRange', () => {
  it('uses the min and the max of the field', () => {
    expect(resolveGaugeRange({ min: 20, max: 60 })).toEqual({ min: 20, max: 60 });
  });

  it('uses 0 to 100 when the field has no limit', () => {
    expect(resolveGaugeRange({})).toEqual({ min: 0, max: 100 });
  });

  it('moves equal limits apart by 10%', () => {
    expect(resolveGaugeRange({ min: 50, max: 50 })).toEqual({ min: 45, max: 55 });
    expect(resolveGaugeRange({ min: -50, max: -50 })).toEqual({ min: -55, max: -45 });
  });

  it('gives the default maximum to a range of zero to zero', () => {
    expect(resolveGaugeRange({ min: 0, max: 0 })).toEqual({ min: 0, max: 100 });
  });
});

describe('resolveGaugeThresholds', () => {
  const range = { min: 0, max: 100 };

  it('gives each step the band from its value to the value of the next step', () => {
    const field = { thresholds: absolute([-Infinity, 'green'], [60, 'orange'], [80, 'red']) };
    expect(resolveGaugeThresholds(field, range, theme)).toEqual([
      { to: 0.6, color: color('green') },
      { to: 0.8, color: color('orange') },
      { to: 1, color: color('red') },
    ]);
  });

  it('reads absolute steps against the range of the field', () => {
    const field = { thresholds: absolute([-Infinity, 'green'], [40, 'red']) };
    expect(resolveGaugeThresholds(field, { min: 20, max: 60 }, theme)).toEqual([
      { to: 0.5, color: color('green') },
      { to: 1, color: color('red') },
    ]);
  });

  it('reads percentage steps as parts of the range', () => {
    const field: FieldConfig = {
      thresholds: { mode: ThresholdsMode.Percentage, steps: steps([-Infinity, 'blue'], [25, 'red']) },
    };
    expect(resolveGaugeThresholds(field, { min: 20, max: 60 }, theme)).toEqual([
      { to: 0.25, color: color('blue') },
      { to: 1, color: color('red') },
    ]);
  });

  it('leaves out a step below the minimum, and ends at a step above the maximum', () => {
    const field = { thresholds: absolute([-Infinity, 'blue'], [-10, 'green'], [50, 'orange'], [500, 'red']) };
    expect(resolveGaugeThresholds(field, range, theme)).toEqual([
      { to: 0.5, color: color('green') },
      { to: 1, color: color('orange') },
    ]);
  });

  it('gives one stop for one step, and no stop for no step', () => {
    expect(resolveGaugeThresholds({ thresholds: absolute([-Infinity, 'green']) }, range, theme)).toEqual([
      { to: 1, color: color('green') },
    ]);
    expect(resolveGaugeThresholds({}, range, theme)).toEqual([]);
  });
});

describe('resolveGaugeValues', () => {
  const display = (extra: Partial<FieldDisplay['display']>, field: FieldConfig = { min: 0, max: 100 }): FieldDisplay =>
    ({
      name: 'cpu',
      field,
      display: { title: 'cpu', text: '72', numeric: 72, color: '#f00', ...extra },
    }) as FieldDisplay;

  it('maps the name, the number, the range and the color', () => {
    expect(resolveGaugeValues([display({})], theme)[0]).toEqual({
      name: 'cpu',
      text: '72',
      numeric: 72,
      min: 0,
      max: 100,
      color: '#f00',
      thresholds: [],
      hasDisplayName: false,
    });
  });

  it('joins the prefix and the suffix to the value text', () => {
    expect(resolveGaugeValues([display({ prefix: '$', suffix: ' k' })], theme)[0].text).toBe('$72 k');
  });

  it('uses the fallback color for a value with no color', () => {
    expect(resolveGaugeValues([display({ color: undefined })], theme)[0].color).toBe(FALLBACK_COLOR);
  });

  it('reports a display name of the field', () => {
    expect(resolveGaugeValues([display({}, { displayName: 'CPU' })], theme)[0].hasDisplayName).toBe(true);
  });

  it('keeps the order of the values', () => {
    const values = resolveGaugeValues([display({ title: 'a' }), display({ title: 'b' })], theme);
    expect(values.map((value) => value.name)).toEqual(['a', 'b']);
  });
});
