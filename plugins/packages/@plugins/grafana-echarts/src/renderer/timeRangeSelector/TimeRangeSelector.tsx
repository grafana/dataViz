import { useTheme2 } from '@grafana/ui';
import React from 'react';
import { useWindowSize } from 'react-use';
import { TimeRangeSelectorWithScreenSize } from './TimeRangeSelectorWithScreenSize';
import { type TimeRangeSelectorProps } from './selectorTypes';

export const TimeRangeSelector = (props: TimeRangeSelectorProps) => {
  const { widthOverride } = props;
  const theme = useTheme2();
  const { width } = useWindowSize();
  const isWide = width >= theme.breakpoints.values.lg;
  const isFullscreen = widthOverride ? widthOverride >= theme.breakpoints.values.lg : isWide;
  return <TimeRangeSelectorWithScreenSize {...props} isFullscreen={isFullscreen} />;
};

export type { TimeRangeSelectorProps } from './selectorTypes';
