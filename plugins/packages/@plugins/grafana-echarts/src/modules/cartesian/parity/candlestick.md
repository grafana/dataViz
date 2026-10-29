# Candlestick editor option parity

Covers the ECharts **Cartesian** module ([../module.tsx](../module.tsx)) rendering
`seriesType: candlestick`, compared against core Grafana's **Candlestick** panel
([`public/app/plugins/panel/candlestick/module.tsx`](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/candlestick/module.tsx)).

## Current support status

Candlestick is a **multi-value** cartesian render type: each x position carries
several aligned dimensions (OHLC). The render path is `buildMultiValueOption` in
[../../../lib/echarts/charts/cartesian.ts](../../../lib/echarts/charts/cartesian.ts),
fed by
[../../../lib/echarts/converters/multiValueCartesian.ts](../../../lib/echarts/converters/multiValueCartesian.ts).

The panel-level Series type option selects it. When the frames have the OHLC shape,
the option offers only candlestick and boxplot (`framesLookMultiValue`). The per-field
`seriesType` override does not offer it. The candlestick-specific editor options of
core (mode, candle style, colors, field pickers) have no equivalent.

## Design difference

Core Candlestick is built on the Time series visualization and applies OHLC
semantics by field-name convention (open/high/low/close/volume) with a manual
field-mapping fallback. This module infers the OHLC mapping in the converter and
exposes no per-field mapping or candlestick-specific styling in the editor.

## Panel options

| Core Grafana option                       | ECharts equivalent                                                 | Status        |
| ----------------------------------------- | ------------------------------------------------------------------ | ------------- |
| Mode (Candles / Volume / Both)            | none                                                               | Not supported |
| Candle style (Candles / OHLC bars)        | none                                                               | Not supported |
| Color strategy (since open / prior close) | none                                                               | Not supported |
| Up color / down color                     | none                                                               | Not supported |
| Open/High/Low/Close/Volume field pickers  | none (mapping inferred in converter)                               | Not supported |
| Additional fields (ignore / include)      | none                                                               | Not supported |
| Tooltip: mode                             | `tooltip.mode`                                                     | Supported     |
| Legend                                    | Grafana legend via `addLegendOptions`                              | Supported     |
| Annotations: points and regions           | `data.annotations` at the nearest candle                           | Partial       |
| Annotations: Hide lines and areas         | `options.annotations` lines and bands                              | Supported     |
| Annotations: Enable multi-row annotations | `options.annotations.multiLane` hides the lines and bands, as core | Partial       |
| Annotations: Enable annotation clustering | none                                                               | Not supported |
| —                                         | `editorMode` radio (Default / Advanced tiers)                      | ECharts-only  |
| —                                         | Advanced: `animation.enabled` (off by default)                     | Advanced      |

## Standard (field-config) options

The Cartesian module keeps the full standard field-config set (customizing only
Color), matching core Candlestick which uses the timeseries graph field config.

## Notes / gaps

- The defining Candlestick features (OHLC field mapping, candle mode/style,
  up/down colors) are not exposed. The panel has no OHLC mapping options.
- Show points and Advanced **Downsampling** do not show for candlestick (they are
  line-only). `converters/multiValueCartesian.ts` never calls `getSeriesPerfOptions`.
  ECharts supports `large`/`largeThreshold` on candlestick, so wiring that converter
  is an option. See [performance.md](../../../../docs/performance.md).
- **Annotations** use the code of the time axis ([timeseries.md](./timeseries.md)):
  a dashed line for a point, and a band with a dashed line at each edge for a region.
  Core Candlestick draws them on a time axis. This panel draws candles on a category
  axis, which rounds a value to a category index. Thus each annotation time moves to
  the nearest candle. A region with both edges nearest to one candle is one line.
  Marks before the first candle or after the last candle do not draw, and regions are
  clipped to the candles. Boxplot draws no annotations. The candlestick draws the
  markers under the plot (a triangle for a point, a bar for a region), but no annotation tooltip. The annotation options (line width,
  band opacity, multi-row) apply to the lines and bands as on the time axis
  ([timeseries.md](./timeseries.md)). Tests:
  [canvas baseline](../../../lib/components/annotations.canvas.test.tsx),
  [integration](../../../lib/components/annotations.integration.test.tsx),
  [options integration](../../../lib/components/annotation-options.integration.test.tsx). Dashboard:
  `provisioning/dashboards/cartesian/cartesian-annotations.json`.

## ECharts API support

High-level [ECharts option](https://echarts.apache.org/en/option.html) components
used by this render path. See [echarts.ts](../../../lib/echarts/echarts.ts) for
the registered runtime surface.

| ECharts API                                                                                    | Status                                                         | Notes                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `series` (candlestick)                                                                         | Supported                                                      | `seriesType: candlestick`, selected by the panel Series type when the frames have the OHLC shape.                                                                                                                                     |
| `grid`                                                                                         | Supported                                                      | Single cartesian grid; spacing adapts to the legend.                                                                                                                                                                                  |
| `xAxis` / `yAxis`                                                                              | Supported                                                      | Category x (ISO-timestamp labels); single shared value axis.                                                                                                                                                                          |
| `tooltip`                                                                                      | Supported                                                      | Rendered by a React `@grafana/ui` `VizTooltip` overlay; category axis uses per-item `trigger`. One row per packed dimension (Open/Close/Low/High), each resolving its own field, so a pinned candle's footer unions their data links. |
| Tooltip: click-to-pin, data links                                                              | React `VizTooltip` footer, unioned across the four OHLC fields | Supported                                                                                                                                                                                                                             |
| `axisPointer`                                                                                  | Partial                                                        | Per-item crosshair only (category axis has no shared pointer).                                                                                                                                                                        |
| `brush`                                                                                        | Partial                                                        | `lineX` drag maps category indices back to the dashboard time range.                                                                                                                                                                  |
| `markLine` / `markArea`                                                                        | Supported                                                      | Threshold lines / regions on the shared value axis. Annotation lines / bands at the nearest candle.                                                                                                                                   |
| `legend`                                                                                       | Supported                                                      | Grafana DOM legend (`addLegendOptions`); native legend hidden. Interactive show/hide (via the core `hideSeriesFrom` byNames override) + color (via `byName`) read directly (per series, not per field).                               |
| `animation`                                                                                    | Supported                                                      | Off by default for every family; opt in via the Advanced `animation.enabled` switch.                                                                                                                                                  |
| `color` / `textStyle`                                                                          | Supported                                                      | Derived from the Grafana theme.                                                                                                                                                                                                       |
| `visualMap`                                                                                    | Not implemented                                                | Registered for the heatmap family only.                                                                                                                                                                                               |
| `dataZoom`                                                                                     | Not implemented                                                | Range zoom is delegated to `brush` -> dashboard time range.                                                                                                                                                                           |
| `toolbox` / `dataset` / `title` / `graphic` / `timeline` / `aria`                              | Not implemented                                                | Not registered.                                                                                                                                                                                                                       |
| Other coordinate systems (`polar` / `parallel` / `singleAxis` / `geo` / `calendar` / `matrix`) | Not implemented                                                | Cartesian `grid` only.                                                                                                                                                                                                                |
