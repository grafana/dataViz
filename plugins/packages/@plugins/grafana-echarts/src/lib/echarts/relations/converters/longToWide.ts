// Root specifier deliberately: `rxjs` is an exact-string webpack external
// (`.config/bundler/externals.ts`), so `rxjs/operators` would be bundled instead of
// taken from the host.
import {
  type CustomTransformOperator,
  type DataFrame,
  type Field,
  FieldType,
  formatLabels,
  type Labels,
  TIME_SERIES_TIME_FIELD_NAME,
} from '@grafana/data';
import { debug, LOG_LEVELS } from 'development';

import {
  contestedIds,
  edgeId,
  edgeLabels,
  edgesWideFrame,
  nodesWideFrame,
  numberAt,
  uniqueId,
  withEndpointLabelsMeta,
  withoutEndpoints,
} from 'lib/echarts/relations/converters/toGraphWide';
import { type RelationsFamilyField } from 'lib/grafana/fields/relationsFields';
import { map } from 'rxjs';

import {
  aliasEndpointKeys,
  endpointLabelKeysOf,
  endpointLabelsOf,
  endpointsFromName,
  GRAPH_EDGES_WIDE,
  GRAPH_NODES_WIDE,
  type GraphEndpointKeys,
  type GraphEndpoints,
  isCanonicalEndpointKeys,
} from 'lib/echarts/relations/converters/contract';
import { isEdgesWideFrame } from 'lib/echarts/relations/converters/frameRoles';

/** Convert a long graph response. */

/** The row dimension of a long series. A datasource response always has one. */
function rowField(frame: DataFrame): Field | undefined {
  return frame.fields.find((field) => field.type === FieldType.time);
}

/** Return the numeric field of a long series. */
function seriesValueField(frame: DataFrame): Field | undefined {
  const numeric = frame.fields.filter((field) => field.type === FieldType.number);
  return numeric.length === 1 ? numeric[0] : undefined;
}

/** True when a frame is one edge of a long graph response. */
export function isLongEdgesFrame(frame: DataFrame): boolean {
  if (frame.meta?.type === GRAPH_EDGES_WIDE || frame.meta?.type === GRAPH_NODES_WIDE) {
    return false;
  }
  if (!rowField(frame)) {
    return false;
  }
  const value = seriesValueField(frame);
  if (!value || endpointsFromName(value.name, value.labels) != null) {
    return false;
  }
  return endpointLabelsOf(value) != null || wireEndpoints(frame, value) != null;
}

/** The long edge series in a response. */
function longEdgeSeries(frames: DataFrame[]): DataFrame[] {
  const claimed = new Set(frames.filter(isLongEdgesFrame));
  if (claimed.size === 0) {
    return [];
  }
  return frames.some((frame) => !claimed.has(frame) && isEdgesWideFrame(frame)) ? [] : [...claimed];
}

/** True when these frames are a long graph response in need of the pivot. */
export function isLongGraphFrames(frames: DataFrame[]): boolean {
  return longEdgeSeries(frames).length > 0;
}

/** The id the wire already gave a series, if it gave one. */
function wireId(frame: DataFrame, value: Field): string | undefined {
  const fromDS = value.config.displayNameFromDS;
  if (fromDS != null && fromDS !== '') {
    return fromDS;
  }
  const name = frame.name;
  return name != null && name !== '' && name !== formatLabels(value.labels ?? {}) ? name : undefined;
}

/**
 * True when a frame is one node stat of a long graph response: a long series that is not an
 * edge, whose wire id names an endpoint of the converted edges. The endpoint match keeps an
 * unrelated series in the same response out of the nodes frame.
 */
function isLongNodeFrame(frame: DataFrame, endpoints: ReadonlySet<string>): boolean {
  if (frame.meta?.type === GRAPH_EDGES_WIDE || frame.meta?.type === GRAPH_NODES_WIDE || !rowField(frame)) {
    return false;
  }
  const value = seriesValueField(frame);
  if (!value || isLongEdgesFrame(frame)) {
    return false;
  }
  const id = wireId(frame, value);
  return id != null && endpoints.has(id);
}

/** The endpoints a series' wire id carries, when it is an edge id rather than a name. */
function wireEndpoints(frame: DataFrame, value: Field): GraphEndpoints | undefined {
  const id = wireId(frame, value);
  return id != null ? endpointsFromName(id, value.labels) : undefined;
}

