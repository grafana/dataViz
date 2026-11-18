// The handle of `render`: one React root in `el`, the state of each draw, the size of `el`, the refresh and the
// Add annotation form (`renderer.2` to `renderer.5`, `renderer.10`, `renderer.34` to `renderer.37`, `renderer.49`
// to `renderer.67`, `state.1` to `state.13`, `refresh.1` to `refresh.7`, `refresh.13`, `refresh.15`).
// https://react.dev/reference/react-dom/client/createRoot
import { type RenderError, type RenderHandle, type RenderOptions } from '@grafana/viz-contract/renderer-api';
import { type EChartsType } from 'lib/echarts/echarts';
import { type LegendOverrides, mergeLegendOverrides } from 'lib/grafana/fields/seriesConfig';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnnotateController } from './annotate';
import { computeState } from './computeState';
import { LOG_PREFIX } from './log';
import { errorMessage } from './messages';
import { type Prepared, prepare } from './prepare';
import { type RefreshCause, RefreshController } from './refresh';
import { DEFAULT_HEIGHT_PX } from './registry';
import { RendererView } from './RendererView';
import { StateReporter } from './stateReporter';
import { type LegendHook } from './toPanelProps';

/** The signals of the draw of one viz spec. `update` starts new signals. */
interface DrawSignals {
  drawn: boolean;
  panelError: string | null;
  renderError: RenderError | null;
}

const newSignals = (): DrawSignals => ({ drawn: false, panelError: null, renderError: null });

/** The Renderer of each element, so a second `render` into the same element removes the first one. */
const renderers = new WeakMap<HTMLElement, Renderer>();

class Renderer {
  private readonly root: Root;
  private readonly reporter: StateReporter;
  private readonly refresh: RefreshController | undefined;
  /** The Add annotation form and the saved annotations. Only when the App gives `onAnnotate` (`renderer.49`). */
  private readonly annotate: AnnotateController | undefined;
  private readonly resizeObserver: ResizeObserver | undefined;
  /** The inline height before `renderer.10` set one, so `destroy` can put it back if the App did not change it. */
  private heightBefore: string | undefined;
  /** Set when `el` had a box once, and `setDefaultHeight` looked at its height. */
  private heightChecked = false;
  private prepared: Prepared | undefined;
  /** The last viz spec, so a legend change can draw it again. */
  private spec: unknown;
  /**
   * The legend changes of the user (`renderer.34` to `renderer.37`). They live here, in memory, until `destroy`:
   * `update` draws each new viz spec with them. They go to no other object, and a new `render` starts with none.
   */
  private legend: LegendOverrides | undefined;
  /** The `prepared` of the last view that React committed. Until it is `prepared`, the chart shows an earlier spec. */
  private committed: Prepared | undefined;
  private signals = newSignals();
  private size: { width: number; height: number };
  private destroyed = false;

  constructor(
    private readonly el: HTMLElement,
    private readonly options: RenderOptions | undefined
  ) {
    this.reporter = new StateReporter(el, options?.onState);
    this.setDefaultHeight();
    this.size = this.measure();
    this.root = createRoot(el);
    this.refresh = options?.onRefresh ? new RefreshController(options.onRefresh, () => this.draw()) : undefined;
    this.annotate = options?.onAnnotate ? new AnnotateController(options.onAnnotate, this.onAnnotateChange) : undefined;
    // `renderer.10`: the chart fills `el`, also after a size change.
    // https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(this.onResize);
    this.resizeObserver?.observe(el);
  }

  /** `renderer.4`: draws a viz spec into the same root, with new signals. */
  update(spec: unknown): void {
    if (this.destroyed) {
      return;
    }
    this.reporter.rendering();
    this.signals = newSignals();
    this.spec = spec;
    this.prepared = this.prepareSpec();
    this.refresh?.updated();
    // `renderer.61`: the form stays, unless the new chart has no time axis.
    if (this.prepared.kind !== 'chart' || !this.prepared.timeAxis) {
      this.annotate?.close();
    }
    this.draw();
  }

  /** The last viz spec with the legend changes and the saved annotations of the user (`renderer.35`, `renderer.63`). */
  private prepareSpec(): Prepared {
    return prepare(this.spec, this.legendHook(), this.annotate?.savedAnnotations);
  }

  private legendHook(): LegendHook {
    return { overrides: this.legend, onChange: this.onLegendChange };
  }

  setRefreshed(id: string, ok: boolean, error?: string): void {
    if (!this.destroyed) {
      this.refresh?.setRefreshed(id, ok, error);
    }
  }

  /** `renderer.62`: after `destroy`, a result does nothing. */
  setAnnotated(id: string, ok: boolean, error?: string): void {
    if (!this.destroyed) {
      this.annotate?.setAnnotated(id, ok, error);
    }
  }

  /** `renderer.5`: removes the chart, the listeners, the timer and the attributes. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.refresh?.dispose();
    this.annotate?.dispose();
    // First, so that a signal from the unmount does not report a state again.
    this.reporter.stop();
    this.root.unmount();
    if (this.heightBefore !== undefined && this.el.style.height === `${DEFAULT_HEIGHT_PX}px`) {
      this.el.style.height = this.heightBefore;
    }
    if (renderers.get(this.el) === this) {
      renderers.delete(this.el);
    }
  }

  /**
   * `renderer.10`: an element with no height gets `defaultHeightPx`. An element with no box (not in the document, or
   * hidden by `display: none`) has a `clientHeight` of 0 for each height, so the check waits for the first resize
   * after `el` has a box.
   * https://developer.mozilla.org/en-US/docs/Web/API/Element/getClientRects
   */
  private setDefaultHeight(): void {
    if (this.heightChecked || this.el.getClientRects().length === 0) {
      return;
    }
    this.heightChecked = true;
    if (this.el.clientHeight === 0) {
      this.heightBefore = this.el.style.height;
      this.el.style.height = `${DEFAULT_HEIGHT_PX}px`;
    }
  }

