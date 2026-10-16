import type { PanelFixture, PanelJson } from './relationsTypes';

/** Set the fixed layout and turn on drag. Drag is an Advanced option, so the Advanced editor mode is also set. */
export function fixedAndDraggable(panel: PanelJson): void {
  panel.options = { ...panel.options, relationsLayout: 'none', relationsDraggable: true, editorMode: 'advanced' };
}

/** Graph, node frame and edge frame (wide), drag and remember view on. */
export const GRAPH_REMEMBER_VIEW: PanelFixture = { fileName: 'relations/fixed-layout.json', panelId: 6, nodes: 4 };

/** Graph, one wide edge frame and no node frame. Zoom and pan are on, remember view is off. */
export const GRAPH_EDGES_ONLY: PanelFixture = {
  fileName: 'relations/fixed-layout.json',
  panelId: 2,
  nodes: 4,
  change: (panel) => {
    panel.options = { ...panel.options, relationsZoom: true, relationsPan: true };
  },
};

/** Sankey with drag on. */
export const SANKEY: PanelFixture = { fileName: 'relations/all-options.json', panelId: 33, nodes: 5 };

/** Row-based Node Graph frames (a nodes frame and an edges frame). Only a system transformation converts them. */
export const LEGACY_NODES_AND_EDGES: PanelFixture = {
  fileName: 'relations/node-graph-testdata.json',
  panelId: 6,
  nodes: 17,
  change: fixedAndDraggable,
};

/** A row-based Node Graph edges frame, and no nodes frame. */
export const LEGACY_EDGES_ONLY: PanelFixture = {
  fileName: 'relations/node-graph-testdata.json',
  panelId: 9,
  nodes: 8,
  change: fixedAndDraggable,
};

/** The row-based Node Graph frames, drawn as a sankey. */
export const LEGACY_SANKEY: PanelFixture = {
  ...LEGACY_NODES_AND_EDGES,
  change: (panel) => {
    fixedAndDraggable(panel);
    panel.options = { ...panel.options, seriesType: 'sankey' };
  },
};

/** Wait after a drag or a roam. The panel writes after `PERSIST_DEBOUNCE_MS` (400 ms) in useRelationsPersistence.ts. */
export const PERSIST_WAIT_MS = 1000;

/** The OpenFeature flag that turns on panel-registered (system) transformations in the host. */
export const SYSTEM_TRANSFORMATIONS_FLAG = 'grafana.panelPluginTransformations';
