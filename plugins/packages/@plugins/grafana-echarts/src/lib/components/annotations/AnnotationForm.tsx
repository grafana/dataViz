import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';
import { Button, Field, IconButton, Portal, Stack, TagsInput, TextArea, useStyles2 } from '@grafana/ui';
import { cursorTransform } from 'lib/components/tooltip/placement';
import { formatDraftTime } from 'lib/grafana/annotationDraft';
import React, { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { type PlacedAnnotationDraft } from '../hooks/useAnnotationGestures';
import { AnnotationTagsContext } from './annotationTagsContext';
import { AnnotationTagsSelect } from './AnnotationTagsSelect';

/** The fields of the form that the user changes. */
export interface AnnotationFormValues {
  description: string;
  tags: string[];
}

interface Props extends AnnotationFormValues {
  draft: PlacedAnnotationDraft;
  timeZone?: TimeZone;
  /** True while a save has no result. The Save button is then off. */
  saving: boolean;
  /** True when the user cannot change or close the form. */
  locked?: boolean;
  /** The message of a save that did not complete. */
  message?: string | null;
  onChange: (change: Partial<AnnotationFormValues>) => void;
  /** The user saves a form that has a description. */
  onSave: () => void;
  /** Cancel, the Close button or the Escape key. */
  onCancel: () => void;
  /** A press out of the form. With no callback, such a press does nothing. */
  onPressOut?: () => void;
  /** A class for the form root. The form is in a portal, so it gets no style from the elements around the chart. */
  className?: string;
}

/** The data attribute of the form root, for tests and browser probes. */
export const ANNOTATION_EDITOR_ATTR = 'data-echarts-annotation-editor';

/**
 * The "Add annotation" form, as core's `AnnotationEditor`: a required description and tags. The form keeps no
 * value: the owner gives the description, the tags, the busy state and the message.
 *
 * Differences from core: core `TagFilter` is not exported. With a tag search in `AnnotationTagsContext` (the
 * Grafana panel), `AnnotationTagsSelect` suggests the existing tags. With no search (the standalone renderer),
 * `TagsInput` takes free text only. The form opens at the cursor, not under the plot.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/timeseries/plugins/annotations/AnnotationEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-tagsinput--docs
 */
export const AnnotationForm: React.FC<Props> = ({
  draft,
  timeZone,
  description,
  tags,
  saving,
  locked = false,
  message,
  onChange,
  onSave,
  onCancel,
  onPressOut,
  className,
}) => {
  const styles = useStyles2(getStyles);
  const searchTags = useContext(AnnotationTagsContext);
  const tagsId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [invalid, setInvalid] = useState(false);

  // Placed as the tooltip, beside the cursor, and flipped at the window edges.
  const { x, y } = draft.position;
  useLayoutEffect(() => {
    const dom = rootRef.current;
    if (dom == null) {
      return;
    }
    const place = () =>
      (dom.style.transform = cursorTransform({ x, y }, { width: dom.offsetWidth, height: dom.offsetHeight }));
    place();
    // The form grows when the user adds tags. Place it again, so that it stays in the viewport.
    // https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(place);
    observer.observe(dom);
    return () => observer.disconnect();
  }, [x, y]);

  // Escape closes the form, and so does a press out of it when the owner asks for that, as core (`useClickAway`).
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !inForm(rootRef.current, event.target)) {
        onPressOut?.();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !locked) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [locked, onCancel, onPressOut]);

  const save = () => {
    if (description.trim() === '') {
      setInvalid(true);
      return;
    }
    onSave();
  };

  return (
    <Portal>
      {/* `styles.editor` is last, so it wins over `className`. https://emotion.sh/docs/@emotion/css#cx */}
      <div ref={rootRef} className={cx(className, styles.editor)} {...{ [ANNOTATION_EDITOR_ATTR]: '' }}>
        <div className={styles.header}>
          <Stack justifyContent="space-between" alignItems="center">
            <Stack gap={0} width="100%" justifyContent="space-between" alignItems="center">
              <div>Add annotation</div>
              <div>{formatDraftTime(draft, timeZone)}</div>
            </Stack>
            <IconButton aria-label="Close" name="times" disabled={locked} onClick={onCancel} />
          </Stack>
        </div>
        {/* Not a `form` element: the sandbox iframe of the standalone renderer blocks a form submit, so the Save
            button has a click handler.
            https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#allow-forms */}
        <div>
          <div className={styles.content}>
            <Field label="Description" invalid={invalid} error={invalid ? 'Annotation description is required' : ''}>
              <TextArea
                autoFocus
                className={styles.textarea}
                value={description}
                disabled={locked}
                onChange={(event) => {
                  onChange({ description: event.currentTarget.value });
                  setInvalid(false);
                }}
              />
            </Field>
            <Field label="Tags" htmlFor={tagsId}>
              {searchTags === undefined ? (
                <TagsInput
                  id={tagsId}
                  placeholder="Add tags"
                  tags={tags}
                  disabled={locked}
                  onChange={(next) => onChange({ tags: next })}
                />
              ) : (
                <AnnotationTagsSelect
                  id={tagsId}
                  tags={tags}
                  onChange={(next) => onChange({ tags: next })}
                  searchTags={searchTags}
                />
              )}
            </Field>
          </div>
          <div className={styles.footer}>
            {message != null && (
              <div role="alert" className={styles.error}>
                {message}
              </div>
            )}
            <Stack justifyContent="flex-end">
              <Button size="sm" variant="secondary" fill="outline" disabled={locked} onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" disabled={saving} onClick={save}>
                {saving ? 'Saving' : 'Save'}
              </Button>
            </Stack>
          </div>
        </div>
      </div>
    </Portal>
  );
};

/**
 * True if `target` is in the form, or in a menu that an input of the form controls. The tags menu opens in
 * a portal, so a press on a suggestion is not a press out of the form.
 * https://www.w3.org/TR/wai-aria-1.2/#aria-controls
 */
function inForm(root: HTMLElement | null, target: Node): boolean {
  if (root == null) {
    return false;
  }
  if (root.contains(target)) {
    return true;
  }
  return Array.from(root.querySelectorAll('[aria-controls]')).some((el) => {
    const menuId = el.getAttribute('aria-controls');
    return menuId != null && menuId !== '' && document.getElementById(menuId)?.contains(target) === true;
  });
}

// Core `AnnotationEditor` styles, and fixed placement as the tooltip.
const getStyles = (theme: GrafanaTheme2) => ({
  editor: css({
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: theme.zIndex.tooltip,
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    userSelect: 'text',
    width: 460,
  }),
  header: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(0.5, 1),
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.fontSize,
    color: theme.colors.text.primary,
  }),
  content: css({
    padding: theme.spacing(1),
  }),
  footer: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1),
  }),
  error: css({
    color: theme.colors.error.text,
    fontSize: theme.typography.bodySmall.fontSize,
    paddingBottom: theme.spacing(1),
  }),
  textarea: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
