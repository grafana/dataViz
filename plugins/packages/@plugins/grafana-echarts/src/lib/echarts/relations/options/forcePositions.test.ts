import { type GraphSeriesOption } from 'echarts';
import { prepareForceStart } from './forcePositions';

const force = { repulsion: 200, edgeLength: 60, gravity: 0.2, friction: 0.2 };

const links = [{ source: 'a', target: 'b' }];
const linkKeys = new Set(['a>b']);

function forceOption(ids: string[]): { series: GraphSeriesOption[] } {
  return {
    series: [
      { type: 'graph', layout: 'force', force: { ...force }, data: ids.map((id) => ({ id })), links: [...links] },
    ],
  };
}

const placed = (ids: string[]) => new Map(ids.map((id): [string, [number, number]] => [id, [0, 0]]));

describe('prepareForceStart', () => {
  it('starts with no friction when the nodes, links and force settings are the same', () => {
    const option = forceOption(['a', 'b']);
    expect(prepareForceStart(option, { positions: placed(['a', 'b']), force, links: linkKeys })).toBe(true);
    expect(option.series[0].force?.friction).toBe(0);
  });

  it('starts with a low friction when only the links changed', () => {
    const option = forceOption(['a', 'b']);
    const changed = new Set(['b>a']);
    expect(prepareForceStart(option, { positions: placed(['a', 'b']), force, links: changed })).toBe(true);
    expect(option.series[0].force?.friction).toBe(0.012);
  });

  it('keeps the friction when a node is new', () => {
    const option = forceOption(['a', 'b', 'new']);
    expect(prepareForceStart(option, { positions: placed(['a', 'b']), force })).toBe(true);
    expect(option.series[0].force?.friction).toBe(0.2);
  });

  it('keeps the friction when a force setting changed', () => {
    const option = forceOption(['a', 'b']);
    expect(prepareForceStart(option, { positions: placed(['a', 'b']), force: { ...force, repulsion: 999 } })).toBe(
      true
    );
    expect(option.series[0].force?.friction).toBe(0.2);
  });

  it('starts a preview with no friction when only its automatic force settings changed', () => {
    const option = forceOption(['a', 'b']);
    const resized = { ...force, repulsion: 999 };
    expect(
      prepareForceStart(option, { positions: placed(['a', 'b']), force: resized, links: linkKeys }, { isPreview: true })
    ).toBe(true);
    expect(option.series[0].force?.friction).toBe(0);
  });

  it('does not keep a layout without positions or for another layout', () => {
    expect(prepareForceStart(forceOption(['a']), { positions: new Map(), force })).toBe(false);
    const circular = forceOption(['a']);
    circular.series[0].layout = 'circular';
    expect(prepareForceStart(circular, { positions: placed(['a']), force })).toBe(false);
  });
});
