import { type PanelProps } from '@grafana/data';
import { type ChartFamily } from 'lib/echarts/charts/autoSeriesType';
import React, { useContext } from 'react';
import { PanelDataErrorViewContext } from './panelDataErrorViewContext';
import { renderErrorMessage } from './renderErrorMessage';

interface PanelRenderErrorViewProps {
  family: ChartFamily;
  panel: PanelProps;
}

/**
 * The view of the Grafana panel when the chart throws while it renders. It shows the error view of
 * `PanelDataErrorViewContext` with a generic message, and sets `data-viz-state` to `error` (viz contract 4.4, row 9:
 * `render-error`).
 */
export const PanelRenderErrorView = ({ family, panel }: PanelRenderErrorViewProps) => {
  const renderErrorView = useContext(PanelDataErrorViewContext);
  return (
    <div data-viz-state="error" style={{ width: '100%', height: '100%' }}>
      {renderErrorView({
        panelId: panel.id,
        fieldConfig: panel.fieldConfig,
        data: panel.data,
        message: renderErrorMessage(family),
      })}
    </div>
  );
};
