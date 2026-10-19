import { type DashboardPage, expect, test as base } from '@grafana/plugin-e2e';
import type { Locator, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import {
  COPY_GRID_POS,
  COPY_UID_SUFFIX_LENGTH,
  DRAG_STEPS,
  GRAPH_DRAG,
  MOUSE_PARK,
  NODE_INK,
  NODE_POLL_TIMEOUT_MS,
  PERSIST_DEBOUNCE_MS,
  RING_EMPTY_OFFSET,
  SANKEY_DRAG,
  SEED_RADIUS_TOLERANCE,
} from './relationsConstants';
import type {
  CopyArgs,
  DashboardJson,
  DragVector,
  InkThresholds,
  NodePoint,
  PanelFixture,
  PanelJson,
  SavedCopy,
  ScenarioArgs,
} from './relationsTypes';

/** Find a panel by its key. The `Panel header` element holds no canvas. */
export function panelContainer(page: Page, panelId: string): Locator {
  return page.locator(`[data-viz-panel-key="panel-${panelId}"]`);
}

export function panelCanvas(page: Page, panelId: string): Locator {
  return panelContainer(page, panelId).locator('canvas').first();
}

/** Find a button in the panel corner, for example "Zoom in". */
export function panelButton(page: Page, panelId: string, name: string): Locator {
  return panelContainer(page, panelId).getByRole('button', { name });
}

/**
 * Find the nodes by their ink. A node is a filled mark, so its centre has a fully opaque core
 * (`NODE_INK`). Edges, ribbons and label glyphs are thinner or translucent and have none.
 * The page cannot get the ECharts instance, so the canvas pixels are the only source.
 */
export async function findNodes(canvas: Locator): Promise<NodePoint[]> {
  return canvas.evaluate((element: HTMLCanvasElement, { coreRadiusPx: radius, opaqueAlpha }: InkThresholds) => {
    // RGBA: four bytes per pixel, and alpha is the last byte.
    const bytesPerPixel = 4;
    const alphaByte = 3;
    const { width, height } = element;
    const context = element.getContext('2d');
    if (context === null) {
      throw new Error('The panel canvas has no 2d context, so its nodes cannot be read');
    }
    const alpha = context.getImageData(0, 0, width, height).data;
    const core = new Uint8Array(width * height);
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let opaque = true;
        for (let dy = -radius; dy <= radius && opaque; dy++) {
          for (let dx = -radius; dx <= radius && opaque; dx++) {
            opaque = alpha[((y + dy) * width + x + dx) * bytesPerPixel + alphaByte] >= opaqueAlpha;
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
  }, NODE_INK);
}

/** Wait until the panel draws `count` nodes, then return them. */
export async function waitForNodes(canvas: Locator, count: number): Promise<NodePoint[]> {
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await findNodes(canvas)).length, { timeout: NODE_POLL_TIMEOUT_MS }).toBe(count);
  return findNodes(canvas);
}

/**
 * Press, move in `DRAG_STEPS` steps, and release. ECharts needs the steps to start a drag or a pan.
 * Then move the mouse off the panel. Otherwise the hover tooltip stays open, and on Grafana 13.3
 * it covers the Save button. Then fire the debounced write: see `flushPersist`.
 */
export async function dragBy(page: Page, from: NodePoint, { dx, dy }: DragVector): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= DRAG_STEPS; step++) {
    await page.mouse.move(from.x + (dx * step) / DRAG_STEPS, from.y + (dy * step) / DRAG_STEPS);
  }
  await page.mouse.up();
  await page.mouse.move(MOUSE_PARK.x, MOUSE_PARK.y);
  await flushPersist(page);
}

/**
 * Fire the debounced persistence write now. A sankey drag and a roam write after `PERSIST_DEBOUNCE_MS`.
 * The page clock is installed by the `page` fixture, so this moves page time forward and does not wait.
 * Clock API: https://playwright.dev/docs/clock
 */
export async function flushPersist(page: Page): Promise<void> {
  await page.clock.fastForward(PERSIST_DEBOUNCE_MS);
}

/**
 * Enter edit mode from view mode. The Save button shows only in edit mode.
 * Call it only in view mode: in edit mode the button with this test id is "Exit edit", and a click leaves edit mode.
 */
export async function enterEditMode(dashboard: DashboardPage): Promise<void> {
  const { editButton } = dashboard.ctx.selectors.components.NavToolbar.editDashboard;
  await dashboard.getByGrafanaSelector(editButton).click();
}

