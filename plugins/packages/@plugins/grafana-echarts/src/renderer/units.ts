// The `unit-unknown` check (`state.9`). `getValueFormat` never throws for an unknown id: it falls back to a suffix
// formatter. So the check looks the id up in the unit list of `@grafana/data`.
// https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/valueFormats/valueFormats.ts
import { getValueFormats } from '@grafana/data';

/** The prefixes that `getValueFormat` reads as `<prefix>:<argument>`, for example `suffix:req` or `currency:EUR`. */
const PREFIXES = ['prefix', 'suffix', 'time', 'si', 'count', 'currency', 'bool'];

let unitIds: Set<string> | undefined;

/** True when `unit` is a unit id of `@grafana/data`, or a prefix form with an argument. */
export function isUnitId(unit: string): boolean {
  unitIds ??= new Set(getValueFormats().flatMap((category) => (category.submenu ?? []).map((item) => item.value)));
  if (unitIds.has(unit)) {
    return true;
  }
  const colon = unit.indexOf(':');
  return colon > 0 && colon < unit.length - 1 && PREFIXES.includes(unit.slice(0, colon));
}