/** The joined row dimension: every timestamp any series carries, ascending. */
function joinedRows(series: DataFrame[]): number[] {
  const rows = new Set<number>();
  for (const frame of series) {
    const time = rowField(frame);
    for (let row = 0; row < (time?.values.length ?? 0); row++) {
      const at = numberAt(time, row);
      if (at != null) {
        rows.add(at);
      }
    }
  }
  return [...rows].sort((first, second) => first - second);
}

/** A series' values on the joined rows. */
function valuesOnRows(rows: number[], time: Field, value: Field): Array<number | null> {
  const byRow = new Map<number, number | null>();
  for (let row = 0; row < time.values.length; row++) {
    const at = numberAt(time, row);
    if (at != null) {
      byRow.set(at, numberAt(value, row));
    }
  }
  return rows.map((at) => byRow.get(at) ?? null);
}

/** One series' contribution to the pivot, before its id is settled. */
interface Mark {
  time: Field;
  value: Field;
  endpoints: GraphEndpoints;
  /** Label keys that supplied the endpoints. */
  keys?: GraphEndpointKeys;
  /** The keys the endpoints' *values* are also under, recovered by value. */
  alias?: GraphEndpointKeys;
  /** Labels that distinguish parallel edges. */
  rest: Labels;
  /** The id it wants, before contested ones are told apart. */
  base: string;
}

function marksOf(series: DataFrame[]): Mark[] {
  const marks: Mark[] = [];
  for (const frame of series) {
    const time = rowField(frame);
    const value = seriesValueField(frame);
    const keys = value ? endpointLabelKeysOf(value) : undefined;
    // Prefer label endpoints over wire-id endpoints.
    const endpoints: GraphEndpoints | undefined =
      (value && endpointLabelsOf(value)) ?? (value && wireEndpoints(frame, value)) ?? undefined;
    // `isLongEdgesFrame` guarantees these values.
    if (!time || !value || !endpoints) {
      continue;
    }
    marks.push({
      time,
      value,
      endpoints,
      ...(keys ? { keys } : {}),
      // Record aliases before the pivot writes canonical endpoint keys.
      ...pickAlias(aliasEndpointKeys(value, endpoints, keys)),
      // The pair this series actually used, so a `client`/`server` response does not put
      // its whole topology into the parallel-edge discriminator.
      rest: withoutEndpoints(value.labels, keys),
      base: wireId(frame, value) ?? edgeId(endpoints.source, endpoints.target),
    });
  }
  return marks;
}

/** `exactOptionalPropertyTypes` is on, so an absent alias is an absent key. */
function pickAlias(alias: GraphEndpointKeys | undefined): { alias?: GraphEndpointKeys } {
  return alias ? { alias } : {};
}

/** Return shared non-canonical endpoint keys. */
function commonEndpointKeys(marks: Mark[]): GraphEndpointKeys | undefined {
  return commonPair(marks.map((mark) => mark.keys)) ?? commonPair(marks.map((mark) => mark.alias));
}

/** One pair, when every mark agrees on it and it is worth declaring. */
function commonPair(pairs: Array<GraphEndpointKeys | undefined>): GraphEndpointKeys | undefined {
  const [first] = pairs;
  if (!first || isCanonicalEndpointKeys(first)) {
    return undefined;
  }
  return pairs.every((pair) => pair?.source === first.source && pair?.target === first.target) ? first : undefined;
}

/** The name a datasource gives a value column, where no id is implied. */
const VALUE_FIELD_NAME = 'Value';

/** `Value`, and `Value #A` when a panel runs several queries. */
function isGenericValueName(name: string): boolean {
  return name === VALUE_FIELD_NAME || name.startsWith(`${VALUE_FIELD_NAME} #`);
}

/** Warn when the pivot renames the only mark in the response. */
function warnIfWideLookalike(marks: Mark[], ids: string[]): void {
  if (marks.length !== 1) {
    return;
  }
  const [{ value }] = marks;
  const [id] = ids;
  if (id === value.name || isGenericValueName(value.name)) {
    return;
  }
  debug(
    `Note: relations pivoted a single labelled series and renamed its edge "${value.name}" to "${id}". ` +
      'If that frame was already `graph-edges-wide`, declare `meta.type` on it — or name the edge ' +
      '`source-->target` — so the conversion leaves it alone; a `byName` override on the old name ' +
      'no longer matches.',
    LOG_LEVELS.warn,
    { from: value.name, to: id, labels: value.labels }
  );
}

