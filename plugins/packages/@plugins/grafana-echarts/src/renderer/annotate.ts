// The Add annotation form and the saved annotations of a handle (`renderer.52` to `renderer.63`). `handle.tsx`
// makes one for each handle, and `RendererView` shows its form.
import { type AnnotateRequest } from '@grafana/viz-contract/renderer-api';
import { type AnnotationFormValues } from 'lib/components/annotations/AnnotationForm';
import { type PlacedAnnotationDraft } from 'lib/components/hooks/useAnnotationGestures';
import { LOG_PREFIX } from './log';
import { annotateMessage } from './messages';
import { ANNOTATE_TIMEOUT_MS } from './registry';

/** The number of `onAnnotate` calls of all handles. Each call gets the next number as its `id` (`renderer.54`). */
let requestCount = 0;

/** The form on screen. */
export interface AnnotateForm {
  /** The point (`from` is equal to `to`) or the range in epoch ms, and the window position of the form. */
  draft: PlacedAnnotationDraft;
  text: string;
  tags: string[];
  /** True after a call of `onAnnotate`, until its result or the timeout (`renderer.55`, `renderer.56`). */
  busy: boolean;
  /** The text of a save that did not complete (`renderer.60`). */
  message?: string;
}

/** The actions of `AnnotateController` that the view calls. */
export type AnnotateActions = Pick<AnnotateController, 'open' | 'place' | 'edit' | 'save' | 'cancel'>;

/** What a save of the form sends: an `AnnotateRequest` with no `id`. */
type AnnotateFields = Omit<AnnotateRequest, 'id'>;

/**
 * The fields of a save (`renderer.54`): whole epoch ms, a `timeEnd` only for a range, and no white space at the
 * start and the end of the text and of each tag. A tag that is then empty is left out.
 */
function fieldsOf(form: AnnotateForm): AnnotateFields {
  const time = Math.round(form.draft.from);
  const timeEnd = Math.round(form.draft.to);
  return {
    time,
    ...(timeEnd > time ? { timeEnd } : {}),
    text: form.text.trim(),
    tags: form.tags.map((tag) => tag.trim()).filter((tag) => tag !== ''),
  };
}

const sameFields = (a: AnnotateFields, b: AnnotateFields) =>
  a.time === b.time &&
  a.timeEnd === b.timeEnd &&
  a.text === b.text &&
  a.tags.length === b.tags.length &&
  a.tags.every((tag, index) => tag === b.tags[index]);

export class AnnotateController {
  private form: AnnotateForm | null = null;
  /** The annotations that the App saved (`renderer.63`). They stay until the handle is destroyed. */
  private readonly saved: AnnotateRequest[] = [];
  /** Each request with no result, by `id`. A result removes its request, so a second result does nothing. */
  private readonly waiting = new Map<string, AnnotateRequest>();
  /** The request of the last `onAnnotate` call. Only its result changes the form (`renderer.57`). */
  private last: AnnotateRequest | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** The actions of the user and of the chart, for the view. The object and its functions do not change. */
  readonly actions: AnnotateActions = {
    open: (draft) => this.open(draft),
    place: (x) => this.place(x),
    edit: (change) => this.edit(change),
    save: () => this.save(),
    cancel: () => this.cancel(),
  };

  /** `onChange` gets `true` when the saved annotations changed, so the chart must draw them. */
  constructor(
    private readonly onAnnotate: (request: AnnotateRequest) => void,
    private readonly onChange: (savedChanged: boolean) => void
  ) {}

  get current(): AnnotateForm | null {
    return this.form;
  }

  get savedAnnotations(): readonly AnnotateRequest[] {
    return this.saved;
  }

  /**
   * The user asks for the form at a point or a range (`renderer.50`, `renderer.66`). An open form moves there and
   * keeps its text, its tags and its message. A busy form does not change (`renderer.52`).
   */
  open(draft: PlacedAnnotationDraft): void {
    const form = this.form;
    if (form?.busy) {
      return;
    }
    this.setForm(form ? { ...form, draft } : { draft, text: '', tags: [], busy: false });
  }

  /** The chart gives the window x of the form time (`renderer.61`). It also moves a busy form. */
  place(x: number): void {
    const form = this.form;
    if (form && form.draft.position.x !== x) {
      this.setForm({ ...form, draft: { ...form.draft, position: { ...form.draft.position, x } } });
    }
  }

  /** The user changes the text (the description field) or the tags. A busy form does not change. */
  edit(change: Partial<AnnotationFormValues>): void {
    const form = this.form;
    if (form && !form.busy) {
      this.setForm({ ...form, text: change.description ?? form.text, tags: change.tags ?? form.tags });
    }
  }

  /** Cancel or the Escape key (`renderer.53`). A busy form stays. */
  cancel(): void {
    if (this.form && !this.form.busy) {
      this.setForm(null);
    }
  }

  /** The new chart has no time axis (`renderer.61`). This also closes a busy form. */
  close(): void {
    if (this.form) {
      this.setForm(null);
    }
  }

  /**
   * The user saves the form (`renderer.54`, `renderer.55`). A busy form and a form with no text do not call
   * `onAnnotate`. An earlier message goes away (`renderer.60`).
   */
  save(): void {
    const form = this.form;
    if (!form || form.busy) {
      return;
    }
    const fields = fieldsOf(form);
    if (fields.text === '') {
      return;
    }
    requestCount++;
    const request: AnnotateRequest = { id: String(requestCount), ...fields };
    this.last = request;
    this.waiting.set(request.id, request);
    this.setForm({ ...form, busy: true, message: undefined });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.timeout(), ANNOTATE_TIMEOUT_MS);
    try {
      this.onAnnotate(request);
    } catch (error) {
      // `renderer.59`: as `setAnnotated(<id>, false, <error message>)`.
      console.error(LOG_PREFIX, error);
      this.setAnnotated(request.id, false, error instanceof Error ? error.message : String(error));
    }
  }

  /** `setAnnotated` of the handle (`renderer.56` to `renderer.58`). */
  setAnnotated(id: string, ok: boolean, error?: string): void {
    const request = this.waiting.get(id);
    if (!request) {
      return;
    }
    this.waiting.delete(id);
    const isLast = request === this.last;
    const form = this.form;
    // The form is busy only for the last request, and only before the timeout.
    if (isLast && form?.busy) {
      clearTimeout(this.timer);
      if (ok) {
        this.saved.push(request);
        this.form = null;
        this.onChange(true);
      } else {
        const message = error
          ? annotateMessage('annotate-failed', { error })
          : annotateMessage('annotate-failed-no-detail');
        this.setForm({ ...form, busy: false, message });
      }
      return;
    }
    // `renderer.58`: a late result. A failure does nothing, because the user already saw `annotate-timeout`.
    if (!ok) {
      return;
    }
    this.saved.push(request);
    if (isLast && form) {
      // The form closes only if it still is the form of the request. If not, only the timeout message goes.
      this.form = sameFields(fieldsOf(form), request) ? null : { ...form, message: undefined };
    }
    this.onChange(true);
  }

  /** Stops the timer (`renderer.5`). */
  dispose(): void {
    clearTimeout(this.timer);
  }

  /** `annotateTimeoutMs` passed with no result (`renderer.56`). The request stays in `waiting` for a late result. */
  private timeout(): void {
    if (this.form?.busy) {
      this.setForm({ ...this.form, busy: false, message: annotateMessage('annotate-timeout') });
    }
  }

  private setForm(form: AnnotateForm | null): void {
    this.form = form;
    this.onChange(false);
  }
}
