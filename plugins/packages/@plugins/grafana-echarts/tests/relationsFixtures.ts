import { type DashboardPage, expect, test as base } from '@grafana/plugin-e2e';
import type { Locator, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

/** One override rule of a panel's field config. */
export interface OverrideJson {
  matcher: { id: string; options?: unknown };
  properties: Array<{ id: string; value?: unknown }>;
}

/** One panel of a dashboard JSON. Only the keys that the tests read are typed. */
export interface PanelJson {
  id: number;
  options?: Record<string, unknown>;
  fieldConfig?: { defaults?: Record<string, unknown>; overrides?: OverrideJson[] };
  targets?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface DashboardJson {
  title?: string;
  version?: number;
  panels?: PanelJson[];
  [key: string]: unknown;
}

export interface CopyArgs {
  /** File name relative to `provisioning/dashboards/`. */
  fileName: string;
  /** Id of the panel to copy. The copy contains only this panel. */
  panelId: number;
  /** Changes the copied panel before the save, for an option that the provisioned panel does not set. */
  change?: (panel: PanelJson) => void;
}

/** A panel to copy, and the number of nodes that it draws. */
export interface PanelFixture extends CopyArgs {
  nodes: number;
}

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

/** A saved dashboard copy that a test can change, save and reload. */
export interface SavedCopy {
  uid: string;
  panelId: string;
  /** Reads the panel back from the saved dashboard JSON, not from the page. */
  readSavedPanel: () => Promise<PanelJson>;
  /** The version of the saved dashboard. A save through the UI increments it. */
  readSavedVersion: () => Promise<number>;
}

/** The centre of one node, in page pixels. */
export interface NodePoint {
  x: number;
  y: number;
}

/** Wait after a drag or a roam. The panel writes after `PERSIST_DEBOUNCE_MS` (400 ms) in useRelationsPersistence.ts. */
export const PERSIST_WAIT_MS = 1000;

/** The OpenFeature flag that turns on panel-registered (system) transformations in the host. */
export const SYSTEM_TRANSFORMATIONS_FLAG = 'grafana.panelPluginTransformations';

/** Find a panel by its key. The `Panel header` element holds no canvas. */
export function panelCanvas(page: Page, panelId: string): Locator {
  return page.locator(`[data-viz-panel-key="panel-${panelId}"] canvas`).first();
}

/** Find a button in the panel corner, for example "Zoom in". */
export function panelButton(page: Page, panelId: string, name: string): Locator {
  return page.locator(`[data-viz-panel-key="panel-${panelId}"]`).getByRole('button', { name });
}

/**
 * Find the nodes by their ink. A node is a filled mark, so its centre has a fully opaque
 * 7 x 7 px core. Edges, ribbons and label glyphs are thinner or translucent and have none.
 * The page cannot get the ECharts instance, so the canvas pixels are the only source.
 */
export async function findNodes(canvas: Locator): Promise<NodePoint[]> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const radius = 3;
    const { width, height } = element;
    const context = element.getContext('2d');
    if (context === null) {
      return [];
    }
    const alpha = context.getImageData(0, 0, width, height).data;
    const core = new Uint8Array(width * height);
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let opaque = true;
        for (let dy = -radius; dy <= radius && opaque; dy++) {
          for (let dx = -radius; dx <= radius && opaque; dx++) {
            opaque = alpha[((y + dy) * width + x + dx) * 4 + 3] >= 250;
          }
        }
        core[y * width + x] = opaque ? 1 : 0;
      }
    }

    // Join the core pixels into connected blobs. Each blob is one node.
    const seen = new Uint8Array(width * height);
    const rect = element.getBoundingClientRect();
    const scale = rect.width / width;
    const nodes: Array<{ x: number; y: number }> = [];
    for (let start = 0; start < core.length; start++) {
      if (core[start] === 0 || seen[start] === 1) {
        continue;
      }
      const stack = [start];
      seen[start] = 1;
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      while (stack.length > 0) {
        const index = stack.pop() ?? 0;
        sumX += index % width;
        sumY += Math.floor(index / width);
        count++;
        for (const next of [index - 1, index + 1, index - width, index + width]) {
          if (next >= 0 && next < core.length && core[next] === 1 && seen[next] === 0) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
      nodes.push({ x: rect.x + (sumX / count) * scale, y: rect.y + (sumY / count) * scale });
    }
    return nodes;
  });
}

