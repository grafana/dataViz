import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { edgesFrame, nodesFrame } from 'test/relations';
import { hoverGraphNode, renderRelations } from 'test/relationsCanvas';

import { type PanelOptions } from 'types';

/** The `globalAlpha` values below 1 that the series layer drew. ECharts fades a blurred mark with opacity. */
const fadedAlphas = (events: CanvasRenderingContext2DEvent[]) =>
  events
    .filter((event) => event.type === 'globalAlpha')
    .map((event) => Number(event.props.value))
    .filter((alpha) => alpha < 1);

const draw = async (options: Partial<PanelOptions> = {}, hover = true) => {
  const { seriesEvents } = await renderRelations({
    frames: [nodesFrame, edgesFrame],
    options,
    beforeCapture: hover ? (chart) => hoverGraphNode(chart, 0) : undefined,
  });
  return seriesEvents;
};

// The graph canvas suite pins these hovers. These tests make sure that the pointer reached a node.
describe('relations focus adjacency on a real hover', () => {
  // The links draw with opacity 0.5 without a hover, so the tests count the faded draws against that.
  it('fades the marks that are not next to the hovered node', async () => {
    const idle = fadedAlphas(await draw({}, false));
    expect(fadedAlphas(await draw()).length).toBeGreaterThan(idle.length);
  });

  it('fades no more marks than without a hover when focus adjacency is off', async () => {
    const options = { relationsFocusAdjacency: false };
    expect(fadedAlphas(await draw(options))).toEqual(fadedAlphas(await draw(options, false)));
  });
});
