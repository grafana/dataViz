import { getRelationsHoverAnimation, RELATIONS_HOVER_FADE_MS } from 'lib/echarts/relations/options/emphasis';
import { relationsOptions } from 'test/relations';

describe('getRelationsHoverAnimation', () => {
  it('turns on only the hover fade when the panel animation is off', () => {
    expect(getRelationsHoverAnimation(relationsOptions())).toEqual({
      animation: true,
      animationDuration: 0,
      animationDurationUpdate: 0,
      animationThreshold: Number.POSITIVE_INFINITY,
      stateAnimation: { duration: RELATIONS_HOVER_FADE_MS, easing: 'cubicOut' },
    });
  });

  it('sets the first-draw duration that sankey needs', () => {
    expect(getRelationsHoverAnimation(relationsOptions(), 1)).toHaveProperty('animationDuration', 1);
  });

  it('keeps the panel animation when it is on', () => {
    expect(getRelationsHoverAnimation(relationsOptions({ animation: { enabled: true } }))).toEqual({
      stateAnimation: { duration: RELATIONS_HOVER_FADE_MS, easing: 'cubicOut' },
    });
  });

  it('adds nothing when adjacency focus is off', () => {
    expect(getRelationsHoverAnimation(relationsOptions({ relationsFocusAdjacency: false }))).toBeUndefined();
  });
});
