import { isUnitId } from './units';

describe('isUnitId', () => {
  // contract-rule: state.9
  it.each(['bytes', 'percent', 'short', 'reqps', 'ms', 'dateTimeAsIso'])('accepts the unit id %s', (unit) => {
    expect(isUnitId(unit)).toBe(true);
  });

  it.each(['suffix:req', 'prefix:$', 'si:mW', 'count:items', 'currency:EUR', 'time:YYYY', 'bool:on/off'])(
    'accepts the prefix form %s',
    (unit) => {
      expect(isUnitId(unit)).toBe(true);
    }
  );

  it.each(['foo', 'Bytes', 'suffix:', ':x', 'nope:x'])('rejects %s', (unit) => {
    expect(isUnitId(unit)).toBe(false);
  });
});
