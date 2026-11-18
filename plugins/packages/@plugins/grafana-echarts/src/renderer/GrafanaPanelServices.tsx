import { type GrafanaPanelServices as Grafana } from 'lib/grafana/GrafanaPanelServices';
import React from 'react';

/**
 * The Renderer build uses this file in place of `lib/grafana/GrafanaPanelServices.tsx` (see
 * `webpack.renderer.config.ts`). It gives no service, so the bundle has no `@grafana/runtime` module. The Renderer
 * does not render `plugin.panel`, and `RendererView` gives its own error view.
 */
export const GrafanaPanelServices: typeof Grafana = ({ children }) => <>{children}</>;
