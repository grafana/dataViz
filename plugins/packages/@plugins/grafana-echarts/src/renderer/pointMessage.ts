import { type DataFrame, getFieldDisplayName } from '@grafana/data';
import { type RenderOptions } from '@grafana/viz-contract/renderer-api';
import { type TooltipAction } from 'lib/components/tooltip/tooltipActionContext';
import { LOG_PREFIX } from './log';

/** The pinned tooltip supplies the displayed values and the field that owns its links. */
export function askInChat(frames: DataFrame[], onMessage: NonNullable<RenderOptions['onMessage']>): TooltipAction {
  return {
    title: 'Ask in chat',
    onClick: ({ header, rows }, { field, rowIndex }) => {
      const frame = frames.find((candidate) => candidate.fields.includes(field));
      const row = rows.find((item) => item.source?.field === field && item.source.rowIndex === rowIndex);
      const raw: unknown = row?.rawValue === undefined ? field.values[rowIndex] : row.rawValue;
      const x = header.coordinate;
      const date = x?.type === 'time' ? new Date(x.value) : undefined;
      try {
        onMessage({
          target: 'point',
          series: {
            name: getFieldDisplayName(field, frame, frames),
            labels: { ...field.labels },
            ...(frame?.refId !== undefined && { refId: frame.refId }),
          },
          point: {
            x: header.value || header.label,
            y: row?.value ?? '',
            xType: x?.type ?? 'string',
            ...(x && Number.isFinite(x.value) && { xRaw: x.value }),
            ...(date && Number.isFinite(date.getTime()) && { xIso: date.toISOString() }),
            ...(typeof raw === 'number' && Number.isFinite(raw) && { yRaw: raw }),
          },
        });
      } catch (error) {
        console.error(LOG_PREFIX, error);
      }
    },
  };
}
