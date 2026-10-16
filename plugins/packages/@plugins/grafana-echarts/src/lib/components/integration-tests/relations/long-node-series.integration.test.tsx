import { type DataFrame, type DataFrameType, type FieldConfigSource, FieldType, toDataFrame } from '@grafana/data';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';

import { deriveNodes } from 'lib/echarts/relations/converters/deriveNodes';
import { longToWide } from 'lib/echarts/relations/converters/longToWide';
import { renderRelations, uniqueLabelTexts } from 'test/relationsCanvas';

const T0 = 1700000000000;

/** One long series, as a Prometheus range query returns it. */
const series = (labels: Record<string, string>, value: number, displayNameFromDS?: string): DataFrame =>
  toDataFrame({
    refId: 'A',
    meta: { type: 'timeseries-multi' as DataFrameType },
    fields: [
      { name: 'Time', type: FieldType.time, values: [T0] },
      {
        name: 'Value',
        type: FieldType.number,
        labels,
        values: [value],
        config: displayNameFromDS != null ? { displayNameFromDS } : {},
      },
    ],
  });

/** Long edges plus one node stat per node, with `legendFormat: {{node}}`. */
const frames = (): DataFrame[] => [
  series({ source: 'gateway', target: 'api' }, 3),
  series({ node: 'gateway' }, 20, 'gateway'),
  series({ node: 'api' }, 15, 'api'),
];

/** The pipeline the plugin's system transformations run for a long response. */
const longPipeline = (input: DataFrame[]) => deriveNodes(longToWide(input));

const override = (properties: FieldConfigSource['overrides'][number]['properties']): FieldConfigSource => ({
  defaults: {},
  overrides: [{ matcher: { id: 'byName', options: 'gateway' }, properties }],
});

const fillStyles = (events: CanvasRenderingContext2DEvent[]): string[] =>
  events.flatMap((event) => (event.type === 'fillStyle' ? [String(event.props.value)] : []));

describe('relations long node series', () => {
  it('a unit override on a converted node formats its value', async () => {
    const { seriesEvents } = await renderRelations({
      frames: frames(),
      prefix: longPipeline,
      options: { relationsShowNodeValues: true },
      fieldConfig: override([
        { id: 'unit', value: 'percent' },
        { id: 'decimals', value: 2 },
      ]),
    });

    expect(uniqueLabelTexts(seriesEvents)).toEqual(['15', '20.00%', 'api', 'gateway']);
  });

  it('a color override on a converted node changes the paint', async () => {
    const overridden = await renderRelations({
      frames: frames(),
      prefix: longPipeline,
      fieldConfig: override([{ id: 'color', value: { mode: 'fixed', fixedColor: '#ff0000' } }]),
    });
    const plain = await renderRelations({ frames: frames(), prefix: longPipeline });

    expect(fillStyles(overridden.seriesEvents)).toContain('#ff0000');
    expect(fillStyles(plain.seriesEvents)).not.toContain('#ff0000');
  });
});
