import { type TooltipModel, type TooltipSource } from 'lib/echarts/tooltip/types';
import { createContext } from 'react';

/** An optional action for the same point as the pinned tooltip's data links. */
export interface TooltipAction {
  title: string;
  /** The click handler for this point. `undefined` when the action has nothing for the point, so the tooltip omits it. */
  resolve: (model: TooltipModel, source: TooltipSource) => (() => void) | undefined;
}

export const TooltipActionContext = createContext<TooltipAction | undefined>(undefined);
