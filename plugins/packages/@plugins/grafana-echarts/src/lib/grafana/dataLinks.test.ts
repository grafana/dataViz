import { type FieldDisplay, type LinkModel } from '@grafana/data';
import { getDataLinksCursor, getDisplayLinks, openDataLink } from './dataLinks';

const link = (extra: Partial<LinkModel> = {}): LinkModel => ({
  href: 'http://example.com/a',
  title: 'A',
  target: undefined,
  origin: {},
  ...extra,
});

const display = (extra: Partial<FieldDisplay>) => ({ name: 'cpu', ...extra }) as FieldDisplay;

/** The clicks on an `<a>` element that reach the document, where the link handler of Grafana listens. */
function recordAnchorClicks() {
  const clicks: Array<{ href: string; target: string; ctrlKey: boolean; inDocument: boolean }> = [];
  const listener = (event: MouseEvent) => {
    const anchor = event.target as HTMLAnchorElement;
    clicks.push({
      href: anchor.href,
      target: anchor.target,
      ctrlKey: event.ctrlKey,
      inDocument: document.contains(anchor),
    });
    // jsdom has no navigation.
    event.preventDefault();
  };
  document.addEventListener('click', listener);
  return { clicks, stop: () => document.removeEventListener('click', listener) };
}

describe('getDisplayLinks', () => {
  it('gives the links of the supplier of a value with links', () => {
    const links = [link()];
    expect(getDisplayLinks(display({ hasLinks: true, getLinks: () => links }))).toBe(links);
  });

  it('gives no links for a value with no links, and does not call the supplier', () => {
    const getLinks = jest.fn(() => [link()]);
    expect(getDisplayLinks(display({ hasLinks: false, getLinks }))).toEqual([]);
    expect(getLinks).not.toHaveBeenCalled();
  });

  it('gives no links for a value with no supplier', () => {
    expect(getDisplayLinks(display({ hasLinks: true }))).toEqual([]);
  });
});

describe('getDataLinksCursor', () => {
  it('gives no cursor for no link, a pointer for one link, and the menu cursor for more', () => {
    expect(getDataLinksCursor(0)).toBeUndefined();
    expect(getDataLinksCursor(1)).toBe('pointer');
    expect(getDataLinksCursor(2)).toBe('context-menu');
    expect(getDataLinksCursor(5)).toBe('context-menu');
  });
});

describe('openDataLink', () => {
  let recorder: ReturnType<typeof recordAnchorClicks>;
  beforeEach(() => {
    recorder = recordAnchorClicks();
  });
  afterEach(() => recorder.stop());

  it('clicks an anchor with the href of the link, and removes the anchor', () => {
    openDataLink(link());
    expect(recorder.clicks).toEqual([{ href: 'http://example.com/a', target: '', ctrlKey: false, inDocument: true }]);
    expect(document.querySelector('a')).toBeNull();
  });

  it('sets the target of a link that opens in a new tab', () => {
    openDataLink(link({ target: '_blank' }));
    expect(recorder.clicks[0].target).toBe('_blank');
  });

  it('calls the click handler of the link with the click event', () => {
    const onClick = jest.fn();
    openDataLink(link({ onClick }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
  });

  it('gives the modifier keys of the pointer to the click', () => {
    openDataLink(link(), { ctrlKey: true });
    expect(recorder.clicks[0].ctrlKey).toBe(true);
  });
});
