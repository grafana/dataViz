import { FieldType, type PanelData, toDataFrame } from '@grafana/data';
import { screen } from '@testing-library/react';
import { registerGeoChart } from 'lib/echarts/geo/chart';
import { GEO_ISSUE_MESSAGES } from 'lib/grafana/geo/dataIssue';
import React from 'react';
import { getComponent, renderWithGrafana } from 'test/panel';

// The geo panel shows the Grafana error view, and no map, for a frame that it cannot put on the map (#864, #925).

const mockPanelDataErrorView = jest.fn((props: { message?: string }) => (
  <div data-testid="panel-data-error-view">{props.message}</div>
));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelDataErrorView: (props: { message?: string }) => mockPanelDataErrorView(props),
}));

registerGeoChart();

const frames = {
  'string only': toDataFrame({ fields: [{ name: 'city', type: FieldType.string, values: ['a', 'b'] }] }),
  'number only': toDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [1, 2] }] }),
  'time series': toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 2] },
      { name: 'value', type: FieldType.number, values: [1, 2] },
    ],
  }),
  'no field names': toDataFrame({
    fields: [{ name: undefined as unknown as string, type: FieldType.number, values: [1, 2] }],
  }),
};

describe('geo data issue view', () => {
  beforeEach(() => mockPanelDataErrorView.mockClear());

  it.each(Object.entries(frames))('%s shows the error view and no map', (_, frame) => {
    const { container } = renderWithGrafana(getComponent([frame], 'map', {}, {}, {}, 'geo'));

    expect(screen.getByTestId('panel-data-error-view')).toHaveTextContent(GEO_ISSUE_MESSAGES['location-field-missing']);
    expect(container.querySelector('[data-viz-state="error"]')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('a frame with location fields shows no error view', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'lat', type: FieldType.number, values: [1, 2] },
        { name: 'lon', type: FieldType.number, values: [3, 4] },
      ],
    });
    renderWithGrafana(getComponent([frame], 'map', {}, {}, {}, 'geo'));

    expect(screen.queryByTestId('panel-data-error-view')).toBeNull();
  });

  const expectIssue = (container: HTMLElement, message: string) => {
    expect(screen.getByTestId('panel-data-error-view')).toHaveTextContent(message);
    expect(container.querySelector('[data-viz-state="error"]')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  };

  it('swapped latitude and longitude show the range message', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'lat', type: FieldType.number, values: [120, 150] },
        { name: 'lon', type: FieldType.number, values: [40, 50] },
      ],
    });
    const { container } = renderWithGrafana(getComponent([frame], 'map', {}, {}, {}, 'geo'));
    expectIssue(container, GEO_ISSUE_MESSAGES['location-out-of-range']);
  });

  it('a layer refId filter that matches no frame shows the filter message', () => {
    const frame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'lat', type: FieldType.number, values: [1, 2] },
        { name: 'lon', type: FieldType.number, values: [3, 4] },
      ],
    });
    const layers = [{ type: 'markers', name: 'Layer 1', filterData: { id: 'byRefId', options: 'B' } }];
    const request = { targets: [{ refId: 'A' }, { refId: 'B' }] } as PanelData['request'];
    const { container } = renderWithGrafana(getComponent([frame], 'map', { layers } as never, { request }, {}, 'geo'));
    expectIssue(container, GEO_ISSUE_MESSAGES['layer-filter-no-frame']);
  });
});
