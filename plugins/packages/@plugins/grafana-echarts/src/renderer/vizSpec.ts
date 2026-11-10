// The viz spec after the checks of `parseSpec`, with the defaults of the optional fields.
// Shape: `@grafana/viz-contract/schemas/viz-spec.schema.json`.
import { type DataFrameJSON, type FieldConfigSource } from '@grafana/data';
import { type Notice } from '@grafana/viz-contract/renderer-api';

/** One entry of `data.results`: the result of one query. The Renderer does not read `status`. */
export interface QueryResult {
  frames: DataFrameJSON[];
  error?: string;
}

export interface VizSpec {
  specVersion: number;
  panel: {
    type: string;
    options: Record<string, unknown>;
    fieldConfig: FieldConfigSource;
    /** The refIds of `panel.targets`, in order. Empty when the spec has no targets. */
    targetRefIds: string[];
  };
  data: {
    range: { from: number; to: number };
    capturedAt: number;
    results: Record<string, QueryResult>;
  };
  /** The notices of the App (`spec.8`). */
  notices: Notice[];
  theme: 'dark' | 'light';
  timeZone: string;
}
