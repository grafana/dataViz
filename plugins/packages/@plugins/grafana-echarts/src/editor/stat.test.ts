import { BigValueColorMode, BigValueGraphMode, BigValueJustifyMode, BigValueTextMode } from '@grafana/schema';
import { type PanelOptions } from 'types';
import { resolveStatOptions } from './stat';

const options = (extra: Partial<PanelOptions> = {}) => extra as PanelOptions;

describe('resolveStatOptions', () => {
  it('gives the defaults of core Stat for options that are not set', () => {
    expect(resolveStatOptions(options())).toEqual({
      textMode: BigValueTextMode.Auto,
      colorMode: BigValueColorMode.Value,
      graphMode: BigValueGraphMode.Area,
      wideLayout: true,
      justifyMode: BigValueJustifyMode.Auto,
    });
  });

  it('keeps the options that are set', () => {
    const set = {
      textMode: BigValueTextMode.Name,
      colorMode: BigValueColorMode.None,
      graphMode: BigValueGraphMode.None,
      wideLayout: false,
      justifyMode: BigValueJustifyMode.Center,
    };
    expect(resolveStatOptions(options(set))).toEqual(set);
  });

  it.each([BigValueColorMode.Background, BigValueColorMode.BackgroundSolid])('keeps the %s color mode', (colorMode) => {
    expect(resolveStatOptions(options({ colorMode })).colorMode).toBe(colorMode);
  });

  it('gives the default color mode for a color mode that the panel does not know', () => {
    const colorMode = 'not_a_mode' as BigValueColorMode;
    expect(resolveStatOptions(options({ colorMode })).colorMode).toBe(BigValueColorMode.Value);
  });
});
