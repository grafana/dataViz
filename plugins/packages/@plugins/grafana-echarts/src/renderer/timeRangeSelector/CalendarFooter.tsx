import { Trans } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';
import React from 'react';

import { type TimePickerCalendarProps } from './TimePickerCalendar';

export function Footer({ onClose, onApply }: TimePickerCalendarProps) {
  return (
    <Stack gap={2} justifyContent="space-between">
      <Button variant="secondary" onClick={onClose}>
        <Trans i18nKey="time-picker.calendar.cancel-button">Cancel</Trans>
      </Button>

      <Button onClick={onApply}>
        <Trans i18nKey="time-picker.calendar.apply-button">Apply time range</Trans>
      </Button>
    </Stack>
  );
}

Footer.displayName = 'Footer';
