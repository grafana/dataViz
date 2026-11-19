import { FieldType, toDataFrame } from '@grafana/data';
import { GAUGE_ISSUE_MESSAGES, getGaugeIssue } from './gaugeIssue';

const frame = (type: FieldType, values: unknown[]) => toDataFrame({ fields: [{ name: 'load', type, values }] });

describe('getGaugeIssue', () => {
  it('gives no issue for a number field with a value', () => {
    expect(getGaugeIssue([frame(FieldType.number, [1])])).toBeUndefined();
  });

  it('tells the user to convert a text field that has numbers', () => {
    expect(getGaugeIssue([frame(FieldType.string, ['12.5', '7'])])).toEqual({
      reason: 'number-as-text',
      message: GAUGE_ISSUE_MESSAGES['number-as-text']('load'),
      needsNumberField: true,
    });
  });

  it.each([
    ['a text field with no numbers', [frame(FieldType.string, ['a', 'b'])]],
    ['a number field with no value', [frame(FieldType.number, [])]],
    ['no frame', []],
  ])('tells the user to add a number field for %s', (_, frames) => {
    expect(getGaugeIssue(frames)).toEqual({
      reason: 'number-field-missing',
      message: GAUGE_ISSUE_MESSAGES['number-field-missing'],
      needsNumberField: true,
    });
  });
});
