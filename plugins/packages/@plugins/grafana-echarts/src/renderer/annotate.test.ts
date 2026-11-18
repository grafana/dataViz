import { type AnnotateRequest } from '@grafana/viz-contract/renderer-api';
import { AnnotateController } from './annotate';
import { ANNOTATE_TIMEOUT_MS } from './registry';

const TIMEOUT_TEXT =
  'No answer in time. The save can still complete, and the annotation then shows on the chart. A second save can make a second annotation.';

const point = (time: number, x = 10) => ({ from: time, to: time, position: { x, y: 20 } });
const range = (from: number, to: number) => ({ from, to, position: { x: 10, y: 20 } });

/** A controller with the calls of `onAnnotate` and of `onChange`. */
function setup(onAnnotate: (request: AnnotateRequest) => void = () => {}) {
  const requests: AnnotateRequest[] = [];
  const changes: boolean[] = [];
  const controller = new AnnotateController(
    (request) => {
      requests.push(request);
      onAnnotate(request);
    },
    (savedChanged) => changes.push(savedChanged)
  );
  /** Opens the form at a point, sets the text and saves. Gives the request. */
  const saveText = (text: string, tags: string[] = []) => {
    controller.open(point(1000));
    controller.edit({ description: text, tags });
    controller.save();
    return requests.at(-1)!;
  };
  return { controller, requests, changes, saveText };
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  jest.useFakeTimers();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  consoleError.mockRestore();
});

describe('the form', () => {
  // contract-rule: renderer.52
  it('moves an open form to a new point or range, and keeps its text, its tags and its message', () => {
    const { controller, saveText } = setup();
    const { id } = saveText('Deploy', ['release']);
    controller.setAnnotated(id, false, 'boom');
    controller.open(range(2000, 3000));
    expect(controller.current).toEqual({
      draft: range(2000, 3000),
      text: 'Deploy',
      tags: ['release'],
      busy: false,
      message: 'Annotation not saved: boom',
    });
  });

  // contract-rule: renderer.52
  it('does not move or change a busy form', () => {
    const { controller, saveText } = setup();
    saveText('Deploy');
    const busy = controller.current;
    controller.open(point(5000));
    controller.edit({ description: 'Other', tags: ['x'] });
    expect(controller.current).toBe(busy);
    expect(busy).toMatchObject({ draft: point(1000), busy: true });
  });

  // contract-rule: renderer.53
  it('closes on cancel with no call of onAnnotate, but not while it is busy', () => {
    const { controller, requests, saveText } = setup();
    controller.open(point(1000));
    controller.edit({ description: 'Deploy' });
    controller.cancel();
    expect(controller.current).toBeNull();
    expect(requests).toEqual([]);

    saveText('Deploy');
    controller.cancel();
    expect(controller.current).toMatchObject({ busy: true, text: 'Deploy' });
    // The busy state ends after `annotateTimeoutMs` at the latest. Then cancel closes the form.
    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS);
    controller.cancel();
    expect(controller.current).toBeNull();
  });
});

describe('a save', () => {
  // contract-rule: renderer.54
  it('calls onAnnotate with a new id, the time, the text and the tags with no outer white space', () => {
    const { controller, requests } = setup();
    controller.open(point(1000.4));
    controller.edit({ description: '  Deploy v2 \n', tags: [' release ', '   ', 'api'] });
    controller.save();
    controller.setAnnotated(requests[0].id, true);
    controller.open(range(2000.6, 5000.2));
    controller.edit({ description: 'Incident' });
    controller.save();
    expect(requests).toEqual([
      { id: expect.any(String), time: 1000, text: 'Deploy v2', tags: ['release', 'api'] },
      { id: expect.any(String), time: 2001, timeEnd: 5000, text: 'Incident', tags: [] },
    ]);
    expect(requests[0].id).not.toBe(requests[1].id);
  });

  // contract-rule: renderer.54
  it('does not call onAnnotate if the text has only white space', () => {
    const { controller, requests } = setup();
    controller.open(point(1000));
    controller.edit({ description: ' \n\t ', tags: ['release'] });
    controller.save();
    expect(requests).toEqual([]);
    expect(controller.current).toMatchObject({ busy: false, text: ' \n\t ' });
  });

  // contract-rule: renderer.55
  it('makes the form busy, and a second save does not call onAnnotate again', () => {
    const { controller, requests, saveText } = setup();
    saveText('Deploy');
    expect(controller.current).toMatchObject({ busy: true });
    controller.save();
    expect(requests).toHaveLength(1);
  });

  // contract-rule: renderer.59
  it('takes an error that onAnnotate throws as a failed result, and writes it to the console', () => {
    const error = new Error('no session');
    const { controller, saveText } = setup(() => {
      throw error;
    });
    saveText('Deploy', ['release']);
    expect(consoleError).toHaveBeenCalledWith('grafana-viz:', error);
    expect(controller.current).toEqual({
      draft: point(1000),
      text: 'Deploy',
      tags: ['release'],
      busy: false,
      message: 'Annotation not saved: no session',
    });
  });
});

