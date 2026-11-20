import { rangeUtil } from '@grafana/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';

const value = rangeUtil.convertRawToRange({ from: '2026-11-01 10:00:00', to: '2026-11-02 11:00:00' }, 'utc');

function setup() {
  const onChange = jest.fn();
  render(
    <TimeRangeSelector
      value={value}
      timeZone="utc"
      onChange={onChange}
      onChangeTimeZone={jest.fn()}
      compactDesign="tabs"
      widthOverride={320}
      hideTimeZone
      hideFiscalYear
    />
  );
  return { user: userEvent.setup(), onChange };
}

afterEach(() => localStorage.clear());

it('supplies quick ranges and applies custom durations', async () => {
  const { user, onChange } = setup();
  expect(screen.getByText('Last 5 minutes')).toBeVisible();
  await user.type(screen.getByRole('textbox', { name: 'Search quick ranges' }), '3h{Enter}');
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ raw: { from: 'now-3h', to: 'now' } }));
});

it('edits absolute inputs without applying until requested', async () => {
  const { user, onChange } = setup();
  await user.click(screen.getByRole('tab', { name: 'Absolute' }));
  await user.click(screen.getAllByRole('button', { name: 'Open calendar' })[0]);
  await user.click(screen.getByRole('button', { name: 'Update inputs' }));
  expect(onChange).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Apply time range' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ from: expect.anything(), to: expect.anything() }));
  expect(onChange.mock.calls[0][0].from.toISOString()).toBe('2026-11-01T10:00:00.000Z');
});

it('supports selection when localStorage is blocked', async () => {
  const storage = jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Storage blocked', 'SecurityError');
  });
  try {
    const { user, onChange } = setup();
    await user.type(screen.getByRole('textbox', { name: 'Search quick ranges' }), '2h{Enter}');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ raw: { from: 'now-2h', to: 'now' } }));
  } finally {
    storage.mockRestore();
  }
});
