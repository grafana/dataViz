import { css, cx } from '@emotion/css';
import { autoUpdate, offset, useFloating } from '@floating-ui/react';
import { type GrafanaTheme2, type TimeOption, type TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type TimeZone } from '@grafana/schema';
import {
  ButtonGroup,
  getPortalContainer,
  Portal,
  ToolbarButton,
  Tooltip,
  useStyles2,
  useTheme2,
  type WeekStart,
} from '@grafana/ui';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMedia } from 'react-use';
import { rootClassName } from '../rootStyles';
import { getPositioningMiddleware } from './floating';
import { getModalStyles } from './getModalStyles';
import { getQuickOptions } from './options';
import { formattedRange } from './pickerLabelHelpers';
import { TimePickerButtonLabel } from './TimePickerButtonLabel';
import { TimePickerTooltip } from './TimePickerTooltip';
import { TimeRangeSelector } from './TimeRangeSelector';

export function TimeRangePicker(props: TimeRangePickerProps) {
  const [isOpen, setOpen] = useState(false);

  const {
    value,
    onError,
    timeZone,
    fiscalYearStartMonth,
    hideTimeZone,
    history,
    onChangeTimeZone,
    onChangeFiscalYearStartMonth,
    quickRanges,
    hideQuickRanges,
    widthOverride,
    isOnCanvas = true,
    onToolbarTimePickerClick,
    weekStart,
  } = props;

  const onChange = (timeRange: TimeRange) => {
    props.onChange(timeRange);
    setOpen(false);
  };

  useEffect(() => {
    if (isOpen && onToolbarTimePickerClick) {
      onToolbarTimePickerClick();
    }
  }, [isOpen, onToolbarTimePickerClick]);

  const onToolbarButtonSwitch = () => {
    setOpen((prevState) => !prevState);
  };

  const onClose = () => {
    setOpen(false);
  };

  const overlayRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const theme = useTheme2();
  const isNarrow = useMedia(theme.breakpoints.down('sm').replace('@media ', ''));
  const placement = 'bottom-end';
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement,
    strategy: 'fixed',
    // a transform would misplace fixed children, like the time zone Select menu.
    transform: false,
    middleware: [offset(4), ...getPositioningMiddleware(placement)],
    whileElementsMounted: autoUpdate,
  });
  const setOverlayRef = useCallback(
    (node: HTMLElement | null) => {
      overlayRef.current = node;
      refs.setFloating(node);
    },
    [refs]
  );
  const { overlayProps, underlayProps } = useOverlay(
    {
      onClose,
      isDismissable: true,
      isOpen,
      shouldCloseOnInteractOutside: (element) => {
        // the backdrop is in the portal container too, so check it first.
        if (backdropRef.current?.contains(element)) {
          return true;
        }
        const portalContainer = getPortalContainer();
        return !buttonRef.current?.contains(element) && !portalContainer.contains(element);
      },
    },
    overlayRef
  );
  const { dialogProps } = useDialog(
    { 'aria-label': t('time-picker.range-picker.dialog-label', 'Time range picker') },
    overlayRef
  );

  const styles = useStyles2(getStyles);
  const { modalBackdrop } = useStyles2(getModalStyles);

  const variant = isOnCanvas ? 'canvas' : 'default';

  const isFromAfterTo = value?.to?.isBefore(value.from);
  const timePickerIcon = isFromAfterTo ? 'exclamation-triangle' : 'clock-nine';

  const currentTimeRange = formattedRange(value, timeZone, quickRanges);

  const setReference = useCallback((node: HTMLDivElement | null) => refs.setReference(node), [refs]);
  return (
    <ButtonGroup className={styles.container} ref={setReference}>
      <Tooltip
        ref={buttonRef}
        content={<TimePickerTooltip timeRange={value} timeZone={timeZone} />}
        placement="bottom"
        interactive
      >
        <ToolbarButton
          data-testid={selectors.components.TimePicker.openButton}
          aria-label={t('time-picker.range-picker.current-time-selected', 'Time range selected: {{currentTimeRange}}', {
            currentTimeRange,
          })}
          aria-controls="TimeRangeSelector"
          onClick={onToolbarButtonSwitch}
          icon={timePickerIcon}
          isOpen={isOpen}
          type="button"
          variant={variant}
        >
          <TimePickerButtonLabel {...props} />
        </ToolbarButton>
      </Tooltip>
      {isOpen && (
        <Portal zIndex={theme.zIndex.modal}>
          <div data-testid={selectors.components.TimePicker.overlayContent}>
            <div
              ref={backdropRef}
              role="presentation"
              className={cx(modalBackdrop, styles.backdrop)}
              {...underlayProps}
            />
            <FocusScope contain autoFocus restoreFocus>
              <section
                className={cx(rootClassName(theme), styles.content)}
                ref={setOverlayRef}
                style={isNarrow ? undefined : floatingStyles}
                {...overlayProps}
                {...dialogProps}
              >
                <TimeRangeSelector
                  timeZone={timeZone}
                  fiscalYearStartMonth={fiscalYearStartMonth}
                  hideTimeZone={hideTimeZone}
                  value={value}
                  onChange={onChange}
                  quickOptions={quickRanges || getQuickOptions()}
                  history={history}
                  showHistory={!props.hideHistory}
                  compactDesign={props.compactDesign ?? 'tabs'}
                  hideFiscalYear={props.hideFiscalYear}
                  widthOverride={widthOverride}
                  onChangeTimeZone={onChangeTimeZone}
                  onChangeFiscalYearStartMonth={onChangeFiscalYearStartMonth}
                  hideQuickRanges={hideQuickRanges}
                  onError={onError}
                  weekStart={weekStart}
                />
              </section>
            </FocusScope>
          </div>
        </Portal>
      )}
    </ButtonGroup>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      position: 'relative',
      display: 'flex',
      verticalAlign: 'middle',
    }),
    backdrop: css({
      display: 'none',
      [theme.breakpoints.down('sm')]: {
        display: 'block',
      },
    }),
    content: css({
      zIndex: theme.zIndex.dropdown,

      // Wider viewports are positioned by useFloating.
      [theme.breakpoints.down('sm')]: {
        position: 'fixed',
        right: '50%',
        top: '50%',
        left: 'auto',
        transform: 'translate(50%, -50%)',
        zIndex: theme.zIndex.modal,
      },
    }),
  };
};

export interface TimeRangePickerProps {
  /** Compact presentation. The tabbed design is opt-in. */
  compactDesign?: 'legacy' | 'tabs';
  /** Hide supplied history. Defaults to false; persistence remains the caller's responsibility. */
  hideHistory?: boolean;
  hideFiscalYear?: boolean;
  hideText?: boolean;
  value: TimeRange;
  timeZone?: TimeZone;
  fiscalYearStartMonth?: number;
  hideTimeZone?: boolean;

  onChange: (timeRange: TimeRange) => void;
  onChangeTimeZone: (timeZone: TimeZone) => void;
  onChangeFiscalYearStartMonth?: (month: number) => void;
  onError?: (error?: string) => void;
  history?: TimeRange[];
  /**
   * Replace the default quick-range presets, preserving the supplied order and labels.
   * An empty array shows no presets. Search can still create custom relative durations.
   */
  quickRanges?: TimeOption[];
  hideQuickRanges?: boolean;
  widthOverride?: number;
  isOnCanvas?: boolean;
  onToolbarTimePickerClick?: () => void;
  /** Which day of the week the calendar should start on. Possible values: "saturday", "sunday" or "monday" */
  weekStart?: WeekStart;
}
