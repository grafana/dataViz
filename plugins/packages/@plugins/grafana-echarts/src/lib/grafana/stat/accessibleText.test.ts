import { type DisplayValue, type FieldDisplay } from '@grafana/data';
import { getStatAccessibleText } from './accessibleText';

const value = (display: Partial<DisplayValue>, name = 'field'): FieldDisplay =>
  ({ name, display: { text: '', numeric: 0, ...display } }) as FieldDisplay;

describe('getStatAccessibleText', () => {
  it('gives the name and the value of one value, with the suffix', () => {
    expect(getStatAccessibleText([value({ title: 'cpu', text: '72', suffix: '%' })])).toBe('cpu: 72%');
  });

  it('gives the prefix of a value', () => {
    expect(getStatAccessibleText([value({ title: 'cost', text: '12', prefix: '$' })])).toBe('cost: $12');
  });

  it('gives each value in the order of the cells', () => {
    const text = getStatAccessibleText([value({ title: 'cpu', text: '72' }), value({ title: 'memory', text: '65' })]);
    expect(text).toBe('cpu: 72; memory: 65');
  });

  it('gives the percent change of a value that has one', () => {
    expect(getStatAccessibleText([value({ title: 'cpu', text: '72', percentChange: 106 })])).toBe(
      'cpu: 72, change 106%'
    );
    expect(getStatAccessibleText([value({ title: 'cpu', text: '72', percentChange: -25 })])).toBe(
      'cpu: 72, change -25%'
    );
  });

  it('gives no percent change when Grafana has no number for it', () => {
    expect(getStatAccessibleText([value({ title: 'cpu', text: '72', percentChange: NaN })])).toBe('cpu: 72');
  });

  it('uses the name of the field for a value with no title', () => {
    expect(getStatAccessibleText([value({ text: '72' }, 'cpu')])).toBe('cpu: 72');
  });

  it('gives only the value when there is no name', () => {
    expect(getStatAccessibleText([value({ text: '72' }, '')])).toBe('72');
  });

  it('gives no text for no value', () => {
    expect(getStatAccessibleText([])).toBeUndefined();
  });
});
