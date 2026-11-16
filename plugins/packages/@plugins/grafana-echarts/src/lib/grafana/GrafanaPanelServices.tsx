import { PanelDataErrorView, type PanelDataErrorViewProps } from '@grafana/runtime';
import { AnnotationTagsContext } from 'lib/components/annotations/annotationTagsContext';
import { PanelDataErrorViewContext } from 'lib/components/panelDataErrorViewContext';
import React, { type ReactNode } from 'react';
import { searchAnnotationTags } from './annotationTags';

const renderGrafanaErrorView = (props: PanelDataErrorViewProps) => <PanelDataErrorView {...props} />;

/**
 * Gives the panel the services of Grafana: the annotation tag search and the Grafana error view. This is the only
 * entry point of the panel code to `@grafana/runtime`: only this file imports `./annotationTags`, which uses
 * `getBackendSrv`. The Renderer build replaces it with
 * `src/renderer/GrafanaPanelServices.tsx`, so the Renderer bundle has no `@grafana/runtime` module.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-runtime/src/components/PanelDataErrorView.tsx
 */
export const GrafanaPanelServices = ({ children }: { children: ReactNode }) => (
  <AnnotationTagsContext.Provider value={searchAnnotationTags}>
    <PanelDataErrorViewContext.Provider value={renderGrafanaErrorView}>{children}</PanelDataErrorViewContext.Provider>
  </AnnotationTagsContext.Provider>
);