/** Wait until the panel draws `count` nodes, then return them. */
export async function waitForNodes(canvas: Locator, count: number): Promise<NodePoint[]> {
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await findNodes(canvas)).length, { timeout: 15_000 }).toBe(count);
  return findNodes(canvas);
}

/**
 * Press, move in ten steps, and release. ECharts needs the steps to start a drag or a pan.
 * Then move the mouse off the panel. Otherwise the hover tooltip stays open, and on Grafana 13.3
 * it covers the Save button.
 */
export async function dragBy(page: Page, from: NodePoint, dx: number, dy: number): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(from.x + (dx * step) / 10, from.y + (dy * step) / 10);
  }
  await page.mouse.up();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(PERSIST_WAIT_MS);
}

/**
 * Enter edit mode if the dashboard is not in it already. The Save button shows only in edit mode.
 * Do not test the edit button instead: "Exit edit" has the same test id, and a click on it leaves edit mode.
 */
async function enterEditMode(dashboard: DashboardPage): Promise<void> {
  const { editButton, saveButton } = dashboard.ctx.selectors.components.NavToolbar.editDashboard;
  if (!(await dashboard.getByGrafanaSelector(saveButton).isVisible())) {
    await dashboard.getByGrafanaSelector(editButton).click();
  }
}

/**
 * Read the number on the "Changes" tab of the save drawer.
 * The scene adds default options that the saved copy does not store, so the number is not zero
 * for an unchanged dashboard. Compare it with a count from the same page instead.
 */
export async function countUnsavedChanges(dashboard: DashboardPage): Promise<number> {
  const { selectors } = dashboard.ctx;
  await enterEditMode(dashboard);
  await dashboard.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();
  const tab = dashboard.ctx.page.getByRole('dialog').getByRole('tab', { name: /Changes/ });
  const count = Number((await tab.innerText()).replace(/\D/g, ''));
  await dashboard.ctx.page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  return count;
}

/** Save the dashboard through the UI, and wait until the saved version changes. */
export async function saveDashboard(dashboard: DashboardPage, copy: SavedCopy): Promise<void> {
  const { selectors } = dashboard.ctx;
  const before = await copy.readSavedVersion();
  await enterEditMode(dashboard);
  await dashboard.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();
  await dashboard.getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton).click();
  await expect.poll(() => copy.readSavedVersion()).toBeGreaterThan(before);
}

/** Return the position overrides (`custom.fixedX` and `custom.fixedY`), by node name. */
export function positionOverrides(panel: PanelJson): Map<string, { x: unknown; y: unknown }> {
  const positions = new Map<string, { x: unknown; y: unknown }>();
  for (const override of panel.fieldConfig?.overrides ?? []) {
    const x = override.properties.find((property) => property.id === 'custom.fixedX');
    const y = override.properties.find((property) => property.id === 'custom.fixedY');
    if (override.matcher.id === 'byName' && x !== undefined && y !== undefined) {
      positions.set(String(override.matcher.options), { x: x.value, y: y.value });
    }
  }
  return positions;
}

/** The rows of the Overrides list in the panel editor. Grafana shows one "Fields with name" editor per byName rule. */
export function overrideRows(page: Page): Locator {
  return page.locator(
    '[data-testid^="data-testid panel-options-override-"][data-testid$="Fields with name field property editor"]'
  );
}

