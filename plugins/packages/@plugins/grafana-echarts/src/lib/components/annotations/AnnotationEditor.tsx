import { type TimeZone } from '@grafana/schema';
import { usePanelContext } from '@grafana/ui';
import { toAnnotationEvent } from 'lib/grafana/annotationDraft';
import React, { useState } from 'react';
import { type PlacedAnnotationDraft } from '../hooks/useAnnotationGestures';
import { AnnotationForm, type AnnotationFormValues } from './AnnotationForm';

interface Props {
  draft: PlacedAnnotationDraft;
  timeZone?: TimeZone;
  /** Closes the editor: on save, cancel, Escape or a click out of it. */
  dismiss: () => void;
}

/**
 * The "Add annotation" form of the Grafana panel, as core's `AnnotationEditor`. Save sends the event to
 * `PanelContext.onAnnotationCreate`, and the dashboard stores it. If the save fails, the form stays open and shows
 * the error. `AnnotationForm` draws the form.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/timeseries/plugins/annotations/AnnotationEditor.tsx
 */
export const AnnotationEditor: React.FC<Props> = ({ draft, timeZone, dismiss }) => {
  const { onAnnotationCreate } = usePanelContext();
  const [values, setValues] = useState<AnnotationFormValues>({ description: '', tags: [] });
  const [saving, setSaving] = useState(false);
  // The message of a failed save. Core keeps the error of `useAsyncFn` in state, and the form
  // stays open.
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // The type says `void`, but the dashboard returns a promise; wait for it as core.
      await onAnnotationCreate?.(toAnnotationEvent(draft, values));
      dismiss();
    } catch (error) {
      setSaveError(error instanceof Error && error.message !== '' ? error.message : 'Failed to save the annotation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnnotationForm
      draft={draft}
      timeZone={timeZone}
      description={values.description}
      tags={values.tags}
      saving={saving}
      message={saveError}
      onChange={(change) => setValues((previous) => ({ ...previous, ...change }))}
      onSave={save}
      onCancel={dismiss}
      onPressOut={dismiss}
    />
  );
};
