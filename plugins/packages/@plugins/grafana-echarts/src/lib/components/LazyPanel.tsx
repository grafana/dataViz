// Lazy boundary for the shared ECharts panel.
//
// Each nested panel plugin's `module.tsx` registers `makeLazyPanel(<family>)`
// instead of the `Panel` directly. React.lazy defers the `import('./Panel')`
// until first render, so the heavy Panel + ECharts code is emitted as async
// chunks (de-duplicated across the nested panels by the splitChunks groups in
// webpack.config.ts) rather than being bundled into every panel's
// render-blocking `module.js` entry. This is the officially recommended split
// path: React.lazy + Suspense at the plugin entry boundary.
// https://react.dev/reference/react/lazy
//
// Binding the family here (rather than deriving it inside Panel) keeps the
// shared Panel generic: the family is fixed by the nested plugin's identity and
// is only needed to resolve an `'Auto'` series type within that family.
//
// Side-effect import: rewrite the async-chunk publicPath before React.lazy
// triggers any import(). Runs eagerly because `module.tsx` imports this file
// statically. See lib/publicPath.
import 'lib/publicPath';
import { type PanelProps } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';
import { ChartErrorBoundary } from 'lib/components/ChartErrorBoundary';
import { PanelRenderErrorView } from 'lib/components/PanelRenderErrorView';
import { type ChartFamily } from 'lib/echarts/charts/autoSeriesType';
import { GrafanaPanelServices } from 'lib/grafana/GrafanaPanelServices';
import React, { lazy, Suspense } from 'react';
import { type PanelOptions } from 'types';

// `.then` re-maps the named `Panel` export to the `default` that React.lazy expects.
const loadPanel = () => import('lib/components/Panel').then((m) => ({ default: m.Panel }));
const Panel = lazy(loadPanel);

// The browser console gets each render error, with its stack.
const logRenderError = (error: Error) => console.error('ECharts panel render error', error);

/**
 * Build the lazy panel entry for a nested plugin, binding its chart `family`.
 * `preload` runs in parallel with the chunk load and delays the first render
 * until it settles. It must not reject.
 * `GrafanaPanelServices` gives the tag search of the Grafana API and the Grafana error view. The Renderer renders
 * `Panel`, not this entry, and its build replaces `GrafanaPanelServices` with a file that gives no service.
 */
export const makeLazyPanel = (family: ChartFamily, preload?: () => Promise<void>) => {
  const Loaded = preload ? lazy(() => Promise.all([loadPanel(), preload()]).then(([m]) => m)) : Panel;
  const LazyPanel = (props: PanelProps<PanelOptions>) => (
    <GrafanaPanelServices>
      <Suspense fallback={<LoadingPlaceholder text="" />}>
        {/* New data or options clear the error, so a fixed query renders again. */}
        <ChartErrorBoundary
          resetKeys={[props.data, props.options, props.fieldConfig]}
          onError={logRenderError}
          fallback={() => <PanelRenderErrorView family={family} panel={props} />}
        >
          <Loaded {...props} family={family} />
        </ChartErrorBoundary>
      </Suspense>
    </GrafanaPanelServices>
  );
  return LazyPanel;
};