/**
 * A point inside a ring of four nodes that no node or edge covers. The fixtures draw a node at
 * each quarter turn, with edges along the sides and the diameters, so a point 0.3 radius left of
 * the centre and 0.2 radius below it is clear. ECharts pans only inside the bounding box of the
 * nodes, so a pan must start there.
 */
export function emptyPointInRing(nodes: NodePoint[]): NodePoint {
  const x = nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length;
  const y = nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length;
  const radius = Math.max(...nodes.map((node) => Math.hypot(node.x - x, node.y - y)));
  return { x: x - 0.3 * radius, y: y + 0.2 * radius };
}

/** The node at the right edge of the ring. Its drag moves it away from every other node. */
export function rightmostNode(nodes: NodePoint[]): NodePoint {
  return nodes.reduce((right, node) => (node.x > right.x ? node : right));
}

/** The test arguments that the scenarios use. */
export interface ScenarioArgs {
  page: Page;
  copyPanel: (args: CopyArgs) => Promise<SavedCopy>;
  gotoDashboardPage: (args: { uid: string }) => Promise<DashboardPage>;
}

/**
 * Drag one graph node, save, and reload. The saved JSON must have one position override per
 * drawn node. The fixtures give no coordinates, so the panel seeds every node on one ring. Thus
 * all nodes but the dragged one stay at one distance from the centre.
 */
export async function expectGraphDragPersists(
  { page, copyPanel, gotoDashboardPage }: ScenarioArgs,
  fixture: PanelFixture
): Promise<{ copy: SavedCopy; dashboard: DashboardPage }> {
  const copy = await copyPanel(fixture);
  const dashboard = await gotoDashboardPage({ uid: copy.uid });
  const nodes = await waitForNodes(panelCanvas(page, copy.panelId), fixture.nodes);
  expect(positionOverrides(await copy.readSavedPanel()).size).toBe(0);

  await dragBy(page, rightmostNode(nodes), -120, 80);
  await saveDashboard(dashboard, copy);

  const positions = positionOverrides(await copy.readSavedPanel());
  expect(positions.size).toBe(fixture.nodes);
  const distances = [...positions.values()].map(({ x, y }) => Math.hypot(Number(x), Number(y)));
  const seedRadius = [...distances].sort((a, b) => a - b)[Math.floor(distances.length / 2)];
  const moved = distances.filter((distance) => Math.abs(distance - seedRadius) > 1e-6 * seedRadius);
  expect(moved, `distances from the centre: ${distances.join(', ')}`).toHaveLength(1);

  await page.reload();
  await waitForNodes(panelCanvas(page, copy.panelId), fixture.nodes);
  return { copy, dashboard };
}

/**
 * Drag one sankey node, save, and reload. Only the dragged node gets an override. Its
 * `custom.fixedX` and `custom.fixedY` hold the `localX` and `localY` fraction of the drag.
 */
export async function expectSankeyDragPersists(
  { page, copyPanel, gotoDashboardPage }: ScenarioArgs,
  fixture: PanelFixture
): Promise<void> {
  const copy = await copyPanel(fixture);
  const dashboard = await gotoDashboardPage({ uid: copy.uid });
  const nodes = await waitForNodes(panelCanvas(page, copy.panelId), fixture.nodes);

  // The leftmost node is a source column node, with room below it in the panel.
  const leftmost = nodes.reduce((left, node) => (node.x < left.x ? node : left));
  await dragBy(page, leftmost, 0, 60);
  await saveDashboard(dashboard, copy);

  const positions = [...positionOverrides(await copy.readSavedPanel()).values()];
  expect(positions).toHaveLength(1);
  for (const value of [positions[0].x, positions[0].y]) {
    expect(typeof value).toBe('number');
    expect(Number(value)).toBeGreaterThanOrEqual(0);
    expect(Number(value)).toBeLessThanOrEqual(1);
  }

  // Do not count the nodes after the reload. The dragged node can touch the node below it, and
  // then the two nodes make one blob of ink.
  await page.reload();
  const canvas = panelCanvas(page, copy.panelId);
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await findNodes(canvas)).length, { timeout: 15_000 }).toBeGreaterThan(0);
}

