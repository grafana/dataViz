import { ContextMenu, linkModelToContextMenuItems, MenuGroup, MenuItem } from '@grafana/ui';
import React from 'react';
import { type DataLinksMenuState } from './hooks/useDataLinkClicks';

interface Props {
  menu: DataLinksMenuState;
  onClose: () => void;
}

/**
 * The menu of a value with more than one data link: the group "Data links" with one item for each link, as the
 * `DataLinksContextMenu` of core. The label is a plain string in core too.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/DataLinks/DataLinksContextMenu.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/overlays-contextmenu--docs
 */
export const DataLinksMenu: React.FC<Props> = ({ menu, onClose }) => {
  const renderItems = () => (
    <MenuGroup label="Data links">
      {linkModelToContextMenuItems(() => menu.links).map((item, index) => (
        <MenuItem
          key={index}
          url={item.url}
          label={item.label}
          target={item.target}
          icon={item.icon}
          onClick={item.onClick}
        />
      ))}
    </MenuGroup>
  );
  return <ContextMenu x={menu.x} y={menu.y} onClose={onClose} renderMenuItems={renderItems} focusOnOpen />;
};
