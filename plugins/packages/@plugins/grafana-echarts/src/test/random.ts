/**
 * Replace `Math.random` with a seeded generator (mulberry32), so a force layout draws the same picture on each run.
 * ECharts starts each force node without a position at a random point.
 * https://github.com/apache/echarts/blob/master/src/chart/graph/forceHelper.ts
 */
export function seedMathRandom(seed = 1): jest.SpyInstance<number, []> {
  let state = seed >>> 0;
  return jest.spyOn(Math, 'random').mockImplementation(() => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}
