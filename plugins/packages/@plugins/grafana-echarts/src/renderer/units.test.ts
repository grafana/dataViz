import { isUnitId } from './units';

describe('isUnitId', () => {
  // contract-rule: state.9
  // `farenheit` is an alias of the index, not an item of `getValueFormats()`.
  it.each(['bytes', 'percent', 'short', 'reqps', 'ms', 'dateTimeAsIso', 'farenheit'])(
    'accepts the unit id %s',
    (unit) => {
      expect(isUnitId(unit)).toBe(true);
    }
  );

  it.each(['suffix:req', 'prefix:$', 'si:mW', 'count:items', 'currency:EUR', 'time:YYYY', 'bool:on/off', 'suffix:'])(
    'accepts the prefix form %s',
    (unit) => {
      expect(isUnitId(unit)).toBe(true);
    }
  );

  it.each(['foo', 'Bytes', ':x', 'nope:x', 'toString'])('rejects %s', (unit) => {
    expect(isUnitId(unit)).toBe(false);
  });
});
