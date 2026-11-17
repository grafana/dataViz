import { gaugeFrame, renderGauge } from 'test/gaugeCanvas';

// Gauge renders that compare the drawn primitives of two renders. The baselines are in `gauge.canvas.test.tsx`.

type CanvasEvents = Awaited<ReturnType<typeof renderGauge>>['seriesEvents'];

/** The texts that the canvas drew, in draw order. */
const drawnTexts = (events: CanvasEvents) =>
  events.filter((event) => event.type === 'fillText').map((event) => String(event.props.text));

/** The number of shapes that the canvas filled or stroked. */
const drawnShapes = (events: CanvasEvents) =>
  events.filter((event) => event.type === 'fill' || event.type === 'stroke').length;

const oneValue = () => [gaugeFrame({ cpu: [10, 40, 72] })];

describe('gauge renders', () => {
  it('draws the value of one gauge and no name', async () => {
    const { seriesEvents } = await renderGauge(oneValue());
    expect(drawnTexts(seriesEvents)).toEqual(['72']);
  });

  it('draws the value and the name of each gauge when the panel has many values', async () => {
    const { seriesEvents } = await renderGauge([gaugeFrame({ cpu: [72], memory: [35] })]);
    expect(drawnTexts(seriesEvents).sort()).toEqual(['35', '72', 'cpu', 'memory']);
  });

  it.each([
    ['value_and_name', ['72', 'cpu']],
    ['name', ['cpu']],
    ['none', []],
  ] as const)('draws the texts of text mode %s', async (textMode, texts) => {
    const { seriesEvents } = await renderGauge(oneValue(), { textMode });
    expect(drawnTexts(seriesEvents).sort()).toEqual([...texts].sort());
  });

  it('draws fewer shapes with no threshold band', async () => {
    const withBand = await renderGauge(oneValue());
    const noBand = await renderGauge(oneValue(), { showThresholdMarkers: false });
    expect(drawnShapes(noBand.seriesEvents)).toBeLessThan(drawnShapes(withBand.seriesEvents));
  });
});
