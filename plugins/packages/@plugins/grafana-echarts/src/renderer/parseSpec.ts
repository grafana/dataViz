// The checks of the viz spec (`state.3`), in the order of the `errors` list of `states.json`. They never throw
// (`renderer.3`), and they ignore the fields that they do not know (`spec.9`).
import { type ConfigOverrideRule, type DataFrameJSON, type FieldConfigSource } from '@grafana/data';
import { type Notice, type RenderError } from '@grafana/viz-contract/renderer-api';
import { errorMessage } from './messages';
import { PANEL_IDS, type SpecErrorCode } from './registry';
import { orderedResults } from './results';
import specVersions from './specVersions.json';
import { type QueryResult, type VizSpec } from './vizSpec';

export type ParseResult = { ok: true; spec: VizSpec } | { ok: false; error: RenderError };

/**
 * The viz spec versions that this Renderer supports. `index.ts` exports the same list, and
 * `scripts/renderer-manifest.mjs` writes it into the manifest (`delivery.2`).
 */
export const SUPPORTED_SPEC_VERSIONS: readonly number[] = specVersions;

type JsonObject = Record<string, unknown>;

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The path below the frame of the first part that breaks the frame schema, `''` for the frame itself, or `undefined`
 * when the frame matches it. The schema needs `schema`, a `name` in each field, and an array for each entry of
 * `data.values`. A frame that matches the schema but that `dataFrameFromJSON` cannot read, for example one with no
 * `schema.fields`, gives `render-error` when the Renderer draws.
 * https://grafana.com/developers/plugin-tools/key-concepts/data-frames
 */
function frameProblem(frame: unknown): string | undefined {
  if (!isObject(frame)) {
    return '';
  }
  const { schema, data } = frame;
  if (!isObject(schema)) {
    return '.schema';
  }
  if (schema.fields !== undefined) {
    if (!Array.isArray(schema.fields)) {
      return '.schema.fields';
    }
    const field = schema.fields.findIndex((item) => !isObject(item) || typeof item.name !== 'string');
    if (field >= 0) {
      return isObject(schema.fields[field]) ? `.schema.fields.${field}.name` : `.schema.fields.${field}`;
    }
  }
  if (data !== undefined) {
    if (!isObject(data)) {
      return '.data';
    }
    if (data.values !== undefined) {
      if (!Array.isArray(data.values)) {
        return '.data.values';
      }
      const values = data.values.findIndex((item) => !Array.isArray(item));
      if (values >= 0) {
        return `.data.values.${values}`;
      }
    }
  }
  return undefined;
}

/** A frame in the JSON of `/api/ds/query` that matches the frame schema. */
const isFrameJson = (value: unknown): value is DataFrameJSON => frameProblem(value) === undefined;

/** The path of the first frame in `results` that breaks the frame schema, in the order of the entries. */
function firstFrameProblem(results: JsonObject): string | undefined {
  for (const [refId, result] of Object.entries(results)) {
    const frames = isObject(result) && Array.isArray(result.frames) ? result.frames : [];
    for (const [index, frame] of frames.entries()) {
      const problem = frameProblem(frame);
      if (problem !== undefined) {
        return `data.results.${refId}.frames.${index}${problem}`;
      }
    }
  }
  return undefined;
}

/** The required fields of the schema, after the presence check. Their values are not checked yet. */
interface RequiredFields {
  specVersion: unknown;
  panel: JsonObject & { type: unknown };
  data: { range: { from: number; to: number }; capturedAt: number; results: JsonObject };
}

/**
 * The required fields of the schema, or the first one that is missing, as a dotted path, in the order of the schema.
 * A field of the wrong JSON type counts as missing. A spec that is not an object has no fields, so its first
 * missing field is `specVersion`. The frames are checked last (`firstFrameProblem`).
 */
