import { type DataFrame, FieldType } from '@grafana/data';
import { screen } from '@testing-library/react';
import { getComponent, renderWithGrafana } from 'test/panel';

// A malformed frame: its fields have no `name` (#868). The data plane spec expects a name on each field:
// https://grafana.com/developers/dataplane/
const unnamedFrame = {
  length: 2,
  fields: [
    { type: FieldType.string, values: ['a', 'b'], config: {} },
    { type: FieldType.number, values: [1, 2], config: {} },
  ],
} as unknown as DataFrame;

describe('Relations: frame with unnamed fields', () => {
  it.each(['graph', 'sankey', 'chord'] as const)('shows the missing edges data issue for %s', (seriesType) => {
    renderWithGrafana(getComponent([unnamedFrame], seriesType, undefined, undefined, undefined, 'relations'));
    expect(screen.getByText(/Graph data is missing edges/)).toBeInTheDocument();
  });
});
