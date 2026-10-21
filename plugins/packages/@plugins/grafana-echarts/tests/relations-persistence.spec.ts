import {
  GRAPH_EDGES_ONLY,
  GRAPH_REMEMBER_VIEW,
  LARGE_GRAPH,
  LARGE_GRAPH_DRAG,
  MATRIX_AFTER_CONVERSION,
  MISSING_EDGES_MESSAGE,
  PAN_DRAG,
  SANKEY,
  SYSTEM_TRANSFORMATIONS_FLAG,
  TEST_VIEWPORT,
  TRANSFORMED_PANELS,
  UNZOOMED,
  FILTER_FOR_BUTTON,
  FILTER_OUT_BUTTON,
  TOOLTIP_ACTIONS,
  TOOLTIP_LINK,
  TOOLTIP_LINK_ONLY,
  TOOLTIP_NODE,
} from './relationsConstants';
import {
  countUnsavedChanges,
  enterEditMode,
  flushPersist,
  dragBy,
  emptyPointInRing,
  expect,
  expectDrawsAfterReload,
  expectGraphDragPersists,
  expectPanelDraws,
  expectSankeyDragPersists,
  findNodes,
  overrideRows,
  panelButton,
  panelCanvas,
  panelContainer,
  pinTooltip,
  positionOverrides,
  rightmostNode,
  saveDashboard,
  test,
  topmostNode,
  urlFilters,
  waitForNodes,
} from './relationsFixtures';

// The compatibility path: the host runs no panel-registered transformations. The panel reads the
// wide frames itself, and finds the position of a node that has no field by its name.
// relations-persistence-system.spec.ts runs the drags on the fixtures that the flag changes.
test.use({
  viewport: TEST_VIEWPORT,
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
    const { copy } = await expectGraphDragPersists({ page, copyPanel, gotoDashboardPage }, GRAPH_EDGES_ONLY);
    await expectDrawsAfterReload(page, copy, GRAPH_EDGES_ONLY.nodes);
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
    await flushPersist(page);
    await dragBy(page, emptyPointInRing(nodes), PAN_DRAG);
    await enterEditMode(dashboard);
    await saveDashboard(dashboard, copy);

    const { options } = await copy.readSavedPanel();
    expect(options?.relationsViewZoom).toBeLessThan(UNZOOMED);
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
    await enterEditMode(dashboard);
    const changesBefore = await countUnsavedChanges(dashboard);
    const versionBefore = await copy.readSavedVersion();

    await panelButton(page, copy.panelId, 'Zoom out').click();
    await flushPersist(page);
    await dragBy(page, emptyPointInRing(before), PAN_DRAG);

    // Without this check, the test also passes when the zoom and the pan do nothing.
    const after = await findNodes(canvas);
    expect(after).toHaveLength(GRAPH_EDGES_ONLY.nodes);
    expect(after, 'the zoom and the pan must move the nodes on the canvas').not.toEqual(before);

    expect(await countUnsavedChanges(dashboard)).toBe(changesBefore);

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
    // Grafana leaves out `overrides` when the list is empty.
    expect(saved.fieldConfig).not.toHaveProperty('overrides');
    expect(JSON.stringify(saved.fieldConfig)).not.toMatch(/custom\.fixed[XY]/);
  });

  test(`a drag on a ${LARGE_GRAPH.nodes}-node graph writes one override per node`, async ({
    page,
    copyPanel,
    gotoDashboardPage,
    gotoPanelEditPage,
  }, testInfo) => {
    const copy = await copyPanel(LARGE_GRAPH);
    const dashboard = await gotoDashboardPage({ uid: copy.uid });
    const nodes = await waitForNodes(panelCanvas(page, copy.panelId), LARGE_GRAPH.nodes);

    await dragBy(page, rightmostNode(nodes), LARGE_GRAPH_DRAG);
    await enterEditMode(dashboard);
    await saveDashboard(dashboard, copy);
    expect(positionOverrides(await copy.readSavedPanel()).size).toBe(LARGE_GRAPH.nodes);

    // A finding, not a gate: record how the Overrides list copes with one rule per node.
    const start = Date.now();
    await gotoPanelEditPage({ dashboard: { uid: copy.uid }, id: copy.panelId });
    await expect(overrideRows(page)).toHaveCount(LARGE_GRAPH.nodes);
    testInfo.annotations.push({
      type: 'finding',
      description: `The Overrides list showed ${LARGE_GRAPH.nodes} rules ${Date.now() - start} ms after the panel editor opened.`,
    });
  });
});

