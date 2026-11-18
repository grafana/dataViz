import { getStatIssue, STAT_ISSUE_MESSAGES } from './statIssue';

describe('getStatIssue', () => {
  it('gives no issue when the panel has a value', () => {
    expect(getStatIssue(1, undefined)).toBeUndefined();
    expect(getStatIssue(3, 'N/A')).toBeUndefined();
  });

  it('gives the fix steps when the panel has no value', () => {
    expect(getStatIssue(0, undefined)).toEqual({
      reason: 'no-values',
      message: STAT_ISSUE_MESSAGES['no-values'],
      needsNumberField: true,
    });
  });

  it('gives the text of the No value option when the panel has no value and the option is set', () => {
    expect(getStatIssue(0, 'N/A')).toEqual({ reason: 'no-values', message: 'N/A' });
  });
});
