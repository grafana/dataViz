import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';
import React from 'react';

interface Props {
  disabled?: boolean;
  onClick: () => void;
}

export const ResetTimeRangeButton = ({ disabled, onClick }: Props) => {
  const label = t('renderer.reset-time-range', 'Reset time range');
  return (
    <ToolbarButton icon="compress-arrows" aria-label={label} tooltip={label} disabled={disabled} onClick={onClick} />
  );
};
