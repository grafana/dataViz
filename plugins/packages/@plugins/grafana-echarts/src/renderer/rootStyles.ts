// The styles of the root of the Renderer. Grafana sets the text color, the font and an element reset in its global
// styles, on `body` and on bare elements. The Renderer does not change the document of the App, so it gives the same
// rules to its own root, and to its own elements in a portal.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/themes/GlobalStyles/elements.ts
import { css, type CSSObject } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';

/** The form elements that do not inherit the color and the font in a browser. */
const FORM_ELEMENTS = ['button', 'input', 'optgroup', 'select', 'textarea'];

/** The rules for some elements in the element that has the class. */
type ElementRules = [selectors: string[], rules: CSSObject];

const elementRules = (theme: GrafanaTheme2): ElementRules[] => [
  [['*', '*::before', '*::after'], { boxSizing: 'inherit' }],
  // A browser gives a button `color: buttontext` (black), for example on each legend label.
  [FORM_ELEMENTS, { borderRadius: 0, color: 'inherit', font: 'inherit', lineHeight: 'inherit', margin: 0 }],
  [['button'], { letterSpacing: theme.typography.body.letterSpacing, cursor: 'pointer' }],
];

/**
 * The element rules of the root. Emotion puts the class in front of a nested selector that starts with `:`, so the
 * result is `.root:where(.root) button`. It has the specificity of a class and an element, so a rule of the root
 * wins over the class of a `@grafana/ui` component, for example for the corners of a toolbar button.
 * https://developer.mozilla.org/en-US/docs/Web/CSS/:where
 */
const within = (groups: ElementRules[]): CSSObject =>
  Object.fromEntries(
    groups.map(([selectors, rules]) => [selectors.map((selector) => `:where(&) ${selector}`).join(', '), rules])
  );

/**
 * The element rules of a portal. A selector starts with `*`, so the result is `* :where(.portal) button`. `:where`
 * has no specificity, so each rule is as weak as the global element rule of Grafana, and the class of a
 * `@grafana/ui` component wins. Each selector has its own rule: Emotion does not put the class in a list of
 * selectors that start with `*`.
 */
const weakWithin = (groups: ElementRules[]): CSSObject => {
  const output: Record<string, CSSObject> = {};
  for (const [selectors, rules] of groups) {
    for (const selector of selectors) {
      const key = `* :where(&) ${selector}`;
      output[key] = { ...output[key], ...rules };
    }
  }
  return output;
};

const textStyles = (theme: GrafanaTheme2): CSSObject => ({
  color: theme.colors.text.primary,
  colorScheme: theme.colors.mode,
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.fontSize,
  lineHeight: theme.typography.body.lineHeight,
  boxSizing: 'border-box',
});

export const rootClassName = (theme: GrafanaTheme2): string =>
  css({
    // The panel background, as Grafana gives it.
    background: theme.colors.background.primary,
    ...textStyles(theme),
    ...within(elementRules(theme)),
  });

/**
 * The class for the parent of a Renderer element in a portal, for example the Add annotation form. A portal is out
 * of the root, so it gets the text color, the font and the element rules here. It has no background.
 */
export const portalClassName = (theme: GrafanaTheme2): string =>
  css({ ...textStyles(theme), ...weakWithin(elementRules(theme)) });
