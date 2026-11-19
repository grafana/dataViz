import { type ChartFamily } from './autoSeriesType';
import { drawsWhileStreaming } from './streaming';

describe('drawsWhileStreaming', () => {
  it('is true for the stat family', () => {
    expect(drawsWhileStreaming('stat')).toBe(true);
  });

  it.each<ChartFamily>([
    'cartesian',
    'heatmap',
    'part-to-whole',
    'multivariate',
    'hierarchy',
    'relations',
    'stream',
    'geo',
    'timeline',
    'status-history',
  ])('is false for the %s family', (family) => {
    expect(drawsWhileStreaming(family)).toBe(false);
  });
});