/**
 * Read the number on the "Changes" tab of the save drawer. The dashboard must be in edit mode.
 * The scene adds default options that the saved copy does not store, so the number is not zero
 * for an unchanged dashboard. Compare it with a count from the same page instead.
 */
export async function countUnsavedChanges(dashboard: DashboardPage): Promise<number> {
  const { selectors } = dashboard.ctx;
  await dashboard.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();
  const tab = dashboard.ctx.page.getByRole('dialog').getByRole('tab', { name: /Changes/ });
  const count = Number((await tab.innerText()).replace(/\D/g, ''));
  await dashboard.ctx.page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  return count;
}

/** Save the dashboard through the UI, and wait until the saved version changes. The dashboard must be in edit mode. */
export async function saveDashboard(dashboard: DashboardPage, copy: SavedCopy): Promise<void> {
  const { selectors } = dashboard.ctx;
  const before = await copy.readSavedVersion();
  await dashboard.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();
  await dashboard.getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton).click();
  await expect.poll(() => copy.readSavedVersion()).toBeGreaterThan(before);
}

/** Fail the test when `value` is undefined. The `asserts` return type narrows `value` for the code after the call. */
function expectDefined<T>(value: T | undefined, message: string): asserts value is T {
  expect(value, message).toBeDefined();
}

/**
 * Return the position overrides (`custom.fixedX` and `custom.fixedY`), by node name.
 * The panels under test have no other overrides, so every override must be a byName rule with exactly these two properties.
 */
export function positionOverrides(panel: PanelJson): Map<string, { x: unknown; y: unknown }> {
  const { fieldConfig } = panel;
  expectDefined(fieldConfig, 'the saved panel must have a fieldConfig');
  expectDefined(fieldConfig.overrides, 'the saved panel must have fieldConfig.overrides');
  return new Map(
    fieldConfig.overrides.map((override) => {
      expect(override.matcher.id).toBe('byName');
      expect(override.properties.map((property) => property.id).sort()).toEqual(['custom.fixedX', 'custom.fixedY']);
      const values = Object.fromEntries(override.properties.map((property) => [property.id, property.value]));
      return [String(override.matcher.options), { x: values['custom.fixedX'], y: values['custom.fixedY'] }];
    })
  );
}

/** The rows of the Overrides list in the panel editor. Grafana shows one "Fields with name" editor per byName rule. */
export function overrideRows(page: Page): Locator {
  return page.locator(
    '[data-testid^="data-testid panel-options-override-"][data-testid$="Fields with name field property editor"]'
  );
}

/**
 * A point inside a ring of four nodes that no node or edge covers. The fixtures draw a node at
 * each quarter turn, with edges along the sides and the diameters, so the point at
 * `RING_EMPTY_OFFSET` from the centre is clear. ECharts pans only inside the bounding box of the
 * nodes, so a pan must start there.
 */
export function emptyPointInRing(nodes: NodePoint[]): NodePoint {
  const x = nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length;
  const y = nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length;
  const radius = Math.max(...nodes.map((node) => Math.hypot(node.x - x, node.y - y)));
  return { x: x + RING_EMPTY_OFFSET.x * radius, y: y + RING_EMPTY_OFFSET.y * radius };
}

/** The node at the right edge of the ring. Its drag moves it away from every other node. */
export function rightmostNode(nodes: NodePoint[]): NodePoint {
  return nodes.reduce((right, node) => (node.x > right.x ? node : right));
}

/**
 * Drag one graph node and save. The saved JSON must have one position override per drawn node.
 * The fixtures give no coordinates, so the panel seeds every node on one ring. Thus all nodes
 * but the dragged one stay at one distance from the centre.
 */
export async function expectGraphDragPersists(
  { page, copyPanel, gotoDashboardPage }: ScenarioArgs,
  fixture: PanelFixture
): Promise<{ copy: SavedCopy; dashboard: DashboardPage }> {
  const copy = await copyPanel(fixture);
  const dashboard = await gotoDashboardPage({ uid: copy.uid });
  const nodes = await waitForNodes(panelCanvas(page, copy.panelId), fixture.nodes);
  expect(positionOverrides(await copy.readSavedPanel()).size).toBe(0);

  await dragBy(page, rightmostNode(nodes), GRAPH_DRAG);
  await enterEditMode(dashboard);
  await saveDashboard(dashboard, copy);

  const positions = positionOverrides(await copy.readSavedPanel());
  expect(positions.size).toBe(fixture.nodes);
  const distances = [...positions.values()].map(({ x, y }) => Math.hypot(Number(x), Number(y)));
  const seedRadius = [...distances].sort((a, b) => a - b)[Math.floor(distances.length / 2)];
  const moved = distances.filter((distance) => Math.abs(distance - seedRadius) > SEED_RADIUS_TOLERANCE * seedRadius);
  expect(moved, `distances from the centre: ${distances.join(', ')}`).toHaveLength(1);
  return { copy, dashboard };
}

