import { type PanelDataErrorViewProps } from '@grafana/runtime';
import { createContext, type ReactNode } from 'react';

let warned = false;

/**
 * The value when no provider gives a view: no view. Outside a production build, it warns one time, because the panel
 * then shows a blank box for each data issue, empty response and render error.
 */
const noErrorView = (): ReactNode => {
  if (process.env.NODE_ENV !== 'production' && !warned) {
    warned = true;
    console.warn(
      'ECharts panel: no PanelDataErrorViewContext provider, so the panel shows no error view. ' +
        'In Grafana, render the panel through makeLazyPanel or GrafanaPanelServices.'
    );
  }
  return null;
};

/**
 * Renders the error view of a data issue and of a render error. In Grafana, `lib/grafana/GrafanaPanelServices.tsx`
 * gives the `PanelDataErrorView` of `@grafana/runtime`. The Renderer (`src/renderer/`) gives its own view.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-runtime/src/components/PanelDataErrorView.tsx
 */
export const PanelDataErrorViewContext = createContext<(props: PanelDataErrorViewProps) => ReactNode>(noErrorView);
