import { normalizeCanvasEvents } from 'test/canvas';
import { height, width } from 'test/panel';
import { seedMathRandom } from 'test/random';
import { edgesFrame, nodesFrame } from 'test/relations';
import { renderRelations } from 'test/relationsCanvas';

import { type PanelOptions } from 'types';

// The force layout starts each node at a random point, so each test uses the same seed.
beforeEach(() => seedMathRandom());
afterEach(() => jest.restoreAllMocks());

const renderForce = (options: Partial<PanelOptions> = {}) =>
  renderRelations({ frames: [nodesFrame, edgesFrame], options: { relationsLayout: 'force', ...options } });

describe('relations force layout', () => {
  it('automatic force settings (four nodes spread by the simulation, not on a ring)', async () => {
    const { defaultEvents, seriesEvents } = await renderForce();

    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('repulsion 900 (the nodes pushed further apart than the automatic value)', async () => {
    const { defaultEvents, seriesEvents } = await renderForce({ relationsRepulsion: 900 });

    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('edge length 200 (longer links between the nodes)', async () => {
    const { defaultEvents, seriesEvents } = await renderForce({ relationsEdgeLength: 200 });

    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('gravity 1 (the nodes pulled close to the center)', async () => {
    const { defaultEvents, seriesEvents } = await renderForce({ relationsGravity: 1 });

    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });
});
