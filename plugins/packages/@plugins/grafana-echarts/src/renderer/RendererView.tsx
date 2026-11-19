import { type TimeRange } from '@grafana/data';
import { type PanelDataErrorViewProps } from '@grafana/runtime';
import { ThemeContext } from '@grafana/ui';
import { type RenderOptions } from '@grafana/viz-contract/renderer-api';
import { ChartErrorBoundary } from 'lib/components/ChartErrorBoundary';
import { ChartInitContext, type ChartInitListener } from 'lib/components/chartInitContext';
import { ChartNotices } from 'lib/components/ChartNotices';
import { Panel } from 'lib/components/Panel';
import { PanelDataErrorViewContext } from 'lib/components/panelDataErrorViewContext';
import { PanelErrorContext, type PanelErrorSignal } from 'lib/components/panelErrorContext';
import { TimeDragContext } from 'lib/components/TimeDragContext';
import { TimeZoomOutContext } from 'lib/components/TimeZoomOutContext';
import { TooltipActionContext } from 'lib/components/tooltip/tooltipActionContext';
import React, { useEffect, useMemo } from 'react';
import { CommitSignal } from './CommitSignal';
import { dataIssueText } from './dataIssueText';
import { chartPadding, TITLE_HEIGHT_PX, TOOLBAR_HEIGHT_PX } from './layout';
import { errorMessage } from './messages';
import { NoDataView } from './NoDataView';
import { toChartNotices } from './notices';
import { askInChat } from './pointMessage';
import { type Prepared } from './prepare';
import { type SpecPanelProps } from './toPanelProps';
import { type TimeRangeCause } from './timeRangeRequest';
import { type RefreshCause, type RefreshStatus } from './refresh';
import { RendererErrorView } from './RendererErrorView';
import { RendererTitle } from './RendererTitle';
import { RendererToolbar } from './RendererToolbar';
import { ChartResetTimeRangeButton } from './ChartResetTimeRangeButton';
import { rootClassName } from './rootStyles';

interface Props {
  prepared: Prepared;
  onMessage?: RenderOptions['onMessage'];
  width: number;
  height: number;
  /** Called after a view with no chart (an error, no data) is on screen. */
  onViewShown: () => void;
  /** Called in the effects of the commit that shows `prepared`, immediately before the chart draws it. */
  onCommit: (prepared: Prepared) => void;
  /** The panel shows its own error view (`message`), or the view goes (`null`). */
  onPanelError: PanelErrorSignal;
  /** A child threw while it rendered. */
  onRenderError: (error: Error) => void;
  /** Called with each chart instance before its first draw. It must be stable. */
  onChartInit: ChartInitListener;
  timeNavigation?: {
    localRange?: TimeRange;
    onChangeTimeRange: SpecPanelProps['onChangeTimeRange'];
    onReset: () => void;
    onPan: SpecPanelProps['onChangeTimeRange'];
    onZoomOut: () => void;
  };
  /** The Refresh and time picker bar. Only when the App gives `onRefresh` (`refresh.1`). */
  refresh?: {
    status: RefreshStatus;
    onRequest: (cause: RefreshCause) => void;
    onPick: (cause: TimeRangeCause) => void;
    canReset: boolean;
  };
}

const renderDataIssue = (props: PanelDataErrorViewProps) => <RendererErrorView message={dataIssueText(props)} />;

/**
 * What the Renderer shows for a viz spec, with the theme of the spec. The chart is `Panel`, not `plugin.panel`: that
 * adds the tag search and the error view of Grafana (see `lib/grafana/GrafanaPanelServices.tsx`, which the Renderer
 * build replaces with `src/renderer/GrafanaPanelServices.tsx`). The notices are a badge in
 * the top-left corner, so they do not cover the notices of the panel in the top-right corner. `panel.title` is above
 * the chart, below the Refresh bar (`renderer.17`).
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/themes/ThemeContext.tsx
 */
export const RendererView = ({
  prepared,
  onMessage,
  width,
  height,
  onViewShown,
  onCommit,
  onPanelError,
  onRenderError,
  onChartInit,
  timeNavigation,
  refresh,
}: Props) => {
  // `renderer.10`, `renderer.17`: the bar, the title and the chart together fill `el`.
  const chartHeight = Math.max(
    0,
    height - (refresh ? TOOLBAR_HEIGHT_PX : 0) - (prepared.title !== undefined ? TITLE_HEIGHT_PX : 0)
  );
  const padding = prepared.kind === 'chart' ? chartPadding(prepared.props.family) : 0;
  const rootClass = useMemo(() => rootClassName(prepared.theme), [prepared.theme]);
  const pointAction = useMemo(
    () => (prepared.kind === 'chart' && onMessage ? askInChat(prepared.props.data.series, onMessage) : undefined),
    [prepared, onMessage]
  );
  useEffect(() => {
    if (prepared.kind !== 'chart') {
      onViewShown();
    }
  }, [prepared, onViewShown]);

  return (
    <ThemeContext.Provider value={prepared.theme}>
      <ChartInitContext.Provider value={onChartInit}>
        <TimeZoomOutContext.Provider value={refresh?.status.busy ? null : timeNavigation?.onZoomOut}>
          <PanelErrorContext.Provider value={onPanelError}>
            <PanelDataErrorViewContext.Provider value={renderDataIssue}>
              {/* Before the chart, so its effect runs before the effect of the chart. */}
              <CommitSignal prepared={prepared} onCommit={onCommit} />
              <div className={rootClass} style={{ width, height }}>
                {refresh && (
                  <RendererToolbar
                    {...refresh}
                    onReset={timeNavigation?.onReset}
                    timeRange={prepared.timeRange}
                    timeZone={prepared.timeZone}
                  />
                )}
                {prepared.title !== undefined && <RendererTitle title={prepared.title} />}
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
                      <TimeDragContext.Provider value={refresh?.status.busy ? null : timeNavigation?.onPan}>
                        <TooltipActionContext.Provider value={pointAction}>
                          <div style={{ padding }}>
                            <Panel
                              {...prepared.props}
                              width={Math.max(0, width - 2 * padding)}
                              height={Math.max(0, chartHeight - 2 * padding)}
                              timeRange={timeNavigation?.localRange ?? prepared.props.timeRange}
                              onChangeTimeRange={timeNavigation?.onChangeTimeRange ?? prepared.props.onChangeTimeRange}
                            />
                          </div>
                        </TooltipActionContext.Provider>
                      </TimeDragContext.Provider>
                      <ChartNotices notices={toChartNotices(prepared.notices)} corner="top-left" />
                      {timeNavigation?.localRange && <ChartResetTimeRangeButton onClick={timeNavigation.onReset} />}
                    </ChartErrorBoundary>
                  )}
                </div>
              </div>
            </PanelDataErrorViewContext.Provider>
          </PanelErrorContext.Provider>
        </TimeZoomOutContext.Provider>
      </ChartInitContext.Provider>
    </ThemeContext.Provider>
  );
};
