// The styles of the root of the Renderer. Grafana sets the text color, the font and an element reset in its global
// styles, on `body` and on bare elements. The Renderer does not change the document of the App, so it gives the same
// rules to its own root only.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/themes/GlobalStyles/elements.ts
import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';

/** The form elements that do not inherit the color and the font in a browser. */
const FORM_ELEMENTS = ['button', 'input', 'optgroup', 'select', 'textarea'];

/**
 * `:where(&)` has no specificity, so each rule below is as weak as the global element rule of Grafana, and the
 * class of a `@grafana/ui` component still wins. `.root button` would beat the class and break the component.
 * https://developer.mozilla.org/en-US/docs/Web/CSS/:where
 */
const within = (selectors: string[]) => selectors.map((selector) => `:where(&) ${selector}`).join(', ');

export const rootClassName = (theme: GrafanaTheme2): string =>
  css({
    // The panel background, as Grafana gives it.
    background: theme.colors.background.primary,
    color: theme.colors.text.primary,
    colorScheme: theme.colors.mode,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    boxSizing: 'border-box',
    [within(['*', '*::before', '*::after'])]: { boxSizing: 'inherit' },
    // A browser gives a button `color: buttontext` (black), for example on each legend label.
    [within(FORM_ELEMENTS)]: { borderRadius: 0, color: 'inherit', font: 'inherit', lineHeight: 'inherit', margin: 0 },
    [within(['button'])]: { letterSpacing: theme.typography.body.letterSpacing, cursor: 'pointer' },
  });
