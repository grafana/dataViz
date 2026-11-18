import { keepSingleStatOptions } from './singleStat';

describe('keepSingleStatOptions', () => {
  it('keeps the reduction of the data and the orientation', () => {
    const prevOptions = {
      reduceOptions: { values: false, calcs: ['mean'], fields: '/^cpu$/', limit: 3 },
      orientation: 'vertical',
    };
    expect(keepSingleStatOptions(prevOptions)).toEqual(prevOptions);
  });

  it('leaves out each other option', () => {
    const kept = keepSingleStatOptions({
      orientation: 'horizontal',
      showThresholdLabels: true,
      displayMode: 'lcd',
      legend: { showLegend: true },
    });
    expect(kept).toEqual({ orientation: 'horizontal' });
  });

  it('gives no option when the previous panel has none of the two', () => {
    expect(keepSingleStatOptions({ legend: { showLegend: true } })).toEqual({});
    expect(keepSingleStatOptions({})).toEqual({});
  });

  it('gives no reference to a value of the previous panel', () => {
    const reduceOptions = { values: false, calcs: ['mean'] };
    expect(keepSingleStatOptions({ reduceOptions }).reduceOptions).not.toBe(reduceOptions);
  });
});
