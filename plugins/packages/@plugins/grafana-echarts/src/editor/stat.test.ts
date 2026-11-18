import { VizOrientation } from '@grafana/data';
import {
  BigValueColorMode,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
  PercentChangeColorMode,
} from '@grafana/schema';
import { type PanelOptions } from 'types';
import { resolveStatOptions } from './stat';

const options = (extra: Partial<PanelOptions> = {}) => extra as PanelOptions;

describe('resolveStatOptions', () => {
  it('gives the defaults of core Stat for options that are not set', () => {
    expect(resolveStatOptions(options())).toEqual({
      orientation: VizOrientation.Auto,
      textMode: BigValueTextMode.Auto,
      colorMode: BigValueColorMode.Value,
      graphMode: BigValueGraphMode.Area,
      wideLayout: true,
      justifyMode: BigValueJustifyMode.Auto,
      showPercentChange: false,
      percentChangeColorMode: PercentChangeColorMode.Standard,
    });
  });

  it('keeps the options that are set', () => {
    const set = {
      orientation: VizOrientation.Horizontal,
      textMode: BigValueTextMode.Name,
      colorMode: BigValueColorMode.None,
      graphMode: BigValueGraphMode.None,
      wideLayout: false,
      justifyMode: BigValueJustifyMode.Center,
      showPercentChange: true,
      percentChangeColorMode: PercentChangeColorMode.Inverted,
    };
    expect(resolveStatOptions(options(set))).toEqual(set);
  });

  it.each([BigValueColorMode.Background, BigValueColorMode.BackgroundSolid])('keeps the %s color mode', (colorMode) => {
    expect(resolveStatOptions(options({ colorMode })).colorMode).toBe(colorMode);
  });

  it('reads the text sizes from the `text` option', () => {
    const resolved = resolveStatOptions(options({ text: { titleSize: 20, valueSize: 60, percentSize: 18 } }));
    expect(resolved.titleSize).toBe(20);
    expect(resolved.valueSize).toBe(60);
    expect(resolved.percentSize).toBe(18);
  });

  it('gives no text size for a size that is not set, or that is 0', () => {
    expect(resolveStatOptions(options()).titleSize).toBeUndefined();
    expect(resolveStatOptions(options({ text: { titleSize: 0, valueSize: 0 } })).valueSize).toBeUndefined();
  });

  it('gives the default color mode for a color mode that the panel does not know', () => {
    const colorMode = 'not_a_mode' as BigValueColorMode;
    expect(resolveStatOptions(options({ colorMode })).colorMode).toBe(BigValueColorMode.Value);
  });
});
