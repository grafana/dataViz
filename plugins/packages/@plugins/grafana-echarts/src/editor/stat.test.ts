import { BigValueColorMode, BigValueGraphMode, BigValueTextMode } from '@grafana/schema';
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
    });
  });

  it('keeps the options that are set', () => {
    const set = {
      textMode: BigValueTextMode.Name,
      colorMode: BigValueColorMode.None,
      graphMode: BigValueGraphMode.None,
      wideLayout: false,
    };
    expect(resolveStatOptions(options(set))).toEqual(set);
  });

  it.each([BigValueColorMode.Background, BigValueColorMode.BackgroundSolid])(
    'gives the default color mode for the %s mode, which the panel does not draw',
    (colorMode) => {
      expect(resolveStatOptions(options({ colorMode })).colorMode).toBe(BigValueColorMode.Value);
    }
  );
});