describe('the result of a save', () => {
  // contract-rule: renderer.56
  it('closes the form and keeps the annotation after setAnnotated(id, true)', () => {
    const { controller, changes, saveText } = setup();
    const request = saveText('Deploy');
    changes.length = 0;
    controller.setAnnotated(request.id, true);
    expect(controller.current).toBeNull();
    expect(controller.savedAnnotations).toEqual([request]);
    expect(changes).toEqual([true]);
  });

  // contract-rule: renderer.56
  it.each([
    ['annotate-failed', 'Permission denied', 'Annotation not saved: Permission denied'],
    ['annotate-failed-no-detail', undefined, 'Annotation not saved.'],
  ])('keeps the form open with the %s message after setAnnotated(id, false)', (_code, error, message) => {
    const { controller, saveText } = setup();
    const { id } = saveText('Deploy', ['release']);
    controller.setAnnotated(id, false, error);
    expect(controller.current).toEqual({ draft: point(1000), text: 'Deploy', tags: ['release'], busy: false, message });
    expect(controller.savedAnnotations).toEqual([]);
  });

  // contract-rule: renderer.56
  it('keeps the form open with the annotate-timeout message after annotateTimeoutMs', () => {
    const { controller, saveText } = setup();
    saveText('Deploy', ['release']);
    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS - 1);
    expect(controller.current).toMatchObject({ busy: true });
    jest.advanceTimersByTime(1);
    expect(controller.current).toEqual({
      draft: point(1000),
      text: 'Deploy',
      tags: ['release'],
      busy: false,
      message: TIMEOUT_TEXT,
    });
  });

  // contract-rule: renderer.60
  it('removes the message when the user saves the form again, and when the form closes', () => {
    const { controller, saveText } = setup();
    const { id } = saveText('Deploy');
    controller.setAnnotated(id, false, 'boom');
    controller.edit({ description: 'Deploy again' });
    expect(controller.current?.message).toBe('Annotation not saved: boom');
    controller.save();
    expect(controller.current).toMatchObject({ busy: true, message: undefined });

    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS);
    expect(controller.current?.message).toBe(TIMEOUT_TEXT);
    controller.cancel();
    controller.open(point(2000));
    expect(controller.current).toEqual({ draft: point(2000), text: '', tags: [], busy: false });
  });

  // contract-rule: renderer.57
  it('ignores an id that is not the id of a request, and a second result for the same request', () => {
    const { controller, changes, saveText } = setup();
    controller.setAnnotated('1', true);
    expect(changes).toEqual([]);

    const { id } = saveText('Deploy');
    const busy = controller.current;
    controller.setAnnotated(`${id}-other`, true);
    controller.setAnnotated(`${id}-other`, false, 'boom');
    expect(controller.current).toBe(busy);

    controller.setAnnotated(id, false, 'first');
    const failed = controller.current;
    controller.setAnnotated(id, true);
    controller.setAnnotated(id, false, 'second');
    expect(controller.current).toBe(failed);
    expect(controller.savedAnnotations).toEqual([]);
  });

  // contract-rule: renderer.57
  it('does not change the form for the result of a request that is not the last one', () => {
    const { controller, requests, saveText } = setup();
    const first = saveText('Deploy');
    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS);
    controller.save();
    expect(requests).toHaveLength(2);
    const busy = controller.current;
    controller.setAnnotated(first.id, false, 'late');
    expect(controller.current).toBe(busy);
    controller.setAnnotated(first.id, true);
    expect(controller.current).toBe(busy);
  });
});

