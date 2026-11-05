import { type PanelDataErrorViewProps } from '@grafana/runtime';
import { ThemeContext } from '@grafana/ui';
import { ChartErrorBoundary } from 'lib/components/ChartErrorBoundary';
import { ChartInitContext, type ChartInitListener } from 'lib/components/chartInitContext';
import { ChartNotices } from 'lib/components/ChartNotices';
import { Panel } from 'lib/components/Panel';
import { PanelDataErrorViewContext } from 'lib/components/panelDataErrorViewContext';
import { PanelErrorContext, type PanelErrorSignal } from 'lib/components/panelErrorContext';
import { TimeZoomOutContext } from 'lib/components/TimeZoomOutContext';
import React, { useEffect } from 'react';
import { type RefreshRequest } from './contract/renderer-api';
import { dataIssueText } from './dataIssueText';
import { TOOLBAR_HEIGHT_PX } from './layout';
import { errorMessage } from './messages';
import { NoDataView } from './NoDataView';
import { toChartNotices } from './notices';
import { type Prepared } from './prepare';
import { type RefreshStatus } from './refresh';
import { RendererErrorView } from './RendererErrorView';
import { RendererToolbar } from './RendererToolbar';

interface Props {
  prepared: Prepared;
  width: number;
  height: number;
  /** Called after a view with no chart (an error, no data) is on screen. */
  onViewShown: () => void;
  /** The panel shows its own error view (`message`), or the view goes (`null`). */
  onPanelError: PanelErrorSignal;
  /** A child threw while it rendered. */
  onRenderError: (error: Error) => void;
  /** Called with each chart instance before its first draw. It must be stable. */
  onChartInit: ChartInitListener;
  /** The Refresh and time picker bar. Only when the App gives `onRefresh` (`refresh.1`). */
  refresh?: { status: RefreshStatus; onRequest: (request: RefreshRequest) => void };
}

/** The error view of a data issue: the Renderer gives its own, because only Grafana sets the view of `@grafana/runtime`. */
const renderDataIssue = (props: PanelDataErrorViewProps) => <RendererErrorView message={dataIssueText(props)} />;

/**
 * What the Renderer shows for a viz spec, with the theme of the spec. The chart is `Panel`, not `plugin.panel`: that
 * adds the tag search and the error view of Grafana (see `lib/components/LazyPanel.tsx`). The notices are a badge in
 * the top-left corner, so they do not cover the notices of the panel in the top-right corner.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/themes/ThemeContext.tsx
 */
export const RendererView = ({
  prepared,
  width,
  height,
  onViewShown,
  onPanelError,
  onRenderError,
  onChartInit,
  refresh,
}: Props) => {
  const chartHeight = Math.max(0, height - (refresh ? TOOLBAR_HEIGHT_PX : 0));
  useEffect(() => {
    if (prepared.kind !== 'chart') {
      onViewShown();
    }
  }, [prepared, onViewShown]);

  return (
    <ThemeContext.Provider value={prepared.theme}>
      <ChartInitContext.Provider value={onChartInit}>
        {/* `renderer.14`: a double click zoom out does nothing. The brush zoom and the pan call the
            `onChangeTimeRange` of `toPanelProps`, which does nothing. */}
        <TimeZoomOutContext.Provider value={null}>
          <PanelErrorContext.Provider value={onPanelError}>
            <PanelDataErrorViewContext.Provider value={renderDataIssue}>
              {refresh && (
                <RendererToolbar
                  status={refresh.status}
                  timeRange={prepared.timeRange}
                  timeZone={prepared.timeZone}
                  onRequest={refresh.onRequest}
                />
              )}
              <div style={{ position: 'relative', width, height: chartHeight }}>
                {prepared.kind === 'error' && <RendererErrorView message={prepared.error.message} />}
                {prepared.kind === 'no-data' && (
                  <>
                    <NoDataView noValue={prepared.noValue} />
                    <ChartNotices notices={toChartNotices(prepared.notices)} corner="top-left" />
                  </>
                )}
                {prepared.kind === 'chart' && (
                  <ChartErrorBoundary
                    resetKeys={[prepared.props]}
                    onError={onRenderError}
                    fallback={() => (
                      <RendererErrorView message={errorMessage('render-error', { panelName: prepared.panelName })} />
                    )}
                  >
                    <Panel {...prepared.props} width={width} height={chartHeight} />
                    <ChartNotices notices={toChartNotices(prepared.notices)} corner="top-left" />
                  </ChartErrorBoundary>
                )}
              </div>
            </PanelDataErrorViewContext.Provider>
          </PanelErrorContext.Provider>
        </TimeZoomOutContext.Provider>
      </ChartInitContext.Provider>
    </ThemeContext.Provider>
  );
};