/** Reload the page. The panel must draw `nodes` nodes from the saved dashboard. */
export async function expectDrawsAfterReload(page: Page, copy: SavedCopy, nodes: number): Promise<void> {
  await page.reload();
  await waitForNodes(panelCanvas(page, copy.panelId), nodes);
}

/**
 * Drag one sankey node, save, and reload. Only the dragged node gets an override. Its
 * `custom.fixedX` and `custom.fixedY` hold the `localX` and `localY` fraction of the drag.
 * After the reload, the panel must draw `nodesAfterReload` nodes. This number can be less than
 * `fixture.nodes`: if the dragged node touches the node below it, the two make one blob of ink.
 */
export async function expectSankeyDragPersists(
  { page, copyPanel, gotoDashboardPage }: ScenarioArgs,
  fixture: PanelFixture,
  nodesAfterReload: number
): Promise<void> {
  const copy = await copyPanel(fixture);
  const dashboard = await gotoDashboardPage({ uid: copy.uid });
  const nodes = await waitForNodes(panelCanvas(page, copy.panelId), fixture.nodes);

  // The leftmost node is a source column node, with room below it in the panel.
  const leftmost = nodes.reduce((left, node) => (node.x < left.x ? node : left));
  await dragBy(page, leftmost, SANKEY_DRAG);
  await enterEditMode(dashboard);
  await saveDashboard(dashboard, copy);

  const positions = [...positionOverrides(await copy.readSavedPanel()).values()];
  expect(positions).toHaveLength(1);
  for (const value of [positions[0].x, positions[0].y]) {
    expect(typeof value).toBe('number');
    expect(Number(value)).toBeGreaterThanOrEqual(0);
    expect(Number(value)).toBeLessThanOrEqual(1);
  }

  await page.reload();
  await waitForNodes(panelCanvas(page, copy.panelId), nodesAfterReload);
}

/** The node at the top of the ring. */
export function topmostNode(nodes: NodePoint[]): NodePoint {
  return nodes.reduce((top, node) => (node.y < top.y ? node : top));
}

/** Click a node to pin its tooltip, and return the tooltip. Only a pinned tooltip has the footer. */
export async function pinTooltip(page: Page, node: NodePoint): Promise<Locator> {
  await page.mouse.move(node.x, node.y);
  await page.mouse.click(node.x, node.y);
  const tooltip = page.locator('[data-echarts-tooltip]').first();
  await expect(tooltip).toBeVisible();
  return tooltip;
}

/** The ad hoc filters in the dashboard URL, as `key|operator|value`. Scenes writes them to `var-Filters`. */
export function urlFilters(page: Page): string[] {
  return new URL(page.url()).searchParams.getAll('var-Filters');
}

/** Open a copy of the panel, and wait until it draws `fixture.nodes` nodes. */
export async function expectPanelDraws(
  { page, copyPanel, gotoDashboardPage }: ScenarioArgs,
  fixture: PanelFixture
): Promise<void> {
  const copy = await copyPanel(fixture);
  await gotoDashboardPage({ uid: copy.uid });
  await waitForNodes(panelCanvas(page, copy.panelId), fixture.nodes);
}

/**
 * Grafana does not save a provisioned dashboard, so each test saves its own copy.
 * The copy holds one panel at full width, and the fixture deletes it after the test.
 * Dashboard HTTP API: https://grafana.com/docs/grafana/latest/developers/http_api/dashboard/
 */
export const test = base.extend<{ copyPanel: (args: CopyArgs) => Promise<SavedCopy> }>({
  // Install the clock before the first navigation, so that `flushPersist` controls the panel timers.
  page: async ({ page }, use) => {
    await page.clock.install();
    await use(page);
  },
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
      copy.gridPos = { ...COPY_GRID_POS };
      change?.(copy);

      const uid = `e2e-${randomUUID().slice(0, COPY_UID_SUFFIX_LENGTH)}`;
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
