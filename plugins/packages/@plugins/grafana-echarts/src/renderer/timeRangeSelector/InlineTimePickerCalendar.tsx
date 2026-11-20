import { css } from '@emotion/css';
import { Button, Stack, useStyles2 } from '@grafana/ui';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { Body } from './CalendarBody';
import { type TimePickerCalendarProps } from './TimePickerCalendar';

interface Props extends Omit<TimePickerCalendarProps, 'isOpen' | 'onApply'> {
  onUpdateInputs: () => void;
}

export function InlineTimePickerCalendar(props: Props) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLElement>(null);
  const { overlayProps } = useOverlay({ isOpen: true, onClose: props.onClose }, ref);
  return (
    <FocusScope autoFocus>
      <section
        role="dialog"
        tabIndex={-1}
        aria-label={t('time-picker.inline-calendar.label', 'Calendar')}
        className={styles.calendar}
        ref={ref}
        {...overlayProps}
      >
        <Body {...props} />
        <Stack gap={2} justifyContent="space-between">
          <Button variant="secondary" onClick={props.onClose}>
            <Trans i18nKey="time-picker.calendar.cancel-button">Cancel</Trans>
          </Button>
          <Button onClick={props.onUpdateInputs}>
            <Trans i18nKey="time-picker.inline-calendar.update-inputs">Update inputs</Trans>
          </Button>
        </Stack>
      </section>
    </FocusScope>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  calendar: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
    padding: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
});
