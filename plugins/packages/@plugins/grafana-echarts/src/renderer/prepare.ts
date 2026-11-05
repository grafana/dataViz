// From the input of `render` to what the Renderer shows: an error, the no-data view, or the chart. It never throws
// (`renderer.3`).
import { type GrafanaTheme2 } from '@grafana/data';
import { type Notice, type RenderError } from './contract/renderer-api';
import { hasNoRows } from './computeState';
import { LOG_PREFIX } from './log';
import { errorMessage } from './messages';
import { allNotices } from './notices';
import { PANELS } from './panels';
import { isObject, parseSpec } from './parseSpec';
import { panelType } from './registry';
import { preparePanel, type SpecPanelProps, themeOf } from './toPanelProps';

export type Prepared = { theme: GrafanaTheme2 } & (
  | { kind: 'error'; error: RenderError }
  | { kind: 'no-data'; notices: Notice[]; noValue?: string }
  | { kind: 'chart'; props: SpecPanelProps; notices: Notice[]; panelName: string }
);

export function prepare(input: unknown): Prepared {
  const parsed = parseSpec(input);
  if (!parsed.ok) {
    // `renderer.3`: the error also goes to the console. A spec that is not correct can still name its theme.
    console.error(LOG_PREFIX, parsed.error.message);
    const theme = themeOf(isObject(input) && input.theme === 'light' ? 'light' : 'dark');
    return { kind: 'error', error: parsed.error, theme };
  }
  const { spec } = parsed;
  const theme = themeOf(spec.theme);
  // `state.6`: `<panelName>` is the `name` of the panel row.
  const panelName = panelType(spec.panel.type)?.name ?? spec.panel.type;
  try {
    const { props, omittedSeries } = preparePanel(spec, PANELS[spec.panel.type]);
    const notices = allNotices(spec, omittedSeries);
    if (hasNoRows(props.data.series)) {
      return { kind: 'no-data', notices, noValue: props.fieldConfig.defaults.noValue, theme };
    }
    return { kind: 'chart', props, notices, panelName, theme };
  } catch (error) {
    // `state.6`: the raw message goes to the console only.
    console.error(LOG_PREFIX, error);
    return {
      kind: 'error',
      error: { code: 'render-error', message: errorMessage('render-error', { panelName }) },
      theme,
    };
  }
}
