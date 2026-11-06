// Draws a viz spec into an element with a React root. https://react.dev/reference/react-dom/client/createRoot
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LOG_PREFIX } from './log';
import { errorMessage } from './messages';
import { PANELS } from './panels';
import { parseSpec } from './parseSpec';
import { DEFAULT_HEIGHT_PX, panelType } from './registry';
import { RendererView } from './RendererView';
import { themeOf, toPanelProps } from './toPanelProps';
import { type RenderError } from './contract/renderer-api';

function showError(el: HTMLElement, error: RenderError) {
  el.setAttribute('data-viz-state', 'error');
  el.setAttribute('data-viz-error', error.code);
}

/** Mounts the chart and returns the function that removes it. Never throws (`renderer.3`). */
export function mount(el: HTMLElement, input: unknown): () => void {
  el.setAttribute('data-viz-state', 'rendering');
  const parsed = parseSpec(input);
  if (!parsed.ok) {
    console.error(LOG_PREFIX, parsed.error.message);
    showError(el, parsed.error);
    return () => el.removeAttribute('data-viz-state');
  }
  const { spec } = parsed;
  let panel;
  try {
    panel = toPanelProps(spec, PANELS[spec.panel.type]);
  } catch (error) {
    console.error(LOG_PREFIX, error);
    const panelName = panelType(spec.panel.type)?.name ?? spec.panel.type;
    showError(el, { code: 'render-error', message: errorMessage('render-error', { panelName }) });
    return () => el.removeAttribute('data-viz-state');
  }
  // `renderer.10`: an element with no height gets `defaultHeightPx`. Phase 4 follows size changes.
  // `destroy` gives back the inline height that `el` had.
  const inlineHeight = el.style.height;
  if (el.clientHeight === 0) {
    el.style.height = `${DEFAULT_HEIGHT_PX}px`;
  }
  const root = createRoot(el);
  root.render(
    <RendererView
      theme={themeOf(spec.theme)}
      panel={panel}
      width={el.clientWidth}
      height={el.clientHeight || DEFAULT_HEIGHT_PX}
    />
  );
  return () => {
    root.unmount();
    el.style.height = inlineHeight;
    el.removeAttribute('data-viz-state');
  };
}
