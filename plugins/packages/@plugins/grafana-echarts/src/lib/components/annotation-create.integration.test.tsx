import { FieldType, toDataFrame } from '@grafana/data';
import { type PanelContext } from '@grafana/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { type EChartsType } from 'echarts';
import { ANNOTATION_EDITOR_ATTR } from 'lib/components/annotations/AnnotationForm';
import { defaultTimeRange } from 'test/panel';
import { clickAt, dispatch, type Modifiers, renderTooltipPanel, tooltipText } from 'test/tooltipPointer';

// Add an annotation from the chart, as core Time series (#278): the tooltip's "Add annotation"
// button, ctrl/cmd + click for a point and ctrl/cmd + drag for a region. The pointer goes through
// zrender's real pipeline (see `test/tooltipPointer.tsx`), and the save goes to the panel context.

const from = defaultTimeRange.from.valueOf();
const to = defaultTimeRange.to.valueOf();
const step = (to - from) / 4;
const times = [from + step, from + 2 * step, from + 3 * step];

const frame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: times },
    { name: 'cpu', type: FieldType.number, values: [10, 20, 30] },
  ],
});

const renderPanel = (panelContext?: Partial<PanelContext>, onChangeTimeRange = jest.fn()) =>
  renderTooltipPanel({
    frames: [frame],
    seriesType: 'line',
    family: 'cartesian',
    options: { animation: { enabled: false } },
    panelContext,
    panelProps: { onChangeTimeRange },
  });

const editorEl = (): HTMLElement | null => document.querySelector<HTMLElement>(`[${ANNOTATION_EDITOR_ATTR}]`);

/** The canvas pixel of the second data point, where a hover shows the tooltip. */
const pointPixel = (chart: EChartsType): [number, number] => {
  const [x, y] = chart.convertToPixel({ seriesIndex: 0 }, [times[1], 20]);
  return [x, y];
};

/** The time at a canvas x, as the chart converts it. */
const timeAt = (chart: EChartsType, x: number): number => chart.convertFromPixel({ xAxisIndex: 0 }, x);

/** Press, move and release, as a brush drag. */
const drag = async (chart: EChartsType, fromX: number, toX: number, y: number, modifiers: Modifiers = {}) => {
  await dispatch(chart, 'mousemove', fromX, y, modifiers);
  await dispatch(chart, 'mousedown', fromX, y, modifiers);
  await dispatch(chart, 'mousemove', (fromX + toX) / 2, y, modifiers);
  await dispatch(chart, 'mousemove', toX, y, modifiers);
  await dispatch(chart, 'mouseup', toX, y, modifiers);
};

/** Fill the description and submit the editor form. */
const save = async (description: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: description } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  });
};

const canAdd = (onAnnotationCreate = jest.fn()) => ({ canAddAnnotations: () => true, onAnnotationCreate });

