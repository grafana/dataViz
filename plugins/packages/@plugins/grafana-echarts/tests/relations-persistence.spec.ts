import {
  fixedAndDraggable,
  GRAPH_EDGES_ONLY,
  GRAPH_REMEMBER_VIEW,
  PERSIST_WAIT_MS,
  SANKEY,
  SYSTEM_TRANSFORMATIONS_FLAG,
} from './relationsConstants';
import {
  countUnsavedChanges,
  dragBy,
  emptyPointInRing,
  expect,
  expectGraphDragPersists,
  expectSankeyDragPersists,
  findNodes,
  overrideRows,
  panelButton,
  panelCanvas,
  positionOverrides,
  rightmostNode,
  saveDashboard,
  test,
  waitForNodes,
} from './relationsFixtures';

// The compatibility path: the host runs no panel-registered transformations. The panel reads the
// wide frames itself, and finds the position of a node that has no field by its name.
// relations-persistence-system.spec.ts runs the same drags with the flag on.
test.use({
  viewport: { width: 1600, height: 1200 },
  openFeature: { flags: { [SYSTEM_TRANSFORMATIONS_FLAG]: false } },
});

test.describe('relations persistence', () => {
  test('graph drag, save and reload keeps every node position', async ({
    page,
    copyPanel,
    gotoDashboardPage,
    gotoPanelEditPage,
  }) => {
    const { copy } = await expectGraphDragPersists({ page, copyPanel, gotoDashboardPage }, GRAPH_REMEMBER_VIEW);

    await gotoPanelEditPage({ dashboard: { uid: copy.uid }, id: copy.panelId });
    await expect(overrideRows(page)).toHaveCount(GRAPH_REMEMBER_VIEW.nodes);
  });

  test('graph drag, save and reload on an edges-only response', async ({ page, copyPanel, gotoDashboardPage }) => {
    await expectGraphDragPersists({ page, copyPanel, gotoDashboardPage }, GRAPH_EDGES_ONLY);
  });

  test('sankey drag, save and reload keeps only the dragged node', async ({ page, copyPanel, gotoDashboardPage }) => {
    await expectSankeyDragPersists({ page, copyPanel, gotoDashboardPage }, SANKEY, SANKEY.nodes);
  });

  test('remember view on saves the zoom and the centre', async ({ page, copyPanel, gotoDashboardPage }) => {
    const copy = await copyPanel(GRAPH_REMEMBER_VIEW);
    const dashboard = await gotoDashboardPage({ uid: copy.uid });
    const nodes = await waitForNodes(panelCanvas(page, copy.panelId), GRAPH_REMEMBER_VIEW.nodes);

    // The mouse wheel does not zoom (roam is 'move' only), so the zoom uses the button. A zoom out
    // keeps every node on the canvas after the pan, so the reload can count them.
    await panelButton(page, copy.panelId, 'Zoom out').click();
    await page.waitForTimeout(PERSIST_WAIT_MS);
    await dragBy(page, emptyPointInRing(nodes), 60, 40);
    await saveDashboard(dashboard, copy);

    const { options } = await copy.readSavedPanel();
    expect(options?.relationsViewZoom).toBeLessThan(1);
    const center = options?.relationsViewCenter;
    expect(Array.isArray(center) && center.length === 2 && center.every(Number.isFinite), `center: ${center}`).toBe(
      true
    );

    await page.reload();
    await waitForNodes(panelCanvas(page, copy.panelId), GRAPH_REMEMBER_VIEW.nodes);
  });

  test('remember view off does not change the dashboard', async ({ page, copyPanel, gotoDashboardPage }) => {
    const copy = await copyPanel(GRAPH_EDGES_ONLY);
    const dashboard = await gotoDashboardPage({ uid: copy.uid });
    const canvas = panelCanvas(page, copy.panelId);
    const before = await waitForNodes(canvas, GRAPH_EDGES_ONLY.nodes);
    const changesBefore = await countUnsavedChanges(dashboard);
    const versionBefore = await copy.readSavedVersion();

    await panelButton(page, copy.panelId, 'Zoom out').click();
    await page.waitForTimeout(PERSIST_WAIT_MS);
    await dragBy(page, emptyPointInRing(before), 60, 40);

    // Without this check, the test also passes when the zoom and the pan do nothing.
    const after = await findNodes(canvas);
    expect(after).toHaveLength(GRAPH_EDGES_ONLY.nodes);
    expect(after, 'the zoom and the pan must move the nodes on the canvas').not.toEqual(before);

    expect(await countUnsavedChanges(dashboard)).toBe(changesBefore);

    page.on('dialog', (dialog) => dialog.accept());
    await page.reload();
    await waitForNodes(canvas, GRAPH_EDGES_ONLY.nodes);
    const saved = await copy.readSavedPanel();
    expect(saved.options).not.toHaveProperty('relationsViewZoom');
    expect(saved.options).not.toHaveProperty('relationsViewCenter');
    expect(await copy.readSavedVersion()).toBe(versionBefore);
  });

  test('removed position overrides stay removed after a save', async ({
    page,
    copyPanel,
    gotoDashboardPage,
    gotoPanelEditPage,
  }) => {
    const { copy, dashboard } = await expectGraphDragPersists(
      { page, copyPanel, gotoDashboardPage },
      GRAPH_REMEMBER_VIEW
    );

    await gotoPanelEditPage({ dashboard: { uid: copy.uid }, id: copy.panelId });
    const rows = overrideRows(page);
    await expect(rows).toHaveCount(GRAPH_REMEMBER_VIEW.nodes);
    const remove = page.getByRole('button', { name: 'Remove override' });
    while ((await remove.count()) > 0) {
      await remove.first().click();
    }
    await expect(rows).toHaveCount(0);
    await saveDashboard(dashboard, copy);

    const saved = await copy.readSavedPanel();
    expect(positionOverrides(saved).size).toBe(0);
    expect(JSON.stringify(saved.fieldConfig)).not.toMatch(/custom\.fixed[XY]/);
  });

  test('a drag on a 50-node graph writes one override per node', async ({
    page,
    copyPanel,
    gotoDashboardPage,
    gotoPanelEditPage,
  }, testInfo) => {
    const nodeCount = 50;
    const copy = await copyPanel({
      fileName: 'relations/performance-limits.json',
      panelId: 5,
      change: (panel) => {
        const target = panel.targets?.[0];
        if (target !== undefined) {
          target.nodes = { ...(target.nodes as object), count: nodeCount };
        }
        fixedAndDraggable(panel);
      },
    });
    const dashboard = await gotoDashboardPage({ uid: copy.uid });
    const nodes = await waitForNodes(panelCanvas(page, copy.panelId), nodeCount);

    await dragBy(page, rightmostNode(nodes), -60, 40);
    await saveDashboard(dashboard, copy);
    expect(positionOverrides(await copy.readSavedPanel()).size).toBe(nodeCount);

    // A finding, not a gate: record how the Overrides list copes with one rule per node.
    const start = Date.now();
    await gotoPanelEditPage({ dashboard: { uid: copy.uid }, id: copy.panelId });
    await expect(overrideRows(page)).toHaveCount(nodeCount);
    testInfo.annotations.push({
      type: 'finding',
      description: `The Overrides list showed ${nodeCount} rules ${Date.now() - start} ms after the panel editor opened.`,
    });
  });
});
