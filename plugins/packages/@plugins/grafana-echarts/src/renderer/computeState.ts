// The final state of a draw (`state.1` to `state.7`), from what the Renderer knows. A pure function, so each rule
// has a unit test.
import { type Notice, type RenderError, type RenderState } from './contract/renderer-api';

/** What the draw shows, as the views and the signals of the panel report it. */
export type DrawResult =
  /** A spec error (`state.3`), or an error while the Renderer made the panel props (`render-error`). */
  | { kind: 'error'; error: RenderError }
  /** The frames have no row (`state.4`). The Renderer shows its no-data view. */
  | { kind: 'no-data'; notices: Notice[] }
  /** The first draw of the chart is complete. */
  | { kind: 'drawn'; notices: Notice[] }
  /** The panel shows its own error view (`state.5`). */
  | { kind: 'panel-error'; error: RenderError; notices: Notice[] };

export function computeState(result: DrawResult): RenderState {
  switch (result.kind) {
    case 'error':
      // `state.7`: notices show only in `ready`, `no-data` and with `panel-error`.
      return { state: 'error', error: result.error, notices: [] };
    case 'panel-error':
      return { state: 'error', error: result.error, notices: result.notices };
    case 'no-data':
      return { state: 'no-data', notices: result.notices };
    case 'drawn':
      return { state: 'ready', notices: result.notices };
  }
}

/** True when the frames have no row (`state.4`). */
export const hasNoRows = (frames: ReadonlyArray<{ length: number }>): boolean =>
  frames.every((frame) => frame.length === 0);
