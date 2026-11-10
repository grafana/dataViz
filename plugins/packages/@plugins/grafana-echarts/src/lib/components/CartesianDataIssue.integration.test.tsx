import { type DataFrame, FieldType, type PanelProps, toDataFrame } from '@grafana/data';
import { render, screen } from '@testing-library/react';
import React, { type ReactElement } from 'react';
import { getComponent } from 'test/panel';
import { type PanelOptions } from 'types';
import { makeLazyPanel } from './LazyPanel';

// The real cartesian chart module gives the data issue. The Grafana error view shows the message (#923).
jest.mock('lib/components/EChart', () => ({ EChart: () => <div>Chart</div> }));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelDataErrorView: ({ message, needsNumberField }: { message?: string; needsNumberField?: boolean }) => (
    <div>{needsNumberField ? 'Data is missing a number field' : message}</div>
  ),
}));

const panelProps = (frames: DataFrame[]) =>
  (getComponent(frames, 'line') as ReactElement<{ children: ReactElement<PanelProps<PanelOptions>> }>).props.children
    .props;

const cases: Array<[string, DataFrame, string]> = [
  [
    'numbers stored as text',
    toDataFrame({
      fields: [
        { name: 'id', type: FieldType.string, values: ['e1', 'e2'] },
        { name: 'mainstat', type: FieldType.string, values: ['120', 'a'] },
      ],
    }),
    'Field mainstat has text values. Convert it with Convert field type.',
  ],
  [
    'no number field',
    toDataFrame({ fields: [{ name: 'id', type: FieldType.string, values: ['e1', 'e2'] }] }),
    'Data is missing a number field',
  ],
  [
    'two fields with one name',
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'v', type: FieldType.number, values: [1, 2] },
        { name: 'v', type: FieldType.number, values: [3, 4] },
      ],
    }),
    'Two fields have the name v. Rename one with Organize fields.',
  ],
];

describe('cartesian data issues', () => {
  it.each(cases)('shows the fix step for %s', async (_name, frame, message) => {
    const LazyPanel = makeLazyPanel('cartesian');
    const { container } = render(<LazyPanel {...panelProps([frame])} />);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(container.querySelector('[data-viz-state="error"]')).not.toBeNull();
    expect(screen.queryByText('Chart')).toBeNull();
  });
});