test.describe('relations with dashboard transformations', () => {
  for (const { name, fixture } of TRANSFORMED_PANELS) {
    test(`draws after ${name}`, async ({ page, copyPanel, gotoDashboardPage }) => {
      await expectPanelDraws({ page, copyPanel, gotoDashboardPage }, fixture);
    });
  }

  test('grouping to matrix on row-format data shows the missing edges message', async ({
    page,
    copyPanel,
    gotoDashboardPage,
  }) => {
    const copy = await copyPanel(MATRIX_AFTER_CONVERSION);
    await gotoDashboardPage({ uid: copy.uid });
    await expect(panelContainer(page, copy.panelId)).toContainText(MISSING_EDGES_MESSAGE);
  });
});

test.describe('relations tooltip actions', () => {
  test('filter for adds an equal ad hoc filter for the node', async ({ page, copyPanel, gotoDashboardPage }) => {
    const copy = await copyPanel(TOOLTIP_ACTIONS);
    await gotoDashboardPage({ uid: copy.uid });
    const nodes = await waitForNodes(panelCanvas(page, copy.panelId), GRAPH_REMEMBER_VIEW.nodes);
    const tooltip = await pinTooltip(page, topmostNode(nodes));
    await expect(tooltip).toContainText(TOOLTIP_NODE);

    await tooltip.getByRole('button', { name: FILTER_FOR_BUTTON }).click();
    // The node is only ever an edge target in this fixture, so the filter key is `target`.
    await expect.poll(() => urlFilters(page)).toEqual([`target|=|${TOOLTIP_NODE}`]);
  });

  test('filter out adds a not-equal ad hoc filter for the node', async ({ page, copyPanel, gotoDashboardPage }) => {
    const copy = await copyPanel(TOOLTIP_ACTIONS);
    await gotoDashboardPage({ uid: copy.uid });
    const nodes = await waitForNodes(panelCanvas(page, copy.panelId), GRAPH_REMEMBER_VIEW.nodes);
    const tooltip = await pinTooltip(page, topmostNode(nodes));

    await tooltip.getByRole('button', { name: FILTER_OUT_BUTTON }).click();
    await expect.poll(() => urlFilters(page)).toEqual([`target|!=|${TOOLTIP_NODE}`]);
  });

  test('a field that is not filterable offers no ad hoc filter', async ({ page, copyPanel, gotoDashboardPage }) => {
    const copy = await copyPanel(TOOLTIP_LINK_ONLY);
    await gotoDashboardPage({ uid: copy.uid });
    const nodes = await waitForNodes(panelCanvas(page, copy.panelId), GRAPH_REMEMBER_VIEW.nodes);
    const tooltip = await pinTooltip(page, topmostNode(nodes));
    // The link shows that the footer rendered, so the missing buttons are not a missing footer.
    await expect(tooltip.getByRole('link', { name: TOOLTIP_LINK.title })).toBeVisible();

    await expect(tooltip.getByRole('button', { name: FILTER_FOR_BUTTON })).toHaveCount(0);
    await expect(tooltip.getByRole('button', { name: FILTER_OUT_BUTTON })).toHaveCount(0);
  });

  test('a data link on the node fills in its field name and opens in a new tab', async ({
    page,
    copyPanel,
    gotoDashboardPage,
  }) => {
    const copy = await copyPanel(TOOLTIP_ACTIONS);
    await gotoDashboardPage({ uid: copy.uid });
    const nodes = await waitForNodes(panelCanvas(page, copy.panelId), GRAPH_REMEMBER_VIEW.nodes);
    const tooltip = await pinTooltip(page, topmostNode(nodes));

    // Read the href, and do not click: the link goes to a page outside Grafana.
    const link = tooltip.getByRole('link', { name: TOOLTIP_LINK.title });
    await expect(link).toHaveAttribute('href', TOOLTIP_LINK.href);
    // Grafana sets the target from `targetBlank`. The plugin passes the link through unchanged.
    await expect(link).toHaveAttribute('target', '_blank');
  });
});
