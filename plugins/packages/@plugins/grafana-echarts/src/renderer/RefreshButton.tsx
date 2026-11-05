import { t } from '@grafana/i18n';
import { RefreshPicker } from '@grafana/ui';
import React from 'react';
import { type RefreshRequest } from './contract/renderer-api';

const noop = () => {};

interface Props {
  busy: boolean;
  onRequest: (request: RefreshRequest) => void;
}

/**
 * The Refresh button (`refresh.2`). It has no auto-refresh interval: each refresh is a new tool call of the App. The
 * picker reads its `aria-label` from `text`, so the button has a visible text.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/RefreshPicker/RefreshPicker.tsx
 */
export const RefreshButton = ({ busy, onRequest }: Props) => (
  <RefreshPicker
    noIntervalPicker
    text={t('renderer.refresh', 'Refresh')}
    isLoading={busy}
    onIntervalChanged={noop}
    onRefresh={() => onRequest({ cause: 'refresh' })}
  />
);
