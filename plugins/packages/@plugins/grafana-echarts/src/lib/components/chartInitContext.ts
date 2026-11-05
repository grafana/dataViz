import { type EChartsType } from 'lib/echarts/echarts';
import { createContext } from 'react';

/**
 * Called with each chart instance right after `init`, before its first `setOption`, so a host gets every event of
 * the instance. The Renderer listens to `finished` here for its first-draw signal (`state.1`). A listener after the
 * mount is too late: the first draw can finish in the same commit. The listener must be stable: a new listener
 * makes a new chart instance.
 * https://echarts.apache.org/en/api.html#events.finished
 */
export type ChartInitListener = (chart: EChartsType) => void;

/** The listener of the host. Grafana gives no listener, so the default does nothing. */
export const ChartInitContext = createContext<ChartInitListener>(() => {});
