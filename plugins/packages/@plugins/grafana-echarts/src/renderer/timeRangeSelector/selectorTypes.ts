import { type TimeOption, type TimeRange, type TimeZone } from '@grafana/data';
import { type WeekStart } from '@grafana/ui';

export interface TimeRangeSelectorProps {
  compactDesign?: 'legacy' | 'tabs';
  hideFiscalYear?: boolean;
  value: TimeRange;
  onChange: (timeRange: TimeRange) => void;
  onChangeTimeZone: (timeZone: TimeZone) => void;
  onChangeFiscalYearStartMonth?: (month: number) => void;
  onError?: (error?: string) => void;
  timeZone?: TimeZone;
  fiscalYearStartMonth?: number;
  quickOptions?: TimeOption[];
  history?: TimeRange[];
  showHistory?: boolean;
  className?: string;
  hideTimeZone?: boolean;
  /** Reverse the order of relative and absolute range pickers. Used to left align the picker in forms */
  isReversed?: boolean;
  hideQuickRanges?: boolean;
  widthOverride?: number;
  weekStart?: WeekStart;
}

export interface PropsWithScreenSize extends TimeRangeSelectorProps {
  isFullscreen: boolean;
}

export interface NarrowScreenFormProps extends Omit<TimeRangeSelectorProps, 'history'> {
  historyOptions?: TimeOption[];
}

export interface FullScreenFormProps extends NarrowScreenFormProps {
  calendarAnchor: HTMLElement | null;
}
