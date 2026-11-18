// The saved annotations of a handle as an annotation frame of the panel (`renderer.63`).
import { type DataFrame, DataTopic, FieldType } from '@grafana/data';
import { type AnnotateRequest } from '@grafana/viz-contract/renderer-api';

/**
 * One annotation frame with a row for each saved annotation. It has the fields that the Grafana dashboard gives to
 * an annotation event: a point has `isRegion` false, and its `timeEnd` is its `time`.
 * https://grafana.com/developers/plugin-tools/key-concepts/data-frames
 * https://github.com/grafana/grafana/blob/main/public/app/features/annotations/standardAnnotationSupport.ts
 */
export function savedAnnotationsFrame(saved: readonly AnnotateRequest[]): DataFrame {
  return {
    meta: { dataTopic: DataTopic.Annotations },
    length: saved.length,
    fields: [
      { name: 'time', type: FieldType.time, config: {}, values: saved.map((annotation) => annotation.time) },
      {
        name: 'timeEnd',
        type: FieldType.time,
        config: {},
        values: saved.map((annotation) => annotation.timeEnd ?? annotation.time),
      },
      {
        name: 'isRegion',
        type: FieldType.boolean,
        config: {},
        values: saved.map((annotation) => annotation.timeEnd !== undefined),
      },
      { name: 'text', type: FieldType.string, config: {}, values: saved.map((annotation) => annotation.text) },
      { name: 'tags', type: FieldType.other, config: {}, values: saved.map((annotation) => annotation.tags) },
    ],
  };
}
