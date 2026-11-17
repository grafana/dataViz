import { FieldType, toDataFrame } from '@grafana/data';
import { screen } from '@testing-library/react';
import { type SeriesType } from 'editor/types';
import { type ChartFamily } from 'lib/echarts/charts/autoSeriesType';
import React from 'react';
import { getComponent, renderWithGrafana } from 'test/panel';
import { STREAM_ISSUE_MESSAGES } from 'lib/echarts/charts/streamIssue';

// Each chart kind shows the Grafana error view, and no chart, for a frame that it cannot draw (#189).

const mockPanelDataErrorView = jest.fn((props: { message?: string }) => (
  <div data-testid="panel-data-error-view">{props.message}</div>
));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelDataErrorView: (props: { message?: string }) => mockPanelDataErrorView(props),
}));

const stringOnly = toDataFrame({
  fields: [{ name: 'label', type: FieldType.string, values: ['a', 'b'] }],
});

const numberOnly = toDataFrame({
  fields: [
    { name: 'a', type: FieldType.number, values: [1, 2] },
    { name: 'b', type: FieldType.number, values: [3, 4] },
  ],
});

// Part-to-whole starts with the core pie chart text and adds the fix steps (#924).
const pieMessage = { message: expect.stringContaining('Cannot visualize data.') };

const cases: Array<[ChartFamily, SeriesType, typeof stringOnly, Record<string, unknown>]> = [
  ['cartesian', 'line', stringOnly, { needsNumberField: true }],
  ['cartesian', 'bar', stringOnly, { needsNumberField: true }],
  ['cartesian', 'scatter', stringOnly, { needsNumberField: true }],
  ['heatmap', 'heatmap', stringOnly, { needsNumberField: true }],
  ['part-to-whole', 'pie', stringOnly, pieMessage],
  ['part-to-whole', 'funnel', stringOnly, pieMessage],
  ['multivariate', 'radar', stringOnly, { needsNumberField: true }],
  ['multivariate', 'parallel', stringOnly, { needsNumberField: true }],
  ['hierarchy', 'treemap', stringOnly, { needsNumberField: true }],
  ['hierarchy', 'sunburst', stringOnly, { needsNumberField: true }],
  ['stream', 'themeRiver', numberOnly, { message: STREAM_ISSUE_MESSAGES['time-field-missing'] }],
  ['cartesian', 'boxplot', numberOnly, {}],
];

describe('data shape issue view', () => {
  beforeEach(() => mockPanelDataErrorView.mockClear());

  it.each(cases)('%s %s shows the error view and no chart', (family, seriesType, frame, needs) => {
    const { container } = renderWithGrafana(getComponent([frame], seriesType, {}, {}, {}, family));

    expect(screen.getByTestId('panel-data-error-view')).toBeInTheDocument();
    expect(mockPanelDataErrorView).toHaveBeenCalledWith(expect.objectContaining(needs));
    expect(container.querySelector('canvas')).toBeNull();
  });
});
