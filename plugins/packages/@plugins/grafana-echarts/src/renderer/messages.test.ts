import notices from './contract/registry/notices.json';
import states from './contract/registry/states.json';
import { errorMessage, fillPattern, noticeMessage, refreshMessage } from './messages';
import { SPEC_ERROR_CODES } from './registry';

describe('fillPattern', () => {
  it('replaces each placeholder, also one with a space in its name', () => {
    expect(fillPattern('Query <refId> failed: <error>', { refId: 'A', error: 'x' })).toBe('Query A failed: x');
    expect(fillPattern('<panel message>', { 'panel message': 'No time field' })).toBe('No time field');
  });

  it('does not scan a value again', () => {
    expect(fillPattern('Query <refId> failed: <error>', { refId: '<error>', error: '<refId>' })).toBe(
      'Query <error> failed: <refId>'
    );
  });

  it('keeps a placeholder with no value', () => {
    expect(fillPattern('a <b> c', {})).toBe('a <b> c');
  });
});

describe('registry messages', () => {
  // contract-rule: state.6
  it('has a pattern for each error code', () => {
    const codes = states.errors.map((row) => row.code);
    expect(codes).toEqual([...SPEC_ERROR_CODES, 'panel-error', 'render-error']);
    for (const code of [...SPEC_ERROR_CODES, 'panel-error', 'render-error'] as const) {
      expect(errorMessage(code, {})).toEqual(expect.any(String));
    }
  });

  it('builds the render-error message from the panel name', () => {
    expect(errorMessage('render-error', { panelName: 'XY chart' })).toBe('This data cannot be shown as a XY chart.');
  });

  it('has a pattern for each refresh code', () => {
    expect(refreshMessage('refresh-failed', { error: 'boom' })).toBe('Refresh failed: boom');
    expect(refreshMessage('refresh-failed-no-detail')).toBe('Refresh failed.');
    expect(refreshMessage('refresh-timeout')).toBe('Refresh failed: no result in time.');
  });

  it('has a pattern for each notice code', () => {
    for (const row of notices.notices) {
      expect(noticeMessage(row.code, {})).toBe(row.message);
    }
    expect(() => noticeMessage('nope', {})).toThrow();
  });
});
