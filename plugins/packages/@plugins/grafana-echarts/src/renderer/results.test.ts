import { orderedResults } from './results';

const results = { B: { frames: [] }, C: { frames: [] }, A: { frames: [] } };
const refIds = (entries: ReturnType<typeof orderedResults>) => entries.map(([refId]) => refId);

describe('orderedResults', () => {
  // contract-rule: spec.11
  it('follows the order of the targets', () => {
    expect(refIds(orderedResults(['A', 'B', 'C'], results))).toEqual(['A', 'B', 'C']);
  });

  it('uses the key order with no targets', () => {
    expect(refIds(orderedResults([], results))).toEqual(['B', 'C', 'A']);
  });

  it('puts a result with no target last, and leaves out a target with no result', () => {
    expect(refIds(orderedResults(['C', 'Z', 'A', 'C'], results))).toEqual(['C', 'A', 'B']);
  });
});
