import { type EChartsOption } from 'echarts';
import { type EChartsType, init } from 'lib/echarts/echarts';
import { applyForceLayoutHoverFade } from 'lib/echarts/relations/forceHoverFade';

const graphOption = (layoutAnimation: boolean): EChartsOption => ({
  series: [
    {
      type: 'graph',
      layout: 'force',
      force: { layoutAnimation },
      emphasis: { focus: 'adjacency' },
      stateAnimation: { duration: 150, easing: 'cubicOut' },
      data: [{ name: 'a' }, { name: 'b' }],
      links: [{ source: 'a', target: 'b' }],
    },
  ],
});

/** The transitions of every mark that has a hover state. */
const transitions = (chart: EChartsType) => {
  const found: unknown[] = [];
  chart.getZr().storage.traverse((el) => {
    if (el.states?.emphasis != null) {
      found.push(el.stateTransition);
    }
  });
  return found;
};

describe('applyForceLayoutHoverFade', () => {
  let dom: HTMLDivElement;
  let chart: EChartsType;

  beforeEach(() => {
    dom = document.createElement('div');
    document.body.appendChild(dom);
    chart = init(dom, undefined, { renderer: 'canvas', width: 300, height: 200 });
  });

  afterEach(() => {
    chart.dispose();
    dom.remove();
  });

  it('sets the hover fade on every mark of an animated force layout', () => {
    const option = graphOption(true);
    chart.setOption(option);
    applyForceLayoutHoverFade(chart, option);

    const found = transitions(chart);
    expect(found.length).toBeGreaterThan(0);
    expect(found).toEqual(found.map(() => ({ duration: 150, easing: 'cubicOut' })));
  });

  it('leaves the marks alone when ECharts owns the fade', () => {
    const option = graphOption(false);
    chart.setOption({ ...option, animation: false });
    applyForceLayoutHoverFade(chart, option);

    expect(transitions(chart).every((transition) => transition == null)).toBe(true);
  });
});
