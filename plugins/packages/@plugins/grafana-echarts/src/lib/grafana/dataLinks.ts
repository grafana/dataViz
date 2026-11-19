// The data links of a value that a canvas draws (stat, gauge). A canvas cell is not a DOM element, so this file
// gives the parts that the `DataLinksContextMenu` of core gives to a DOM cell. This file has no ECharts code.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/DataLinks/DataLinksContextMenu.tsx
// https://grafana.com/docs/grafana/latest/panels-visualizations/configure-data-links/
import { type FieldDisplay, type LinkModel } from '@grafana/data';

/** The data links of one value, made when the caller asks for them. */
export type DataLinkSupplier = () => LinkModel[];

/**
 * The data links of a value. The result is empty when the field has no links, and when it has no link supplier,
 * as the condition `hasLinks && getLinks` of core Stat.
 */
export function getDisplayLinks(display: FieldDisplay): LinkModel[] {
  return display.hasLinks && display.getLinks ? display.getLinks() : [];
}

/**
 * The CSS cursor of a value for its number of links, as core: `pointer` for one link (an `<a>` element in core),
 * `context-menu` for more than one, and no cursor for none.
 */
export function getDataLinksCursor(count: number): 'pointer' | 'context-menu' | undefined {
  if (count === 0) {
    return undefined;
  }
  return count === 1 ? 'pointer' : 'context-menu';
}

/** The modifier keys of the click that opens a link. With ctrl or cmd, the browser opens a new tab. */
export type LinkClickModifiers = Partial<Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>>;

/**
 * Opens one data link, as a click on the `<a>` element that core draws for a value with one link. The function
 * makes that element, with the `href`, the `target` and the `onClick` of the link, and clicks it. Thus the click
 * goes through the link handler of Grafana, which opens an internal URL with no page load.
 * https://github.com/grafana/grafana/blob/main/public/app/core/navigation/patch/interceptLinkClicks.ts
 */
export function openDataLink(link: LinkModel, modifiers: LinkClickModifiers = {}): void {
  const anchor = document.createElement('a');
  anchor.href = link.href;
  if (link.target) {
    anchor.target = link.target;
  }
  anchor.style.display = 'none';
  const { onClick } = link;
  if (onClick) {
    anchor.addEventListener('click', (event) => onClick(event));
  }
  document.body.appendChild(anchor);
  anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...modifiers }));
  anchor.remove();
}
