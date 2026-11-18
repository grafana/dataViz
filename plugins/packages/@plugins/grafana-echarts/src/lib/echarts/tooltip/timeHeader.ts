import { dateTimeFormat } from '@grafana/data';
import { type TooltipHeaderItem } from './types';

/** Keep the time of the point alongside the text that the tooltip displays. */
export function timeHeader(time: number, timeZone?: string, end?: number): TooltipHeaderItem {
  const value = dateTimeFormat(time, { timeZone });
  return {
    label: '',
    value: end === undefined ? value : `${value} - \n${dateTimeFormat(end, { timeZone })}`,
    coordinate: { type: 'time', value: time },
  };
}
