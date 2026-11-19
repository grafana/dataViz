import { type LinkModel } from '@grafana/data';
import { type ECElementEvent } from 'echarts/core';
import { type EChartsType } from 'lib/echarts/echarts';
import { type DataLinkSupplier, getDataLinksCursor, openDataLink } from 'lib/grafana/dataLinks';
import { useCallback, useEffect, useState } from 'react';

/** An open menu of data links, at a position in pixels of the viewport. */
export interface DataLinksMenuState {
  x: number;
  y: number;
  links: LinkModel[];
}

/** The links of the data item of a mouse event. Only the items of the first series have links. */
function linksOf(params: ECElementEvent, suppliers: DataLinkSupplier[]): LinkModel[] {
  if (params.componentType !== 'series' || params.seriesIndex !== 0) {
    return [];
  }
  return suppliers[params.dataIndex]?.() ?? [];
}

/**
 * Data links on a click of a data item, as the `DataLinksContextMenu` of core: an item with one link opens it,
 * and an item with more than one link opens a menu at the pointer. The cursor shows which of the two a click
 * does. `suppliers` has the links of each data item (`ChartModule.getDataLinks`). A `null` chart, or no
 * suppliers, binds no listener.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/DataLinks/DataLinksContextMenu.tsx
 * https://echarts.apache.org/en/api.html#events.Mouse%20events
 */
export function useDataLinkClicks(
  chart: EChartsType | null,
  suppliers: DataLinkSupplier[] | undefined
): { menu: DataLinksMenuState | null; closeMenu: () => void } {
  const [menu, setMenu] = useState<DataLinksMenuState | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!chart || !suppliers) {
      return;
    }
    const onClick = (params: ECElementEvent) => {
      const links = linksOf(params, suppliers);
      const pointer = params.event?.event;
      if (links.length === 1) {
        openDataLink(links[0], pointer instanceof MouseEvent ? pointer : undefined);
      } else if (links.length > 1) {
        // The position of the `WithContextMenu` of core: the x of the page, and the y of the viewport.
        const position =
          pointer instanceof MouseEvent ? { x: pointer.pageX, y: pointer.pageY - window.scrollY } : { x: 0, y: 0 };
        setMenu({ ...position, links });
      }
    };
    // ZRender sets the cursor of the hovered element, which is `pointer`, before each of these events. A custom
    // series has no cursor option, so the hook sets the cursor of an item with a menu after ZRender does.
    let hovered: { dataIndex: number; cursor: string | undefined } | undefined;
    const onMouseMove = (params: ECElementEvent) => {
      if (hovered?.dataIndex !== params.dataIndex) {
        hovered = { dataIndex: params.dataIndex, cursor: getDataLinksCursor(linksOf(params, suppliers).length) };
      }
      if (hovered.cursor === 'context-menu') {
        chart.getZr().setCursorStyle(hovered.cursor);
      }
    };
    chart.on('click', onClick);
    chart.on('mousemove', onMouseMove);
    return () => {
      // A disposed chart has no listeners (see `useBrushTimeZoom`).
      if (!chart.isDisposed()) {
        chart.off('click', onClick);
        chart.off('mousemove', onMouseMove);
      }
    };
  }, [chart, suppliers]);

  return { menu, closeMenu };
}
