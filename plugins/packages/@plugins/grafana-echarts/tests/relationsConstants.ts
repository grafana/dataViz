import type { DragVector, InkThresholds, PanelFixture, PanelJson } from './relationsTypes';

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

// The dragged node touches the node below it, so the reload draws one blob of ink less.
export const LEGACY_SANKEY_NODES_AFTER_DRAG = LEGACY_SANKEY.nodes - 1;

/** A fixed graph with 50 random nodes and drag on, to count the overrides of a large topology. */
export const LARGE_GRAPH: PanelFixture = {
  fileName: 'relations/performance-limits.json',
  panelId: 5,
  nodes: 50,
  change: (panel) => {
    const target = panel.targets?.[0];
    if (target !== undefined) {
      target.nodes = { ...(target.nodes as object), count: LARGE_GRAPH.nodes };
    }
    fixedAndDraggable(panel);
  },
};

/**
 * Panels whose dashboard transformations run after the registered ones. Each one draws the
 * same graph on both paths. A wrong order of the two chains makes a panel draw nothing.
 */
export const TRANSFORMED_PANELS: Array<{ name: string; fixture: PanelFixture }> = [
  {
    name: 'organize renames client and server to source and target, then rows to fields',
    fixture: { fileName: 'relations/observability-sources.json', panelId: 6, nodes: 9 },
  },
  {
    name: 'two joins by field on time series edges',
    fixture: { fileName: 'relations/observability-sources.json', panelId: 3, nodes: 9 },
  },
  {
    name: 'convert, organize, and rows to fields twice',
    fixture: { fileName: 'relations/observability-sources.json', panelId: 13, nodes: 8 },
  },
  {
    name: 'one join by field on ranged edges',
    fixture: { fileName: 'relations/graph-wide.json', panelId: 18, nodes: 4 },
  },
  {
    name: 'convert, then rows to fields',
    fixture: { fileName: 'relations/presets.json', panelId: 1, nodes: 5 },
  },
];

/**
 * Row-format data with a grouping-to-matrix transformation. A system transformation converts the
 * rows first, so the matrix transformation finds no columns and the panel draws the converted
 * edges. Without system transformations, the matrix output has no edges.
 */
export const MATRIX_AFTER_CONVERSION: PanelFixture = { fileName: 'relations/graph-wide.json', panelId: 17, nodes: 3 };

export const MISSING_EDGES_MESSAGE = 'Graph data is missing edges.';

// The node that the tooltip tests pin. The seed ring puts it at the top.
export const TOOLTIP_NODE = 'db';

export const TOOLTIP_LINK = {
  title: 'Database runbook',
  url: 'https://example.com/runbook?node=${__field.name}',
  // The URL after Grafana fills in `${__field.name}`.
  href: `https://example.com/runbook?node=${TOOLTIP_NODE}`,
};

/**
 * `GRAPH_REMEMBER_VIEW` with every field filterable, so the tooltip offers ad hoc filters, and a
 * data link on `TOOLTIP_NODE` that opens in a new tab.
 */
export const TOOLTIP_ACTIONS: PanelFixture = {
  ...GRAPH_REMEMBER_VIEW,
  change: (panel) => {
    panel.fieldConfig = {
      ...panel.fieldConfig,
      defaults: { ...panel.fieldConfig?.defaults, filterable: true },
      overrides: [
        {
          matcher: { id: 'byName', options: TOOLTIP_NODE },
          properties: [
            { id: 'links', value: [{ title: TOOLTIP_LINK.title, url: TOOLTIP_LINK.url, targetBlank: true }] },
          ],
        },
      ],
    };
  },
};

/** `TOOLTIP_ACTIONS` without `filterable`. The footer still shows, for the data link. */
export const TOOLTIP_LINK_ONLY: PanelFixture = {
  ...TOOLTIP_ACTIONS,
  change: (panel) => {
    TOOLTIP_ACTIONS.change?.(panel);
    panel.fieldConfig = { ...panel.fieldConfig, defaults: { ...panel.fieldConfig?.defaults, filterable: false } };
  },
};

// The labels of the grouped filter buttons in the footer of the pinned tooltip (`VizTooltipFooter`).
export const FILTER_FOR_BUTTON = 'Filter on this value';
export const FILTER_OUT_BUTTON = 'Filter out this value';

/** The debounce of a sankey drag or a roam write. Same value as `PERSIST_DEBOUNCE_MS` in useRelationsPersistence.ts. */
export const PERSIST_DEBOUNCE_MS = 400;

/** The OpenFeature flag that turns on panel-registered (system) transformations in the host. */
export const SYSTEM_TRANSFORMATIONS_FLAG = 'grafana.panelPluginTransformations';

/**
 * The Grafana versions that have `PanelPlugin.setSystemTransformations` (grafana/grafana#132104).
 * It is on main since 13.3.0-pre. The `-0` lets the range match pre-release builds such as nightly.
 */
export const SYSTEM_TRANSFORMATIONS_GRAFANA = '>=13.3.0-0';

// Tall enough that the 16-row panel copy fits without a scroll.
export const TEST_VIEWPORT = { width: 1600, height: 1200 };

// The copy is the only panel on its dashboard: full width (24 columns) and 16 rows tall.
export const COPY_GRID_POS = { x: 0, y: 0, w: 24, h: 16 };

export const COPY_UID_SUFFIX_LENGTH = 8;

export const NODE_POLL_TIMEOUT_MS = 15_000;

// ECharts starts a drag or a pan only after intermediate mouse moves.
export const DRAG_STEPS = 10;

// A point off every panel, so that no hover tooltip stays open.
export const MOUSE_PARK: { x: number; y: number } = { x: 0, y: 0 };

// A node has a fully opaque core of (2 x 3 + 1) = 7 x 7 px. Edges, ribbons and labels have none.
export const NODE_INK: InkThresholds = { coreRadiusPx: 3, opaqueAlpha: 250 };

// From the ring centre, in ring radii. The fixtures draw no node or edge there.
export const RING_EMPTY_OFFSET = { x: -0.3, y: 0.2 };

// Relative to the seed radius. Seed positions differ from it only by float rounding.
export const SEED_RADIUS_TOLERANCE = 1e-6;

// The zoom of a view that nobody zoomed.
export const UNZOOMED = 1;

// Inward from the rightmost ring node, away from every other node.
export const GRAPH_DRAG: DragVector = { dx: -120, dy: 80 };

// A shorter inward drag, because the 50 ring nodes are closer together.
export const LARGE_GRAPH_DRAG: DragVector = { dx: -60, dy: 40 };

// Down from the leftmost sankey node, into the space below it.
export const SANKEY_DRAG: DragVector = { dx: 0, dy: 60 };

export const PAN_DRAG: DragVector = { dx: 60, dy: 40 };
