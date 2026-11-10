// Sets `data-viz-state` and `data-viz-error` on `el` (`state.1`, `state.2`) and calls `onState` (`state.12`,
// `state.13`).
import { type RenderOptions, type RenderState } from '@grafana/viz-contract/renderer-api';
import { LOG_PREFIX } from './log';

export class StateReporter {
  /** The last state given to `onState`, as JSON, so a draw with the same values does not call it again. */
  private last: string | undefined;
  /** Set by `stop`. After it, each call does nothing. */
  private stopped = false;

  constructor(
    private readonly el: HTMLElement,
    private readonly onState: RenderOptions['onState']
  ) {}

  /** The draw is not complete (`state.1`). `onState` is not called for `rendering`. */
  rendering(): void {
    this.el.setAttribute('data-viz-state', 'rendering');
    this.el.removeAttribute('data-viz-error');
  }

  /**
   * A final state: set the attributes, then call `onState` when the state, the error or the notices changed. The call
   * is in a microtask, because a report can come from a React effect, and an `onState` that destroys the handle must
   * not unmount the root while React renders (`state.13` lets `onState` come after `render` returns).
   * https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask
   */
  report(state: RenderState): void {
    if (this.stopped) {
      return;
    }
    this.el.setAttribute('data-viz-state', state.state);
    if (state.error) {
      this.el.setAttribute('data-viz-error', state.error.code);
    } else {
      this.el.removeAttribute('data-viz-error');
    }
    const key = JSON.stringify(state);
    if (key === this.last) {
      return;
    }
    this.last = key;
    const onState = this.onState;
    if (!onState) {
      return;
    }
    // A copy, so a change of the App to the object does not change the Renderer.
    const copy = structuredClone(state);
    queueMicrotask(() => {
      if (this.stopped) {
        return;
      }
      try {
        onState(copy);
      } catch (error) {
        // `state.13`: the chart, the state and the notices do not change.
        console.error(LOG_PREFIX, error);
      }
    });
  }

  /**
   * Removes the attributes (`renderer.5`), and ignores each later report and each `onState` call that did not run yet.
   * `destroy` calls it first, because the unmount of the chart can give a signal (the cleanup of `DataIssueView`) that
   * computes the state again.
   */
  stop(): void {
    this.stopped = true;
    this.el.removeAttribute('data-viz-state');
    this.el.removeAttribute('data-viz-error');
  }
}
