import { type TooltipModel, type TooltipSource } from 'lib/echarts/tooltip/types';
import { createContext } from 'react';

/** An optional action for the same point as the pinned tooltip's data links. */
export interface TooltipAction {
  title: string;
  onClick: (model: TooltipModel, source: TooltipSource) => void;
}

export const TooltipActionContext = createContext<TooltipAction | undefined>(undefined);