describe('a late result', () => {
  // contract-rule: renderer.58
  it('shows the annotation of a request that is not the last one, with the fields of that request', () => {
    const { controller, requests, saveText } = setup();
    const first = saveText('Deploy', ['release']);
    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS);
    controller.edit({ description: 'Deploy two' });
    controller.save();
    controller.setAnnotated(first.id, true);
    expect(controller.savedAnnotations).toEqual([{ id: first.id, time: 1000, text: 'Deploy', tags: ['release'] }]);
    // The form is still busy for the second request, and its result still applies.
    controller.setAnnotated(requests[1].id, true);
    expect(controller.current).toBeNull();
    expect(controller.savedAnnotations.map((annotation) => annotation.text)).toEqual(['Deploy', 'Deploy two']);
  });

  // contract-rule: renderer.58
  it('closes the form after the timeout if the form still is the form of the request', () => {
    const { controller, saveText } = setup();
    const request = saveText(' Deploy ', ['release']);
    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS);
    controller.setAnnotated(request.id, true);
    expect(controller.current).toBeNull();
    expect(controller.savedAnnotations).toEqual([request]);
  });

  // contract-rule: renderer.58
  it.each<[string, (controller: AnnotateController) => void]>([
    ['the text', (controller) => controller.edit({ description: 'Deploy two' })],
    ['the tags', (controller) => controller.edit({ tags: ['release', 'api'] })],
    ['the point', (controller) => controller.open(point(4000))],
  ])('keeps a form open if the user changed %s, and removes the timeout message', (_name, change) => {
    const { controller, saveText } = setup();
    const request = saveText('Deploy', ['release']);
    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS);
    change(controller);
    const { message, ...changed } = controller.current!;
    expect(message).toBe(TIMEOUT_TEXT);
    controller.setAnnotated(request.id, true);
    expect(controller.current).toEqual({ ...changed, message: undefined });
    expect(controller.savedAnnotations).toEqual([request]);
  });

  // contract-rule: renderer.58
  it('keeps a new form open, and only shows the annotation with no form', () => {
    const { controller, saveText } = setup();
    const first = saveText('Deploy');
    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS);
    controller.cancel();
    controller.setAnnotated(first.id, true);
    expect(controller.current).toBeNull();
    expect(controller.savedAnnotations).toEqual([first]);

    const second = saveText('Restart');
    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS);
    controller.cancel();
    controller.open(point(1000));
    controller.setAnnotated(second.id, true);
    expect(controller.current).toEqual({ draft: point(1000), text: '', tags: [], busy: false, message: undefined });
    expect(controller.savedAnnotations).toEqual([first, second]);
  });

  // contract-rule: renderer.58
  it('does nothing for a late failure', () => {
    const { controller, changes, saveText } = setup();
    const { id } = saveText('Deploy');
    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS);
    const timedOut = controller.current;
    changes.length = 0;
    controller.setAnnotated(id, false, 'late');
    expect(controller.current).toBe(timedOut);
    expect(changes).toEqual([]);
  });
});

describe('the place of the form', () => {
  // contract-rule: renderer.61
  it('moves the form to a new x, also while it is busy, and keeps its time, its text and its y', () => {
    const { controller, changes, saveText } = setup();
    saveText('Deploy');
    changes.length = 0;
    controller.place(300);
    expect(controller.current).toMatchObject({
      draft: { from: 1000, to: 1000, position: { x: 300, y: 20 } },
      busy: true,
    });
    controller.place(300);
    expect(changes).toEqual([false]);
  });

  // contract-rule: renderer.61
  it('closes the form, also while it is busy, and a later result still keeps the annotation', () => {
    const { controller, saveText } = setup();
    const request = saveText('Deploy');
    controller.close();
    expect(controller.current).toBeNull();
    // A new form is not the form of the request, so the result does not close it.
    controller.open(point(2000));
    controller.setAnnotated(request.id, true);
    expect(controller.current).toMatchObject({ draft: point(2000), busy: false });
    expect(controller.savedAnnotations).toEqual([request]);
    // The timer of the closed form does not give the new form a message.
    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS);
    expect(controller.current?.message).toBeUndefined();
  });
});

describe('dispose', () => {
  it('stops the timer', () => {
    const { controller, changes, saveText } = setup();
    saveText('Deploy');
    controller.dispose();
    changes.length = 0;
    jest.advanceTimersByTime(ANNOTATE_TIMEOUT_MS);
    expect(changes).toEqual([]);
  });
});