describe('add an annotation from the chart', () => {
  describe('the tooltip "Add annotation" button', () => {
    it('shows in the pinned tooltip when the panel context lets the user add annotations', async () => {
      const chart = await renderPanel(canAdd());
      const [x, y] = pointPixel(chart);
      await dispatch(chart, 'mousemove', x, y);
      await clickAt(chart, x, y);

      expect(screen.getByRole('button', { name: 'Add annotation' })).toBeInTheDocument();
    });

    it('does not show when canAddAnnotations returns false', async () => {
      const chart = await renderPanel({ canAddAnnotations: () => false, onAnnotationCreate: jest.fn() });
      const [x, y] = pointPixel(chart);
      await dispatch(chart, 'mousemove', x, y);
      await clickAt(chart, x, y);

      expect(tooltipText()).not.toBe('');
      expect(screen.queryByRole('button', { name: 'Add annotation' })).toBeNull();
    });

    it('does not show without canAddAnnotations, as in the standalone renderer', async () => {
      const chart = await renderPanel();
      const [x, y] = pointPixel(chart);
      await dispatch(chart, 'mousemove', x, y);
      await clickAt(chart, x, y);

      expect(tooltipText()).not.toBe('');
      expect(screen.queryByRole('button', { name: 'Add annotation' })).toBeNull();
    });

    it('opens the editor at the pinned cursor time and saves a point', async () => {
      const onAnnotationCreate = jest.fn();
      const chart = await renderPanel(canAdd(onAnnotationCreate));
      const [x, y] = pointPixel(chart);
      await dispatch(chart, 'mousemove', x, y);
      await clickAt(chart, x, y);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add annotation' }));
      });

      expect(editorEl()).not.toBeNull();
      // The pinned tooltip closes, as core's `dismiss()`. The hide renders on the next animation
      // frame (`useRafState`), so wait for it.
      // https://testing-library.com/docs/dom-testing-library/api-async/#waitfor
      await waitFor(() => expect(tooltipText()).toBe(''));
      await save('Deploy');

      const time = Math.round(timeAt(chart, x));
      expect(onAnnotationCreate).toHaveBeenCalledWith({ from: time, to: time, description: 'Deploy', tags: [] });
      expect(editorEl()).toBeNull();
    });
  });

  describe('ctrl/cmd + click', () => {
    it.each<[string, Modifiers]>([
      ['ctrl', { ctrlKey: true }],
      ['cmd', { metaKey: true }],
    ])('%s + click opens the editor for a point at the cursor time, and does not pin', async (_name, modifiers) => {
      const onAnnotationCreate = jest.fn();
      const chart = await renderPanel(canAdd(onAnnotationCreate));
      const [x, y] = pointPixel(chart);
      await dispatch(chart, 'mousemove', x - 7, y);
      await clickAt(chart, x - 7, y, modifiers);

      expect(editorEl()).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add annotation' })).toBeNull();
      await save('Restart');

      const time = Math.round(timeAt(chart, x - 7));
      expect(time).not.toBe(times[1]);
      expect(onAnnotationCreate).toHaveBeenCalledWith({ from: time, to: time, description: 'Restart', tags: [] });
    });

    it('does nothing when the user cannot add annotations', async () => {
      const chart = await renderPanel({ canAddAnnotations: () => false });
      const [x, y] = pointPixel(chart);
      await dispatch(chart, 'mousemove', x, y);
      await clickAt(chart, x, y, { ctrlKey: true });

      expect(editorEl()).toBeNull();
    });

    it('a plain click pins the tooltip and opens no editor', async () => {
      const chart = await renderPanel(canAdd());
      const [x, y] = pointPixel(chart);
      await dispatch(chart, 'mousemove', x, y);
      await clickAt(chart, x, y);

      expect(editorEl()).toBeNull();
      expect(screen.getByRole('button', { name: 'Add annotation' })).toBeInTheDocument();
    });
  });

  describe('ctrl/cmd + drag', () => {
    it('opens the editor for a region over the dragged span, and does not zoom', async () => {
      const onAnnotationCreate = jest.fn();
      const onChangeTimeRange = jest.fn();
      const chart = await renderPanel(canAdd(onAnnotationCreate), onChangeTimeRange);
      const [x1, y] = pointPixel(chart);
      const x2 = x1 + 60;
      await drag(chart, x1, x2, y, { ctrlKey: true });

      expect(editorEl()).not.toBeNull();
      expect(onChangeTimeRange).not.toHaveBeenCalled();
      await save('Incident');

      expect(onAnnotationCreate).toHaveBeenCalledWith({
        from: Math.round(timeAt(chart, x1)),
        to: Math.round(timeAt(chart, x2)),
        description: 'Incident',
        tags: [],
      });
    });

    it('a plain drag still zooms and opens no editor', async () => {
      const onChangeTimeRange = jest.fn();
      const chart = await renderPanel(canAdd(), onChangeTimeRange);
      const [x1, y] = pointPixel(chart);
      await drag(chart, x1, x1 + 60, y);

      expect(editorEl()).toBeNull();
      expect(onChangeTimeRange).toHaveBeenCalledWith({
        from: Math.round(timeAt(chart, x1)),
        to: Math.round(timeAt(chart, x1 + 60)),
      });
    });

    it('does not zoom when the user cannot add annotations, as core', async () => {
      const onChangeTimeRange = jest.fn();
      const chart = await renderPanel(undefined, onChangeTimeRange);
      const [x1, y] = pointPixel(chart);
      await drag(chart, x1, x1 + 60, y, { metaKey: true });

      expect(editorEl()).toBeNull();
      expect(onChangeTimeRange).not.toHaveBeenCalled();
    });
  });

  describe('the editor', () => {
    it('does not save without a description', async () => {
      const onAnnotationCreate = jest.fn();
      const chart = await renderPanel(canAdd(onAnnotationCreate));
      const [x, y] = pointPixel(chart);
      await clickAt(chart, x, y, { ctrlKey: true });
      await save('');

      expect(onAnnotationCreate).not.toHaveBeenCalled();
      expect(screen.getByText('Annotation description is required')).toBeInTheDocument();
    });

    it('stays open and shows the error when the save fails, and saves on a retry', async () => {
      const onAnnotationCreate = jest.fn().mockRejectedValueOnce(new Error('Permission denied'));
      const chart = await renderPanel(canAdd(onAnnotationCreate));
      const [x, y] = pointPixel(chart);
      await clickAt(chart, x, y, { ctrlKey: true });
      await save('Deploy');

      expect(onAnnotationCreate).toHaveBeenCalledTimes(1);
      expect(editorEl()).not.toBeNull();
      expect(screen.getByRole('alert')).toHaveTextContent('Permission denied');
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      });
      expect(onAnnotationCreate).toHaveBeenCalledTimes(2);
      expect(editorEl()).toBeNull();
    });

    it('closes on Cancel, on Escape and on a press out of it, with no save', async () => {
      const onAnnotationCreate = jest.fn();
      const chart = await renderPanel(canAdd(onAnnotationCreate));
      const [x, y] = pointPixel(chart);
      const open = () => clickAt(chart, x, y, { ctrlKey: true });

      await open();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(editorEl()).toBeNull();

      await open();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(editorEl()).toBeNull();

      await open();
      fireEvent.mouseDown(document.body);
      expect(editorEl()).toBeNull();

      expect(onAnnotationCreate).not.toHaveBeenCalled();
    });
  });
});
