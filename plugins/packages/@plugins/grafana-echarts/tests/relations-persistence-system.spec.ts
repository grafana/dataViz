import {
  expectGraphDragPersists,
  expectSankeyDragPersists,
  GRAPH_EDGES_ONLY,
  GRAPH_REMEMBER_VIEW,
  hostRunsSystemTransformations,
  LEGACY_EDGES_ONLY,
  LEGACY_NODES_AND_EDGES,
  LEGACY_SANKEY,
  SANKEY,
  SYSTEM_TRANSFORMATIONS_FLAG,
  test,
} from './relationsFixtures';

// The system-transformations path: the host runs the transformations that the plugin registers.
// They convert row-based Node Graph frames and add a field for each node of an edges-only
// response, before the field overrides apply. The flag is forced on in the browser, so the
// tests run on every host that has the API. relations-persistence.spec.ts forces it off.
test.use({
  viewport: { width: 1600, height: 1200 },
  openFeature: { flags: { [SYSTEM_TRANSFORMATIONS_FLAG]: true } },
});

test.describe('relations persistence with system transformations', () => {
  test.beforeEach(async ({ page, getBooleanOpenFeatureFlag }) => {
    await page.goto('/');
    const { runs, reason } = await hostRunsSystemTransformations(page, getBooleanOpenFeatureFlag);
    test.skip(!runs, `system transformations do not run: ${reason}`);
  });

  for (const [name, fixture] of [
    ['wide frames', GRAPH_REMEMBER_VIEW],
    ['a wide edges-only response', GRAPH_EDGES_ONLY],
    ['row-based Node Graph frames', LEGACY_NODES_AND_EDGES],
    ['a row-based edges-only response', LEGACY_EDGES_ONLY],
  ] as const) {
    test(`graph drag, save and reload on ${name}`, async ({ page, copyPanel, gotoDashboardPage }) => {
      await expectGraphDragPersists({ page, copyPanel, gotoDashboardPage }, fixture);
    });
  }

  for (const [name, fixture] of [
    ['wide frames', SANKEY],
    ['row-based Node Graph frames', LEGACY_SANKEY],
  ] as const) {
    test(`sankey drag, save and reload on ${name}`, async ({ page, copyPanel, gotoDashboardPage }) => {
      await expectSankeyDragPersists({ page, copyPanel, gotoDashboardPage }, fixture);
    });
  }
});
