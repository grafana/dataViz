import { type PanelDataErrorViewProps } from '@grafana/runtime';
import { createContext, type ReactNode } from 'react';

/**
 * Renders the error view of a data issue and of a render error. In Grafana, `lib/grafana/GrafanaPanelServices.tsx`
 * gives the `PanelDataErrorView` of `@grafana/runtime`. The Renderer (`src/renderer/`) gives its own view. With no
 * provider, there is no view.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-runtime/src/components/PanelDataErrorView.tsx
 */
export const PanelDataErrorViewContext = createContext<(props: PanelDataErrorViewProps) => ReactNode>(() => null);
