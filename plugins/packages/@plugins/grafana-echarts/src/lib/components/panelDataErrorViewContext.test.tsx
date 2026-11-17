import { render } from '@testing-library/react';
import React, { useContext } from 'react';
import { PanelDataErrorViewContext } from './panelDataErrorViewContext';

const ErrorView = () => <>{useContext(PanelDataErrorViewContext)({ panelId: 1, data: { series: [] } as never })}</>;

describe('PanelDataErrorViewContext', () => {
  it('with no provider, shows no view and warns one time', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = render(<ErrorView />);
    render(<ErrorView />);
    expect(container).toBeEmptyDOMElement();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no PanelDataErrorViewContext provider'));
    warn.mockRestore();
  });
});
