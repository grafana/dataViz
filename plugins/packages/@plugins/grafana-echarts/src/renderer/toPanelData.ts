// The frames of the viz spec as the `PanelData` of the panel (`spec.11` to `spec.13`).
import { type DataFrame, dataFrameFromJSON, DataTopic, dateTime, LoadingState, type TimeRange } from '@grafana/data';
import { of } from 'rxjs';
import { frameWithoutCallOuts } from './callOuts';
import { type PanelEntry } from './panels';
import { orderedResults } from './results';
import { type VizSpec } from './vizSpec';

/** The parts of `PanelData` that come from the viz spec. The field overrides are applied in `toPanelProps`. */
export interface SpecData {
  state: LoadingState;
  series: DataFrame[];
  annotations: DataFrame[];
  timeRange: TimeRange;
}

/** `data.range` as an absolute `TimeRange`. */
export function toTimeRange(range: VizSpec['data']['range']): TimeRange {
  const from = dateTime(range.from);
  const to = dateTime(range.to);
  return { from, to, raw: { from, to } };
}

/**
 * Runs the system transformations of a panel. They are rxjs operators of the bundled rxjs, so they run here and not
 * in the `transformDataFrame` of the `@grafana/data` of the App. The relations operators are synchronous (`map`);
 * an operator that does not give a value at once is an error.
 * https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/panel-data-transformations
 */
export function runSystemTransformations(entry: PanelEntry, series: DataFrame[]): DataFrame[] {
  const steps = entry.systemTransformations?.({ series }) ?? [];
  if (steps.length === 0) {
    return series;
  }
  const ctx = { interpolate: (value: string) => value };
  let output: DataFrame[] | undefined;
  const source = steps.reduce((frames$, step) => {
    if (typeof step !== 'function') {
      // A transformer id needs the transformer registry of Grafana core, which the Renderer does not have.
      throw new Error(`The system transformation ${step.id} is not supported`);
    }
    return frames$.pipe(step(ctx));
  }, of(series));
  source.subscribe((frames) => (output = frames)).unsubscribe();
  if (output === undefined) {
    throw new Error('A system transformation gave no value at once');
  }
  return output;
}

/**
 * Reads the frames of all entries of `data.results`, in the order of `panel.targets` (`spec.11`). An entry with an
 * error keeps its frames. The failed queries go to the notices of the Renderer, not to `PanelData.errors`: with
 * errors, the panel does not check the data shape, so a `panel-error` would not show.
 * Frames with `meta.dataTopic` `annotations` go to `annotations` (`spec.12`). No frame keeps the data links and actions
 * that a data source put in its field config (`renderer.12`).
 * https://grafana.com/developers/plugin-tools/key-concepts/data-frames
 */
export function toSpecData(spec: VizSpec, entry: PanelEntry): SpecData {
  const frames = orderedResults(spec.panel.targetRefIds, spec.data.results).flatMap(([refId, result]) =>
    result.frames.map((json) => {
      const frame = frameWithoutCallOuts(dataFrameFromJSON(json));
      // `spec.11`: each frame keeps its refId.
      return frame.refId ? frame : { ...frame, refId };
    })
  );
  const isAnnotation = (frame: DataFrame) => frame.meta?.dataTopic === DataTopic.Annotations;
  return {
    state: LoadingState.Done,
    series: runSystemTransformations(
      entry,
      frames.filter((frame) => !isAnnotation(frame))
    ),
    annotations: frames.filter(isAnnotation),
    timeRange: toTimeRange(spec.data.range),
  };
}