  private measure() {
    return { width: this.el.clientWidth, height: this.el.clientHeight || DEFAULT_HEIGHT_PX };
  }

  private readonly onResize = () => {
    this.setDefaultHeight();
    const size = this.measure();
    if (size.width !== this.size.width || size.height !== this.size.height) {
      this.size = size;
      this.draw();
    }
  };

  /** `state.5`: a render error replaces each other state, and a panel error replaces the state of the chart. */
  private report(): void {
    const prepared = this.prepared;
    if (this.destroyed || prepared?.kind !== 'chart') {
      return;
    }
    const { drawn, panelError, renderError } = this.signals;
    if (renderError) {
      this.reporter.report(computeState({ kind: 'error', error: renderError }));
    } else if (panelError !== null) {
      const error = { code: 'panel-error', message: errorMessage('panel-error', { 'panel message': panelError }) };
      this.reporter.report(computeState({ kind: 'panel-error', error, notices: prepared.notices }));
    } else if (drawn) {
      this.reporter.report(computeState({ kind: 'drawn', notices: prepared.notices }));
    }
  }

  // The callbacks below are stable: `ChartInitContext` makes a new chart instance for a new listener.

  private readonly onViewShown = () => {
    const prepared = this.prepared;
    if (this.destroyed || !prepared) {
      return;
    }
    if (prepared.kind === 'error') {
      this.reporter.report(computeState({ kind: 'error', error: prepared.error }));
    } else if (prepared.kind === 'no-data') {
      this.reporter.report(computeState({ kind: 'no-data', notices: prepared.notices }));
    }
  };

  /**
   * `renderer.34`: a legend action draws the same viz spec with the new legend changes. The state and the notices do
   * not change, so there is no new signal, and the reporter gives `onState` no call.
   */
  private readonly onLegendChange = (change: LegendOverrides) => {
    if (this.destroyed || this.spec === undefined) {
      return;
    }
    this.legend = mergeLegendOverrides(this.legend, change);
    this.prepared = this.prepareSpec();
    this.draw();
  };

  /**
   * The form or the saved annotations changed. A new saved annotation draws the same viz spec again
   * (`renderer.63`). The state and the notices do not change, as for a legend action.
   */
  private readonly onAnnotateChange = (savedChanged: boolean) => {
    if (this.destroyed) {
      return;
    }
    if (savedChanged && this.spec !== undefined) {
      this.prepared = this.prepareSpec();
    }
    this.draw();
  };

  private readonly onPanelError = (message: string | null) => {
    this.signals.panelError = message;
    // The error view of the panel has no time axis (`renderer.61`).
    if (message !== null) {
      this.annotate?.close();
    }
    this.report();
  };

  private readonly onRenderError = (error: Error) => {
    // `state.6`: the raw message goes to the console only.
    console.error(LOG_PREFIX, error);
    const prepared = this.prepared;
    if (prepared?.kind === 'chart') {
      const message = errorMessage('render-error', { panelName: prepared.panelName });
      this.signals.renderError = { code: 'render-error', message };
      this.report();
    }
  };

  private readonly onCommit = (prepared: Prepared) => {
    this.committed = prepared;
  };

  /**
   * `state.1`: the first draw is complete at the first ECharts `finished` event. A later draw (a resize, an
   * `update`) reports again, and the reporter calls `onState` only for a change. A `finished` event before React
   * commits the view of the current spec comes from the draw of an earlier spec, so it does not count.
   * https://echarts.apache.org/en/api.html#events.finished
   */
  private readonly onChartInit = (chart: EChartsType) => {
    chart.on('finished', () => {
      if (this.committed !== this.prepared) {
        return;
      }
      this.signals.drawn = true;
      this.report();
    });
  };

  private readonly onRefreshRequest = (cause: RefreshCause) => this.refresh?.request(cause);

  private draw(): void {
    if (this.destroyed || !this.prepared) {
      return;
    }
    this.root.render(
      <RendererView
        prepared={this.prepared}
        onMessage={this.options?.onMessage}
        width={this.size.width}
        height={this.size.height}
        onViewShown={this.onViewShown}
        onCommit={this.onCommit}
        onPanelError={this.onPanelError}
        onRenderError={this.onRenderError}
        onChartInit={this.onChartInit}
        refresh={this.refresh ? { status: this.refresh.current, onRequest: this.onRefreshRequest } : undefined}
        annotate={this.annotate ? { form: this.annotate.current, actions: this.annotate.actions } : undefined}
      />
    );
  }
}

/**
 * Draws `spec` into `el` and returns the handle at once (`renderer.2`). A second `render` into the same element
 * destroys the first one.
 */
export function createRenderer(el: HTMLElement, spec: unknown, options?: RenderOptions): RenderHandle {
  renderers.get(el)?.destroy();
  const renderer = new Renderer(el, options);
  renderers.set(el, renderer);
  renderer.update(spec);
  return {
    update: (next) => renderer.update(next),
    setRefreshed: (id, ok, error) => renderer.setRefreshed(id, ok, error),
    setAnnotated: (id, ok, error) => renderer.setAnnotated(id, ok, error),
    destroy: () => renderer.destroy(),
  };
}
