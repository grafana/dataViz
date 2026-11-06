/**
 * jsdom has no layout, so `getClientRects` of each element is empty. This gives `el` one box while it is in the
 * document and its `display` is not `none`, as a browser does. It does not look at the parents of `el`.
 * https://developer.mozilla.org/en-US/docs/Web/API/Element/getClientRects
 */
export function withLayout<T extends HTMLElement>(el: T): T {
  el.getClientRects = () =>
    (el.isConnected && el.style.display !== 'none' ? [new DOMRect()] : []) as unknown as DOMRectList;
  return el;
}
