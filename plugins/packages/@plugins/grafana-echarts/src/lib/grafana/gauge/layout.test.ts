import { layoutGaugeGeometry, layoutGaugeText, resolveGaugeTextParts } from './layout';

const FONT = 'Inter, Helvetica, Arial, sans-serif';

describe('layoutGaugeGeometry', () => {
  it('fits an arc gauge to the width of a wide cell', () => {
    const geometry = layoutGaugeGeometry(400, 300, 'gauge', 0.5, true);

    // The band is the outer ring, at the largest radius that fits: half of the width.
    expect(geometry.bandOuterRadius).toBe(200);
    expect(geometry.centerX).toBe(200);
    expect(geometry.barWidth).toBeCloseTo(33.33, 2);
    expect(geometry.bandWidth).toBeCloseTo(5.04, 2);
    // The bar is inside the band, after the band width and the space.
    expect(geometry.outerRadius).toBeCloseTo(192.45, 2);
    expect(geometry.radius).toBeCloseTo(geometry.outerRadius - geometry.barWidth / 2, 9);
    // The arc goes 20 degrees below its center, and the gauge is in the vertical middle of the cell.
    expect(geometry.centerY).toBeCloseTo(215.8, 1);
  });

  it('fits a circle to the smaller side and centers it', () => {
    const geometry = layoutGaugeGeometry(400, 300, 'circle', 0.5, false);
    expect(geometry.outerRadius).toBe(150);
    expect(geometry.centerY).toBe(150);
  });

  it('has no band and a larger bar radius when the band is off', () => {
    const withBand = layoutGaugeGeometry(400, 300, 'gauge', 0.5, true);
    const noBand = layoutGaugeGeometry(400, 300, 'gauge', 0.5, false);
    expect(noBand.bandWidth).toBe(0);
    expect(noBand.bandOuterRadius).toBe(0);
    expect(noBand.outerRadius).toBe(200);
    expect(noBand.outerRadius).toBeGreaterThan(withBand.outerRadius);
  });

  it('makes the bar wider for a larger factor, and never thinner than 2px', () => {
    expect(layoutGaugeGeometry(400, 300, 'gauge', 1, false).barWidth).toBeCloseTo(66.67, 2);
    expect(layoutGaugeGeometry(20, 20, 'gauge', 0.1, false).barWidth).toBe(2);
  });

  it('keeps the band between 4px and 12px', () => {
    expect(layoutGaugeGeometry(60, 60, 'gauge', 0.1, true).bandWidth).toBe(4);
    expect(layoutGaugeGeometry(3000, 3000, 'gauge', 1, true).bandWidth).toBe(12);
  });
});

describe('resolveGaugeTextParts', () => {
  it.each([
    ['auto', 1, false, { showValue: true, showName: false }],
    ['auto', 2, false, { showValue: true, showName: true }],
    ['auto', 1, true, { showValue: true, showName: true }],
    ['value_and_name', 1, false, { showValue: true, showName: true }],
    ['value', 3, true, { showValue: true, showName: false }],
    ['name', 1, false, { showValue: false, showName: true }],
    ['none', 3, true, { showValue: false, showName: false }],
  ] as const)('%s with %i gauge(s), display name %s', (mode, count, hasDisplayName, expected) => {
    expect(resolveGaugeTextParts(mode, count, hasDisplayName)).toEqual(expected);
  });
});

describe('layoutGaugeText', () => {
  const geometry = { radius: 100, barWidth: 20 };
  const texts = { valueText: '72', nameText: 'cpu', fontFamily: FONT };
  const both = { showValue: true, showName: true };

  it('gives no text when the parts are off', () => {
    const parts = { showValue: false, showName: false };
    expect(layoutGaugeText({ geometry, shape: 'gauge', parts, ...texts })).toEqual({});
  });

  it('centers a value with no name on a circle', () => {
    const layout = layoutGaugeText({
      geometry,
      shape: 'circle',
      parts: { showValue: true, showName: false },
      ...texts,
    });
    expect(layout.name).toBeUndefined();
    expect(layout.value?.offsetY).toBe(0);
  });

  it('puts the name below the value, in a smaller font', () => {
    const { value, name } = layoutGaugeText({ geometry, shape: 'circle', parts: both, ...texts });
    expect(name!.offsetY).toBeGreaterThan(value!.offsetY);
    expect(name!.fontSize).toBeLessThan(value!.fontSize);
  });

  it('gives the prefix and the suffix 70% of the value font size, and not less than 6px', () => {
    const { value } = layoutGaugeText({ geometry, shape: 'circle', parts: both, ...texts });
    expect(value!.unitFontSize).toBeCloseTo(value!.fontSize * 0.7);

    const small = layoutGaugeText({ geometry: { radius: 6, barWidth: 1 }, shape: 'circle', parts: both, ...texts });
    expect(small.value!.fontSize).toBeLessThan(6 / 0.7);
    expect(small.value!.unitFontSize).toBe(6);
  });

  // Core gives the name the smaller height (0.45 × radius^0.86) only when the value and the name both show. The
  // name height is a part of the lift of an arc gauge, also when the name does not show.
  // https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/RadialGauge/RadialText.tsx
  it('lifts a value with no name by the name height of one text, as core', () => {
    const large = { radius: 300, barWidth: 60 };
    const nameOnly = layoutGaugeText({
      geometry: large,
      shape: 'gauge',
      parts: { showValue: false, showName: true },
      ...texts,
    });
    const valueOnly = layoutGaugeText({
      geometry: large,
      shape: 'gauge',
      parts: { showValue: true, showName: false },
      ...texts,
    });
    const lineHeight = 1.21;
    const lift = (valueOnly.value!.fontSize * lineHeight + nameOnly.name!.fontSize * lineHeight) / 4;
    expect(valueOnly.value!.offsetY).toBeCloseTo(-lift, 6);
  });

  it('moves the text of an arc gauge up from the center', () => {
    const circle = layoutGaugeText({ geometry, shape: 'circle', parts: both, ...texts });
    const arc = layoutGaugeText({ geometry, shape: 'gauge', parts: both, ...texts });
    expect(arc.value!.offsetY).toBeLessThan(circle.value!.offsetY);
    expect(arc.name!.offsetY).toBeLessThan(circle.name!.offsetY);
  });

  it('makes the font smaller for a longer text', () => {
    const short = layoutGaugeText({ geometry, shape: 'circle', parts: both, ...texts });
    const long = layoutGaugeText({ geometry, shape: 'circle', parts: both, ...texts, valueText: '1 234 567.89 req/s' });
    expect(long.value!.fontSize).toBeLessThan(short.value!.fontSize);
  });

  it('keeps the name readable in a small gauge', () => {
    const layout = layoutGaugeText({ geometry: { radius: 12, barWidth: 2 }, shape: 'gauge', parts: both, ...texts });
    expect(layout.name!.fontSize).toBe(10);
  });
});
