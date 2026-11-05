import { PanelDataErrorView, type PanelDataErrorViewProps } from '@grafana/runtime';
import React, { createContext, type ReactNode } from 'react';

/**
 * Renders the view that `DataIssueView` shows. In Grafana it is the `PanelDataErrorView` of `@grafana/runtime`. The
 * Renderer (`src/renderer/`) gives its own view, because only Grafana sets the runtime view.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-runtime/src/components/PanelDataErrorView.tsx
 */
export const PanelDataErrorViewContext = createContext<(props: PanelDataErrorViewProps) => ReactNode>((props) => (
  <PanelDataErrorView {...props} />
));
