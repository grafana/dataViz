import { type DataFrame, type Field, getFieldDisplayName } from '@grafana/data';
import { type RenderOptions } from '@grafana/viz-contract/renderer-api';
import { type TooltipAction } from 'lib/components/tooltip/tooltipActionContext';
import { LOG_PREFIX } from './log';

/**
 * The frame that `field` comes from. A chart can draw a field that it made from the data, for example the count
 * field of a histogram. That field is in no frame, but its `origin` names the frame of its raw field.
 */
function sourceFrame(frames: DataFrame[], field: Field, owner: DataFrame | undefined): DataFrame | undefined {
  return owner ?? frames[field.state?.origin?.frameIndex ?? -1];
}

/** The pinned tooltip supplies the displayed values and the field that owns its links. */
export function askInChat(frames: DataFrame[], onMessage: NonNullable<RenderOptions['onMessage']>): TooltipAction {
  return {
    title: 'Ask in chat',
    resolve: ({ header, rows }, { field, rowIndex }) => {
      const row = rows.find((item) => item.source?.field === field && item.source.rowIndex === rowIndex);
      // `y` is the text that the tooltip shows (`renderer.32`). A point with no value row has no `y`, for example a
      // node of a relations panel that shows only its edges. Such a point has no message.
      if (!row || row.value === '') {
        return undefined;
      }
      return () => {
        const owner = frames.find((candidate) => candidate.fields.includes(field));
        const refId = sourceFrame(frames, field, owner)?.refId;
        const raw: unknown = row.rawValue === undefined ? field.values[rowIndex] : row.rawValue;
        const x = header.coordinate;
        const date = x?.type === 'time' ? new Date(x.value) : undefined;
        try {
          onMessage({
            target: 'point',
            series: {
              name: getFieldDisplayName(field, owner, frames),
              labels: { ...field.labels },
              ...(refId !== undefined && { refId }),
            },
            point: {
              // A timeline header breaks the line between the start and the end. The message is one line.
              x: (header.value || header.label).replace(/\s*\n\s*/g, ' '),
              y: row.value,
              xType: x?.type ?? 'string',
              ...(x && Number.isFinite(x.value) && { xRaw: x.value }),
              ...(date && Number.isFinite(date.getTime()) && { xIso: date.toISOString() }),
              ...(typeof raw === 'number' && Number.isFinite(raw) && { yRaw: raw }),
            },
          });
        } catch (error) {
          console.error(LOG_PREFIX, error);
        }
      };
    },
  };
}
