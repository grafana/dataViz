// The handle of `render`: one React root in `el`, the state of each draw, the size of `el`, and the refresh
// (`renderer.2` to `renderer.5`, `renderer.10`, `state.1` to `state.13`, `refresh.1` to `refresh.7`).
// https://react.dev/reference/react-dom/client/createRoot
import { type EChartsType } from 'lib/echarts/echarts';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { type RefreshRequest, type RenderError, type RenderHandle, type RenderOptions } from './contract/renderer-api';
import { computeState } from './computeState';
import { LOG_PREFIX } from './log';
import { errorMessage } from './messages';
import { type Prepared, prepare } from './prepare';
import { RefreshController } from './refresh';
import { DEFAULT_HEIGHT_PX } from './registry';
import { RendererView } from './RendererView';
import { StateReporter } from './stateReporter';

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
  private readonly resizeObserver: ResizeObserver | undefined;
  /** The inline height before `renderer.10` set one, so `destroy` can put it back if the App did not change it. */
  private heightBefore: string | undefined;
  /** Set when `el` had a box once, and `setDefaultHeight` looked at its height. */
  private heightChecked = false;
  private prepared: Prepared | undefined;
  private signals = newSignals();
  private size: { width: number; height: number };
  private destroyed = false;

  constructor(
    private readonly el: HTMLElement,
    options: RenderOptions | undefined
  ) {
    this.reporter = new StateReporter(el, options?.onState);
    this.setDefaultHeight();
    this.size = this.measure();
    this.root = createRoot(el);
    this.refresh = options?.onRefresh ? new RefreshController(options.onRefresh, () => this.draw()) : undefined;
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
    this.prepared = prepare(spec);
    this.refresh?.updated();
    this.draw();
  }

  setRefreshed(ok: boolean, error?: string): void {
    if (!this.destroyed) {
      this.refresh?.setRefreshed(ok, error);
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

  private readonly onPanelError = (message: string | null) => {
    this.signals.panelError = message;
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

  /**
   * `state.1`: the first draw is complete at the first ECharts `finished` event. A later draw (a resize, an
   * `update`) reports again, and the reporter calls `onState` only for a change.
   * https://echarts.apache.org/en/api.html#events.finished
   */
  private readonly onChartInit = (chart: EChartsType) => {
    chart.on('finished', () => {
      this.signals.drawn = true;
      this.report();
    });
  };

  private readonly onRefreshRequest = (request: RefreshRequest) => this.refresh?.request(request);

  private draw(): void {
    if (this.destroyed || !this.prepared) {
      return;
    }
    this.root.render(
      <RendererView
        prepared={this.prepared}
        width={this.size.width}
        height={this.size.height}
        onViewShown={this.onViewShown}
        onPanelError={this.onPanelError}
        onRenderError={this.onRenderError}
        onChartInit={this.onChartInit}
        refresh={this.refresh ? { status: this.refresh.current, onRequest: this.onRefreshRequest } : undefined}
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
    setRefreshed: (ok, error) => renderer.setRefreshed(ok, error),
    destroy: () => renderer.destroy(),
  };
}
