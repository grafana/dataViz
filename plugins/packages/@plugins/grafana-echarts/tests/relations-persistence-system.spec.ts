import { satisfies } from '@grafana/plugin-e2e';

import {
  GRAPH_EDGES_ONLY,
  LEGACY_EDGES_ONLY,
  LEGACY_NODES_AND_EDGES,
  LEGACY_SANKEY,
  LEGACY_SANKEY_NODES_AFTER_DRAG,
  MATRIX_AFTER_CONVERSION,
  SYSTEM_TRANSFORMATIONS_FLAG,
  SYSTEM_TRANSFORMATIONS_GRAFANA,
  TEST_VIEWPORT,
  TRANSFORMED_PANELS,
} from './relationsConstants';
import {
  expectDrawsAfterReload,
  expectGraphDragPersists,
  expectPanelDraws,
  expectSankeyDragPersists,
  test,
} from './relationsFixtures';

// The system-transformations path: the host runs the transformations that the plugin registers.
// They convert row-based Node Graph frames and add a field for each node of an edges-only
// response, before the field overrides apply. The flag is forced on in the browser, so the
// tests run on every Grafana version that has the API. relations-persistence.spec.ts forces it off.
// Only fixtures that a system transformation changes run here: edges-only responses (derived nodes)
// and row-based Node Graph frames (converted to wide). A wide frame with every node passes through
// unchanged, so its drags run only in relations-persistence.spec.ts.
test.use({
  viewport: TEST_VIEWPORT,
  openFeature: { flags: { [SYSTEM_TRANSFORMATIONS_FLAG]: true } },
});

test.describe('relations persistence with system transformations', () => {
  test.skip(
    ({ grafanaVersion }) => !satisfies(grafanaVersion, SYSTEM_TRANSFORMATIONS_GRAFANA),
    `Grafana ${SYSTEM_TRANSFORMATIONS_GRAFANA} has PanelPlugin.setSystemTransformations. Older versions do not.`
  );

  for (const [name, fixture] of [
    ['a wide edges-only response', GRAPH_EDGES_ONLY],
    ['row-based Node Graph frames', LEGACY_NODES_AND_EDGES],
    ['a row-based edges-only response', LEGACY_EDGES_ONLY],
  ] as const) {
    test(`graph drag, save and reload on ${name}`, async ({ page, copyPanel, gotoDashboardPage }) => {
      const { copy } = await expectGraphDragPersists({ page, copyPanel, gotoDashboardPage }, fixture);
      await expectDrawsAfterReload(page, copy, fixture.nodes);
    });
  }

  test('sankey drag, save and reload on row-based Node Graph frames', async ({
    page,
    copyPanel,
    gotoDashboardPage,
  }) => {
    await expectSankeyDragPersists(
      { page, copyPanel, gotoDashboardPage },
      LEGACY_SANKEY,
      LEGACY_SANKEY_NODES_AFTER_DRAG
    );
  });

  for (const { name, fixture } of TRANSFORMED_PANELS) {
    test(`draws after ${name}`, async ({ page, copyPanel, gotoDashboardPage }) => {
      await expectPanelDraws({ page, copyPanel, gotoDashboardPage }, fixture);
    });
  }

  test('grouping to matrix on row-format data draws the converted edges', async ({
    page,
    copyPanel,
    gotoDashboardPage,
  }) => {
    await expectPanelDraws({ page, copyPanel, gotoDashboardPage }, MATRIX_AFTER_CONVERSION);
  });
});
