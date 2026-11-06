// Draws a viz spec into an element with a React root, and reports the state (`state.1` to `state.13`).
// https://react.dev/reference/react-dom/client/createRoot
import React from 'react';
import { createRoot } from 'react-dom/client';
import { type EChartsType } from 'lib/echarts/echarts';
import { type RenderError, type RenderOptions } from './contract/renderer-api';
import { computeState } from './computeState';
import { LOG_PREFIX } from './log';
import { errorMessage } from './messages';
import { prepare } from './prepare';
import { DEFAULT_HEIGHT_PX } from './registry';
import { RendererView } from './RendererView';
import { StateReporter } from './stateReporter';

/** Mounts the chart and returns the function that removes it. Never throws (`renderer.3`). */
export function mount(el: HTMLElement, input: unknown, options?: RenderOptions): () => void {
  const reporter = new StateReporter(el, options?.onState);
  reporter.rendering();
  const prepared = prepare(input);

  // The signals of the draw. `state.5`: a render error replaces each other state, and a panel error replaces the
  // state of the chart.
  let drawn = false;
  let panelError: string | null = null;
  let renderError: RenderError | null = null;
  const update = () => {
    if (prepared.kind !== 'chart') {
      return;
    }
    if (renderError) {
      reporter.report(computeState({ kind: 'error', error: renderError }));
    } else if (panelError !== null) {
      const error = { code: 'panel-error', message: errorMessage('panel-error', { 'panel message': panelError }) };
      reporter.report(computeState({ kind: 'panel-error', error, notices: prepared.notices }));
    } else if (drawn) {
      reporter.report(computeState({ kind: 'drawn', notices: prepared.notices }));
    }
  };

  const onViewShown = () => {
    if (prepared.kind === 'error') {
      reporter.report(computeState({ kind: 'error', error: prepared.error }));
    } else if (prepared.kind === 'no-data') {
      reporter.report(computeState({ kind: 'no-data', notices: prepared.notices }));
    }
  };
  const onPanelError = (message: string | null) => {
    panelError = message;
    update();
  };
  const onRenderError = (error: Error) => {
    // `state.6`: the raw message goes to the console only.
    console.error(LOG_PREFIX, error);
    if (prepared.kind === 'chart') {
      renderError = { code: 'render-error', message: errorMessage('render-error', { panelName: prepared.panelName }) };
      update();
    }
  };

  // `renderer.10`: an element with no height gets `defaultHeightPx`. Phase 4 follows size changes.
  // `destroy` gives back the inline height that `el` had.
  const inlineHeight = el.style.height;
  if (el.clientHeight === 0) {
    el.style.height = `${DEFAULT_HEIGHT_PX}px`;
  }
  // `state.1`: the first draw is complete at the first ECharts `finished` event. Each later draw recomputes the state,
  // and the reporter calls `onState` only for a change. https://echarts.apache.org/en/api.html#events.finished
  const onChartInit = (chart: EChartsType) => {
    chart.on('finished', () => {
      drawn = true;
      update();
    });
  };
  const root = createRoot(el);
  root.render(
    <RendererView
      prepared={prepared}
      width={el.clientWidth}
      height={el.clientHeight || DEFAULT_HEIGHT_PX}
      onViewShown={onViewShown}
      onPanelError={onPanelError}
      onRenderError={onRenderError}
      onChartInit={onChartInit}
    />
  );
  return () => {
    reporter.stop();
    root.unmount();
    el.style.height = inlineHeight;
  };
}
