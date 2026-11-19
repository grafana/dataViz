import type * as fitFontSizeModule from './fitFontSize';
import { fitFontSize } from './fitFontSize';

const base = { text: '72', lineHeight: 1.2, fontFamily: 'Inter, sans-serif' };

/** A new copy of the module, so that a test starts with no canvas context, no font listener and no cache. */
const loadFresh = (): typeof fitFontSize => {
  let fresh: typeof fitFontSize | undefined;
  jest.isolateModules(() => {
    fresh = jest.requireActual<typeof fitFontSizeModule>('./fitFontSize').fitFontSize;
  });
  return fresh!;
};

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

  it.each([
    ['a negative width', -14, 60],
    ['a negative height', 50, -8],
    ['no width', 0, 60],
    ['no height', 50, 0],
    ['a width that is not a number', NaN, 60],
    ['a height that is not a number', 50, NaN],
  ])('gives 0 for a box with %s', (_, width, height) => {
    expect(fitFontSize({ ...base, width, height })).toBe(0);
  });

  describe('maxSize', () => {
    it('limits a size that the box permits', () => {
      expect(fitFontSize({ ...base, width: 10000, height: 60, maxSize: 30 })).toBe(30);
    });

    it('does not change a size below it', () => {
      expect(fitFontSize({ ...base, width: 10000, height: 60, maxSize: 80 })).toBe(50);
    });
  });

  describe('measurement', () => {
    const measureText = jest.spyOn(CanvasRenderingContext2D.prototype, 'measureText');

    beforeEach(() => measureText.mockClear());

    it('measures with the font family and the font weight of the input', () => {
      const fonts: string[] = [];
      measureText.mockImplementationOnce(function (this: CanvasRenderingContext2D) {
        fonts.push(this.font);
        return { width: 10 } as TextMetrics;
      });
      loadFresh()({ ...base, fontFamily: 'Helvetica', fontWeight: 500, width: 50, height: 600 });
      expect(fonts).toEqual(['500 14px Helvetica']);
    });

    it('measures a text one time for each font', () => {
      const fit = loadFresh();
      fit({ ...base, width: 50, height: 600 });
      fit({ ...base, width: 80, height: 600 });
      expect(measureText).toHaveBeenCalledTimes(1);
      fit({ ...base, fontWeight: 700, width: 50, height: 600 });
      expect(measureText).toHaveBeenCalledTimes(2);
    });
  });

  describe('font loading', () => {
    const fontSet = new EventTarget();

    beforeEach(() => Object.defineProperty(document, 'fonts', { value: fontSet, configurable: true }));
    afterEach(() => Reflect.deleteProperty(document, 'fonts'));

    it('measures a text again after the document loads a font', () => {
      const measureText = jest.spyOn(CanvasRenderingContext2D.prototype, 'measureText');
      measureText.mockClear();
      const fit = loadFresh();

      fit({ ...base, width: 50, height: 600 });
      fit({ ...base, width: 50, height: 600 });
      expect(measureText).toHaveBeenCalledTimes(1);

      fontSet.dispatchEvent(new Event('loadingdone'));
      fit({ ...base, width: 50, height: 600 });
      expect(measureText).toHaveBeenCalledTimes(2);
    });
  });

  // A host with no document takes the same path. jsdom does not let a test remove `document`, so that guard has
  // no test here.
  describe('a host with no 2D canvas', () => {
    let getContext: jest.SpyInstance;

    beforeEach(() => {
      getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    });
    afterEach(() => getContext.mockRestore());

    it('fits the text to the height only', () => {
      expect(loadFresh()({ ...base, width: 1, height: 60 })).toBe(50);
    });

    it('applies maxSize', () => {
      expect(loadFresh()({ ...base, width: 1, height: 60, maxSize: 20 })).toBe(20);
    });
  });
});
