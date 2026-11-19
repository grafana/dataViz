import { type DataFrame } from '@grafana/data';
import { screen } from '@testing-library/react';
import { type EChartsType } from 'echarts';
import { height, width } from 'test/panel';
import { cpuFrame, linkedFrame, renderStat, seriesFrame, statCanvasOptions } from 'test/statCanvas';
import { clickAt, dispatch, renderTooltipPanel } from 'test/tooltipPointer';

// Data links of the stat panel: a click on a cell, through the real pointer pipeline of ZRender. The claims are
// about the DOM (the opened link, the menu, the cursor), because a canvas cell has no element of its own.

const renderPanel = (frames: DataFrame[]) =>
  renderTooltipPanel({ frames, seriesType: 'stat', family: 'stat', options: statCanvasOptions() });

/** The cursor that ZRender set on the chart: it sets the style of the root of its layers. */
const cursorOf = (chart: EChartsType) => (chart.getDom().firstElementChild as HTMLElement).style.cursor;

const center: [number, number] = [width / 2, height / 2];

describe('stat data links', () => {
  // The host and the path of each opened link. A URL with its scheme is not in this file: the test name reader
  // (`test/testSource.ts`) reads the two slashes of a URL as the start of a comment.
  let hrefs: string[];
  const onDocumentClick = (event: MouseEvent) => {
    if (event.target instanceof HTMLAnchorElement) {
      hrefs.push(`${event.target.host}${event.target.pathname}`);
      // jsdom has no navigation.
      event.preventDefault();
    }
  };
  beforeEach(() => {
    hrefs = [];
    document.addEventListener('click', onDocumentClick);
  });
  afterEach(() => document.removeEventListener('click', onDocumentClick));

  it('opens the link of a value with one link on a click', async () => {
    const chart = await renderPanel([linkedFrame(1)]);
    await clickAt(chart, ...center);
    expect(hrefs).toEqual(['example.com/1']);
    expect(screen.queryByText('Data links')).toBeNull();
  });

  it('opens a menu with each link of a value with two links on a click', async () => {
    const chart = await renderPanel([linkedFrame(2)]);
    await clickAt(chart, ...center);
    expect(hrefs).toEqual([]);
    expect(screen.getByText('Data links')).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Link 1' }).getAttribute('href')).toContain('example.com/1');
    expect(screen.getByRole('menuitem', { name: 'Link 2' }).getAttribute('href')).toContain('example.com/2');
  });

  it('does nothing on a click of a value with no link', async () => {
    const chart = await renderPanel([cpuFrame]);
    await clickAt(chart, ...center);
    expect(hrefs).toEqual([]);
    expect(screen.queryByText('Data links')).toBeNull();
  });

  it('opens the links of the clicked value when the panel has more than one value', async () => {
    const linked = linkedFrame(1);
    const frame = seriesFrame(2);
    // The second value has the link, and the first has none. The two cells are side by side.
    frame.fields[2].config = { ...frame.fields[2].config, links: linked.fields[1].config.links };
    const chart = await renderPanel([frame]);
    await clickAt(chart, width / 4, height / 2);
    expect(hrefs).toEqual([]);
    await clickAt(chart, (width * 3) / 4, height / 2);
    expect(hrefs).toEqual(['example.com/1']);
  });

  it('shows the pointer cursor on a value with one link', async () => {
    const chart = await renderPanel([linkedFrame(1)]);
    await dispatch(chart, 'mousemove', ...center);
    expect(cursorOf(chart)).toBe('pointer');
  });

  it('shows the menu cursor on a value with two links', async () => {
    const chart = await renderPanel([linkedFrame(2)]);
    await dispatch(chart, 'mousemove', ...center);
    expect(cursorOf(chart)).toBe('context-menu');
  });

  it('shows the default cursor on a value with no link', async () => {
    const chart = await renderPanel([cpuFrame]);
    await dispatch(chart, 'mousemove', ...center);
    expect(cursorOf(chart)).toBe('default');
  });

  it('draws a value with links as a value with no link', async () => {
    const plain = await renderStat([cpuFrame]);
    const linked = await renderStat([linkedFrame(2)]);
    expect(linked.seriesEvents).toEqual(plain.seriesEvents);
  });
});
