import { colorManipulator } from '@grafana/data';

// The colors of the core gradient modes "Opacity" and "Hue" of a bar fill (`custom.gradientMode`). Core draws one
// gradient from the top to the bottom of the plot. Offset 0 is the top.
// Core source: https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/config/gradientFills.ts

/** One color of a gradient. The offset is 0 to 1. */
export interface GradientStop {
  offset: number;
  color: string;
}

/** Core `getOpacityGradientFn`: the color at the opacity on the top, and transparent at the bottom. */
export function getOpacityGradientStops(color: string, opacity: number): GradientStop[] {
  return [
    { offset: 0, color: colorManipulator.alpha(color, opacity) },
    { offset: 1, color: colorManipulator.alpha(color, 0) },
  ];
}

/**
 * Core `getHueGradientFn`: a lighter hue on the top and a darker hue at the bottom, both at the opacity. Core
 * changes the color with `tinycolor2`. `Hsl` does the same steps, because plugins cannot import that package.
 */
export function getHueGradientStops(color: string, opacity: number, isDark: boolean): GradientStop[] {
  const top = Hsl.from(color).saturate(20).spin(20).brighten(10).lighten(10);
  const bottom = Hsl.from(color)
    .spin(-25)
    .darken(isDark ? 15 : 5);
  return [
    { offset: 0, color: top.toString(opacity) },
    { offset: 1, color: bottom.toString(opacity) },
  ];
}

/**
 * A color with the steps of `tinycolor2` that core uses: `spin`, `saturate`, `lighten`, `darken` and `brighten`.
 * The channels are not rounded between steps, as `tinycolor2`.
 * https://github.com/bgrins/TinyColor/blob/master/tinycolor.js
 */
export class Hsl {
  private constructor(
    private h: number,
    private s: number,
    private l: number
  ) {}

  static from(color: string): Hsl {
    // `decomposeColor` types its values as `any`.
    const values: unknown = colorManipulator.decomposeColor(color).values;
    const [r, g, b] = Array.isArray(values) ? values.map((value: unknown) => Number(value)) : [0, 0, 0];
    return Hsl.fromRgb(r, g, b);
  }

  private static fromRgb(r: number, g: number, b: number): Hsl {
    const [rn, gn, bn] = [r, g, b].map((value) => clamp01(value / 255));
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) {
      return new Hsl(0, 0, l);
    }
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
    return new Hsl((h / 6) * 360, s, l);
  }

  /** `tinycolor2` reads a saturation and a lightness as a percent, and truncates it to 2 decimals. */
  private static fromHsl(h: number, s: number, l: number): Hsl {
    const percent = (value: number) => Math.trunc(value * 100 * 100) / 100 / 100;
    return new Hsl(h, percent(s), percent(l));
  }

  spin(degrees: number): Hsl {
    const h = (this.h + degrees) % 360;
    return Hsl.fromHsl(h < 0 ? 360 + h : h, this.s, this.l);
  }

  saturate(amount: number): Hsl {
    return Hsl.fromHsl(this.h, clamp01(this.s + amount / 100), this.l);
  }

  lighten(amount: number): Hsl {
    return Hsl.fromHsl(this.h, this.s, clamp01(this.l + amount / 100));
  }

  darken(amount: number): Hsl {
    return this.lighten(-amount);
  }

  /** `tinycolor2` rounds the channels, and subtracts `Math.round(255 * -amount / 100)` from each. */
  brighten(amount: number): Hsl {
    const add = -Math.round(255 * -(amount / 100));
    const [r, g, b] = this.toRgb().map((value) => Math.max(0, Math.min(255, Math.round(value) + add)));
    return Hsl.fromRgb(r, g, b);
  }

  /** `rgba(…)` for an opacity below 1, else a hex color, as `tinycolor2` `toString` of a hex color. */
  toString(opacity: number): string {
    const [r, g, b] = this.toRgb().map(Math.round);
    const alpha = Math.round(clamp01(opacity) * 100) / 100;
    return alpha < 1
      ? `rgba(${r}, ${g}, ${b}, ${alpha})`
      : `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  private toRgb(): number[] {
    const h = this.h / 360;
    if (this.s === 0) {
      return [this.l, this.l, this.l].map((value) => value * 255);
    }
    const q = this.l < 0.5 ? this.l * (1 + this.s) : this.l + this.s - this.l * this.s;
    const p = 2 * this.l - q;
    return [h + 1 / 3, h, h - 1 / 3].map((t) => hueToRgb(p, q, t) * 255);
  }
}

function hueToRgb(p: number, q: number, t: number): number {
  const tn = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
  if (tn < 1 / 6) {
    return p + (q - p) * 6 * tn;
  }
  if (tn < 1 / 2) {
    return q;
  }
  if (tn < 2 / 3) {
    return p + (q - p) * (2 / 3 - tn) * 6;
  }
  return p;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
