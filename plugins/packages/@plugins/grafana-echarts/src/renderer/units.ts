// The `unit-unknown` check (`state.9`). `getValueFormat` never throws for an unknown id: it shows the id as a
// suffix. So the check looks the id up in the formatter index of `@grafana/data`.
// https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/valueFormats/valueFormats.ts
import { getValueFormatterIndex } from '@grafana/data';

/** The prefixes that `getValueFormat` reads as `<prefix>:<argument>`, for example `suffix:req` or `currency:EUR`. */
const PREFIXES = ['prefix:', 'suffix:', 'time:', 'si:', 'count:', 'currency:', 'bool:'];

/** True when `unit` is a key of `getValueFormatterIndex()`, or starts with a prefix of `PREFIXES`. */
export const isUnitId = (unit: string): boolean =>
  Object.hasOwn(getValueFormatterIndex(), unit) || PREFIXES.some((prefix) => unit.startsWith(prefix));
