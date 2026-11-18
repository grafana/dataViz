import { type FlowInput, type FlowItem, layoutFlow } from './flow';

const box = { x: 10, y: 20, width: 200, height: 100 };
const item = (width: number | undefined, height: number, marginTop?: number): FlowItem => ({
  width,
  height,
  marginTop,
});
const flow = (input: Partial<FlowInput> & Pick<FlowInput, 'items' | 'direction'>) =>
  layoutFlow({ box, centered: false, gap: 0, atTop: false, ...input });

describe('layoutFlow', () => {
  describe('column', () => {
    const items = [item(50, 20), item(80, 40)];

    it('puts each item below the last one, at the left, as one group at the vertical center of the box', () => {
      expect(flow({ items, direction: 'column' })).toEqual([
        { x: 10, align: 'left', y: 40 },
        { x: 10, align: 'left', y: 60 },
      ]);
    });

    it('starts at the top of the box when the items are at the top', () => {
      expect(flow({ items, direction: 'column', atTop: true }).map(({ y }) => y)).toEqual([20, 40]);
    });

    it('puts the items at the horizontal center, with the gap between them, when they are centered', () => {
      expect(flow({ items, direction: 'column', centered: true, gap: 10 })).toEqual([
        { x: 110, align: 'center', y: 35 },
        { x: 110, align: 'center', y: 65 },
      ]);
    });

    it('moves an item up by a negative top margin, and the group stays at the center', () => {
      const positions = flow({ items: [item(50, 20), item(80, 40, -10)], direction: 'column' });
      expect(positions.map(({ y }) => y)).toEqual([45, 55]);
    });
  });

  describe('row', () => {
    it('puts the first item at the left and the last item at the right, at the vertical center', () => {
      expect(flow({ items: [item(50, 20), item(80, 40)], direction: 'row' })).toEqual([
        { x: 10, align: 'left', y: 60 },
        { x: 210, align: 'right', y: 50 },
      ]);
    });

    it('puts a middle item with equal spaces at its two sides', () => {
      // The free width is 200 - 120 = 80, so each of the two spaces is 40.
      const [, middle] = flow({ items: [item(40, 20), item(40, 20), item(40, 20)], direction: 'row' });
      expect(middle).toMatchObject({ x: 110, align: 'center' });
    });

    it('puts the items at the top of the box when the items are at the top', () => {
      const positions = flow({ items: [item(50, 20), item(80, 40)], direction: 'row', atTop: true });
      expect(positions.map(({ y }) => y)).toEqual([20, 20]);
    });

    it('puts centered items in one group at the center of the box, with the gap between them', () => {
      // The group is 50 + 10 + 80 = 140 wide, so it starts at 10 + (200 - 140) / 2 = 40.
      expect(flow({ items: [item(50, 20), item(80, 40)], direction: 'row', centered: true, gap: 10 })).toEqual([
        { x: 40, align: 'left', y: 60 },
        { x: 100, align: 'left', y: 50 },
      ]);
    });

    it('starts a new line for an item that has no space, at the left', () => {
      expect(flow({ items: [item(150, 20), item(80, 40)], direction: 'row' })).toEqual([
        { x: 10, align: 'left', y: 40 },
        { x: 10, align: 'left', y: 60 },
      ]);
    });

    it('gives each line a part of the free height when the items are at the top', () => {
      // The free height is 100 - 60 = 40, so the second line starts 20px lower.
      const positions = flow({ items: [item(150, 20), item(80, 40)], direction: 'row', atTop: true });
      expect(positions.map(({ y }) => y)).toEqual([20, 60]);
    });

    it('puts each line of centered items at the horizontal center, with the gap between the lines', () => {
      expect(flow({ items: [item(150, 20), item(80, 40)], direction: 'row', centered: true, gap: 10 })).toEqual([
        { x: 110, align: 'center', y: 35 },
        { x: 110, align: 'center', y: 65 },
      ]);
    });
  });

  describe('a host that cannot measure text', () => {
    const items = [item(undefined, 20), item(undefined, 40)];

    it('does not wrap a row that is not centered', () => {
      expect(flow({ items, direction: 'row' }).map(({ align }) => align)).toEqual(['left', 'right']);
    });

    it('makes a centered row a column', () => {
      expect(flow({ items, direction: 'row', centered: true, gap: 10 })).toEqual(
        flow({ items, direction: 'column', centered: true, gap: 10 })
      );
    });
  });
});
