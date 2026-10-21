import { normalizeCanvasEvents } from 'test/canvas';
import { seedMathRandom } from 'test/random';
import { edgesFrame, nodesFrame } from 'test/relations';
import { renderRelations } from 'test/relationsCanvas';

import { type PanelOptions } from 'types';

afterEach(() => jest.restoreAllMocks());

/** Draw the force graph of `force.canvas.test.tsx` with one seed. */
const drawForce = async (seed: number, options: Partial<PanelOptions> = {}) => {
  seedMathRandom(seed);
  const { seriesEvents } = await renderRelations({
    frames: [nodesFrame, edgesFrame],
    options: { relationsLayout: 'force', ...options },
  });
  jest.restoreAllMocks();
  return JSON.stringify(normalizeCanvasEvents(seriesEvents));
};

// The force canvas baselines are stable only if one seed always gives one picture.
describe('relations force layout with a seeded random generator', () => {
  it('draws the same picture twice for one seed', async () => {
    expect(await drawForce(1)).toEqual(await drawForce(1));
  });

  it('draws a different picture for each force setting', async () => {
    const base = await drawForce(1);
    for (const options of [{ relationsRepulsion: 900 }, { relationsEdgeLength: 200 }, { relationsGravity: 1 }]) {
      expect(await drawForce(1, options)).not.toEqual(base);
    }
  });
});