function readRequired(input: unknown): RequiredFields | { missing: string } {
  if (!isObject(input) || input.specVersion == null) {
    return { missing: 'specVersion' };
  }
  const { panel, data } = input;
  if (!isObject(panel)) {
    return { missing: 'panel' };
  }
  if (panel.type == null) {
    return { missing: 'panel.type' };
  }
  if (!isObject(data)) {
    return { missing: 'data' };
  }
  const { range, capturedAt, results } = data;
  if (!isObject(range)) {
    return { missing: 'data.range' };
  }
  const { from, to } = range;
  if (typeof from !== 'number') {
    return { missing: 'data.range.from' };
  }
  if (typeof to !== 'number') {
    return { missing: 'data.range.to' };
  }
  if (typeof capturedAt !== 'number') {
    return { missing: 'data.capturedAt' };
  }
  if (!isObject(results)) {
    return { missing: 'data.results' };
  }
  const frame = firstFrameProblem(results);
  if (frame !== undefined) {
    return { missing: frame };
  }
  return {
    specVersion: input.specVersion,
    panel: { ...panel, type: panel.type },
    data: { range: { from, to }, capturedAt, results },
  };
}

/**
 * A result entry with its optional fields checked. An entry that is not an object has no frames and no error.
 * `readRequired` already checked the frames, so `isFrameJson` only narrows the type here.
 */
function toQueryResult(value: unknown): QueryResult {
  if (!isObject(value)) {
    return { frames: [] };
  }
  return {
    frames: Array.isArray(value.frames) ? value.frames.filter(isFrameJson) : [],
    error: typeof value.error === 'string' ? value.error : undefined,
  };
}

/** An override that `applyFieldOverrides` can read: a matcher with an id, and a list of properties. */
const isOverride = (value: unknown): value is ConfigOverrideRule =>
  isObject(value) && isObject(value.matcher) && typeof value.matcher.id === 'string' && Array.isArray(value.properties);

/** `panel.fieldConfig`, with `{}` and `[]` for missing parts. An override with no matcher is left out. */
function toFieldConfig(value: unknown): FieldConfigSource {
  const fieldConfig = isObject(value) ? value : {};
  return {
    defaults: isObject(fieldConfig.defaults) ? fieldConfig.defaults : {},
    overrides: Array.isArray(fieldConfig.overrides) ? fieldConfig.overrides.filter(isOverride) : [],
  };
}

const toNotices = (value: unknown): Notice[] =>
  Array.isArray(value)
    ? value
        .filter(isObject)
        .flatMap(({ code, message }) =>
          typeof code === 'string' && typeof message === 'string' ? [{ code, message }] : []
        )
    : [];

const toTargetRefIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(isObject).flatMap((target) => (typeof target.refId === 'string' ? [target.refId] : []))
    : [];

const fail = (code: SpecErrorCode, values: Record<string, string>): ParseResult => ({
  ok: false,
  error: { code, message: errorMessage(code, values) },
});

export function parseSpec(input: unknown): ParseResult {
  const required = readRequired(input);
  if ('missing' in required || !isObject(input)) {
    return fail('invalid-spec', { field: 'missing' in required ? required.missing : 'specVersion' });
  }
  const { specVersion, panel, data } = required;

  if (typeof specVersion !== 'number' || !SUPPORTED_SPEC_VERSIONS.includes(specVersion)) {
    return fail('unsupported-spec-version', { n: String(specVersion), list: SUPPORTED_SPEC_VERSIONS.join(', ') });
  }

  const { type } = panel;
  if (typeof type !== 'string' || !PANEL_IDS.includes(type)) {
    return fail('unsupported-panel-type', { type: String(type), list: PANEL_IDS.join(', ') });
  }

  const results = Object.fromEntries(
    Object.entries(data.results).map(([refId, value]) => [refId, toQueryResult(value)])
  );
  const targetRefIds = toTargetRefIds(panel.targets);

  // `state.18`: one line for each entry, in the order of the targets.
  const ordered = orderedResults(targetRefIds, results);
  if (ordered.length > 0 && ordered.every(([, result]) => result.error !== undefined)) {
    return {
      ok: false,
      error: {
        code: 'all-queries-failed',
        message: ordered
          .map(([refId, result]) => errorMessage('all-queries-failed', { refId, error: result.error ?? '' }))
          .join('\n'),
      },
    };
  }

  return {
    ok: true,
    spec: {
      specVersion,
      panel: {
        type,
        options: isObject(panel.options) ? panel.options : {},
        fieldConfig: toFieldConfig(panel.fieldConfig),
        targetRefIds,
      },
      data: { ...data, results },
      notices: toNotices(input.notices),
      // `spec.14`: with no theme, the dark theme.
      theme: input.theme === 'light' ? 'light' : 'dark',
      timeZone: typeof input.timeZone === 'string' && input.timeZone !== '' ? input.timeZone : 'browser',
    },
  };
}
