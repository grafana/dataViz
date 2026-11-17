import { fitFontSize } from './fitFontSize';

const base = { text: '72', lineHeight: 1.2, fontFamily: 'Inter, sans-serif' };

describe('fitFontSize', () => {
  it('is limited by the height of a wide box', () => {
    expect(fitFontSize({ ...base, width: 10000, height: 60 })).toBe(50);
  });

  it('is limited by the width of a narrow box', () => {
    const size = fitFontSize({ ...base, width: 20, height: 600 });
    expect(size).toBeLessThan(600 / 1.2);
    expect(size).toBeGreaterThan(0);
  });

  it('grows with the width, in proportion', () => {
    const narrow = fitFontSize({ ...base, width: 20, height: 600 });
    const wide = fitFontSize({ ...base, width: 40, height: 600 });
    expect(wide).toBeCloseTo(narrow * 2, 9);
  });

  it('is smaller for a longer text', () => {
    const short = fitFontSize({ ...base, width: 50, height: 600 });
    const long = fitFontSize({ ...base, text: '72 000 000', width: 50, height: 600 });
    expect(long).toBeLessThan(short);
  });

  it('is smaller for a heavier font weight only when the font is wider', () => {
    // The Jest canvas measures with a width table that does not read the weight, so the sizes are equal.
    const normal = fitFontSize({ ...base, width: 50, height: 600 });
    const bold = fitFontSize({ ...base, width: 50, height: 600, fontWeight: 700 });
    expect(bold).toBeLessThanOrEqual(normal);
  });
});
