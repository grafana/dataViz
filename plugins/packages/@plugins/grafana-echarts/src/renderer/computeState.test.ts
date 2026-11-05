import { computeState, hasNoRows } from './computeState';

const notice = { code: 'query-failed', message: 'Query B failed: x' };
const error = { code: 'invalid-spec', message: 'm' };

describe('computeState', () => {
  // contract-rule: state.4
  it('gives ready after the draw, and no-data with no rows, with the notices', () => {
    expect(computeState({ kind: 'drawn', notices: [notice] })).toEqual({ state: 'ready', notices: [notice] });
    expect(computeState({ kind: 'no-data', notices: [notice] })).toEqual({ state: 'no-data', notices: [notice] });
  });

  // contract-rule: state.7
  it('gives no notices for a spec error or a render error, but keeps them for a panel error', () => {
    expect(computeState({ kind: 'error', error })).toEqual({ state: 'error', error, notices: [] });
    const panelError = { code: 'panel-error', message: 'p' };
    expect(computeState({ kind: 'panel-error', error: panelError, notices: [notice] })).toEqual({
      state: 'error',
      error: panelError,
      notices: [notice],
    });
  });

  it('finds frames with no rows', () => {
    expect(hasNoRows([])).toBe(true);
    expect(hasNoRows([{ length: 0 }, { length: 0 }])).toBe(true);
    expect(hasNoRows([{ length: 0 }, { length: 2 }])).toBe(false);
  });
});
