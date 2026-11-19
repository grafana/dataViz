import { type AbsoluteTimeRange } from '@grafana/data';
import { createContext } from 'react';

/**
 * A host can apply a pan when the drag ends. A null handler disables both pan and brush zoom.
 * With no provider, the Grafana panel previews the pan as the user drags.
 */
export const TimeDragContext = createContext<((range: AbsoluteTimeRange) => void) | null | undefined>(undefined);