/** The row field of a pivoted frame. Keep the time-field name, but discard stale display configuration. */
function rowsField(first: DataFrame, rows: number[]): RelationsFamilyField {
  return { name: rowField(first)?.name ?? TIME_SERIES_TIME_FIELD_NAME, type: FieldType.time, config: {}, values: rows };
}

/** One numeric field per edge series, on the shared row dimension. */
function pivot(series: DataFrame[], marks: Mark[], rows: number[]): DataFrame {
  const first = series[0];
  const fields: RelationsFamilyField[] = [rowsField(first, rows)];

  const contested = contestedIds(marks.map((mark) => mark.base));
  const taken = new Set<string>();
  const ids: string[] = [];
  for (const mark of marks) {
    const id = uniqueId(taken, mark.base, mark.rest, contested.has(mark.base));
    taken.add(id);
    ids.push(id);
    fields.push({
      name: id,
      type: FieldType.number,
      labels: edgeLabels(mark.rest, mark.endpoints),
      // Keep all field configuration for formatting, links, and overrides.
      config: { ...mark.value.config },
      values: valuesOnRows(rows, mark.time, mark.value),
    });
  }

  warnIfWideLookalike(marks, ids);
  debug(
    `Note: relations pivoted ${marks.length} long graph series into one graph-edges-wide frame ` +
      `over ${rows.length} row(s). Without it the reader would still draw every edge, but they would ` +
      'share one field name and no per-edge override could address them.',
    LOG_LEVELS.info,
    { edges: ids, rows: rows.length, refId: first.refId }
  );

  // Preserve query metadata and record endpoint aliases before writing canonical labels.
  return edgesWideFrame(
    { refId: first.refId, meta: withEndpointLabelsMeta(first.meta, commonEndpointKeys(marks)) },
    fields
  );
}

/** One numeric field per node series, named by its wire id, on the shared row dimension. */
function pivotNodes(series: DataFrame[], rows: number[]): DataFrame {
  const first = series[0];
  const fields: RelationsFamilyField[] = [rowsField(first, rows)];

  const values = series.flatMap((frame) => {
    const time = rowField(frame);
    const value = seriesValueField(frame);
    const id = value ? wireId(frame, value) : undefined;
    // `isLongNodeFrame` guarantees these values.
    return time && value && id != null ? [{ time, value, id }] : [];
  });
  const contested = contestedIds(values.map(({ id }) => id));
  const taken = new Set<string>();
  for (const { time, value, id: base } of values) {
    const labels = value.labels ?? {};
    const id = uniqueId(taken, base, labels, contested.has(base));
    taken.add(id);
    fields.push({
      name: id,
      type: FieldType.number,
      // Keep the original labels, so ad hoc filters use the label names of the query.
      labels: { ...labels },
      config: { ...value.config },
      values: valuesOnRows(rows, time, value),
    });
  }

  debug(`Note: relations pivoted ${values.length} long node series into one graph-nodes-wide frame.`, LOG_LEVELS.info, {
    nodes: fields.slice(1).map((field) => field.name),
    refId: first.refId,
  });
  return nodesWideFrame({ refId: first.refId, ...(first.meta ? { meta: first.meta } : {}) }, fields);
}

/** Pivot a long graph response into one wide edges frame, and its node series into one wide nodes frame. */
export function longToWide(frames: DataFrame[]): DataFrame[] {
  const series = longEdgeSeries(frames);
  if (series.length === 0) {
    return frames;
  }

  const marks = marksOf(series);
  const endpoints = new Set(marks.flatMap(({ endpoints }) => [endpoints.source, endpoints.target]));
  const claimed = new Set(series);
  const nodeSeries = frames.filter((frame) => !claimed.has(frame) && isLongNodeFrame(frame, endpoints));
  // Edges and nodes share one row dimension, so the time slider reads both at the same stop.
  const rows = joinedRows([...series, ...nodeSeries]);

  const pivoted = new Map<DataFrame, DataFrame>([[series[0], pivot(series, marks, rows)]]);
  if (nodeSeries.length > 0) {
    pivoted.set(nodeSeries[0], pivotNodes(nodeSeries, rows));
  }
  for (const frame of nodeSeries) {
    claimed.add(frame);
  }
  return frames.flatMap((frame) => {
    if (!claimed.has(frame)) {
      return [frame];
    }
    const out = pivoted.get(frame);
    return out ? [out] : [];
  });
}

/** `longToWide` as a transformation the host can run above the panel. */
export const longToWideOperator: CustomTransformOperator = () => (source) => source.pipe(map(longToWide));