/**
 * True when the host can run panel-registered transformations: it has the API and the flag is on.
 * The API comes from grafana/grafana#129992. `System.import` gives the host's own `@grafana/data`.
 */
export async function hostRunsSystemTransformations(
  page: Page,
  getBooleanOpenFeatureFlag: (flag: string) => Promise<boolean>
): Promise<{ runs: boolean; reason: string }> {
  const hasApi = await page.evaluate(async () => {
    const system: unknown = Reflect.get(window, 'System');
    if (typeof system !== 'object' || system === null) {
      return false;
    }
    const data: unknown = await Reflect.get(system, 'import').call(system, '@grafana/data');
    const panelPlugin: unknown =
      typeof data === 'object' && data !== null ? Reflect.get(data, 'PanelPlugin') : undefined;
    return typeof panelPlugin === 'function' && typeof panelPlugin.prototype.setSystemTransformations === 'function';
  });
  if (!hasApi) {
    return { runs: false, reason: 'the host has no PanelPlugin.setSystemTransformations (grafana/grafana#129992)' };
  }
  const flagOn = await getBooleanOpenFeatureFlag(SYSTEM_TRANSFORMATIONS_FLAG).catch(() => false);
  if (!flagOn) {
    return { runs: false, reason: `the host has the API, but ${SYSTEM_TRANSFORMATIONS_FLAG} is off` };
  }
  return { runs: true, reason: '' };
}

/**
 * Grafana does not save a provisioned dashboard, so each test saves its own copy.
 * The copy holds one panel at full width, and the fixture deletes it after the test.
 * Dashboard HTTP API: https://grafana.com/docs/grafana/latest/developers/http_api/dashboard/
 */
export const test = base.extend<{ copyPanel: (args: CopyArgs) => Promise<SavedCopy> }>({
  copyPanel: async ({ readProvisionedDashboard, page }, use) => {
    const created: string[] = [];

    const readSaved = async (uid: string): Promise<DashboardJson> => {
      const response = await page.request.get(`/api/dashboards/uid/${uid}`);
      expect(response.ok(), await response.text()).toBe(true);
      const body: { dashboard: DashboardJson } = await response.json();
      return body.dashboard;
    };

    await use(async ({ fileName, panelId, change }) => {
      // The fixture returns the parsed file, but its declared type has only `uid` and `title`.
      // A spread makes a type that the index signature of DashboardJson accepts.
      const source: DashboardJson = { ...(await readProvisionedDashboard({ fileName })) };
      const panel = source.panels?.find((candidate) => candidate.id === panelId);
      if (panel === undefined) {
        throw new Error(`${fileName} has no panel with id ${panelId}`);
      }

      const copy = structuredClone(panel);
      copy.gridPos = { x: 0, y: 0, w: 24, h: 16 };
      change?.(copy);

      const uid = `e2e-${randomUUID().slice(0, 8)}`;
      const { id: _id, version: _version, ...rest } = source;
      const dashboard = { ...rest, uid, title: `${source.title ?? fileName} (e2e ${uid})`, panels: [copy] };
      const response = await page.request.post('/api/dashboards/db', { data: { dashboard, overwrite: false } });
      expect(response.ok(), await response.text()).toBe(true);
      created.push(uid);

      return {
        uid,
        panelId: String(panelId),
        readSavedVersion: async () => (await readSaved(uid)).version ?? 0,
        readSavedPanel: async () => {
          const found = (await readSaved(uid)).panels?.find((candidate) => candidate.id === panelId);
          if (found === undefined) {
            throw new Error(`saved dashboard ${uid} has no panel with id ${panelId}`);
          }
          return found;
        },
      };
    });

    for (const uid of created) {
      await page.request.delete(`/api/dashboards/uid/${uid}`);
    }
  },
});

export { expect };
