# Box plot editor option parity

Covers the ECharts **Cartesian** module ([../module.tsx](../module.tsx)) rendering
`seriesType: boxplot`.

## No core Grafana equivalent

Grafana core has **no box plot panel**, so there is no parity target. This doc
records the ECharts-only status rather than comparing option-for-option.

## Current support status

Box plot is a **multi-value** cartesian render type: each x position carries
the five-number summary (min, Q1, median, Q3, max). The render path is
`buildMultiValueOption` in
[../../../lib/echarts/charts/cartesian.ts](../../../lib/echarts/charts/cartesian.ts),
fed by
[../../../lib/echarts/converters/multiValueCartesian.ts](../../../lib/echarts/converters/multiValueCartesian.ts).

The panel-level Series type option selects it. When the frames have the five-number
shape, the option offers only candlestick and boxplot (`framesLookMultiValue`). The
per-field `seriesType` override does not offer it.

Unlike candlestick's OHLC convention, box plot has **no Grafana-native field
convention**; the five-number mapping is defined entirely by this plugin's
converter.

## Options

| Area                          | Status                                            |
| ----------------------------- | ------------------------------------------------- |
| Render type selection         | Panel-level Series type (multi-value frames only) |
| Five-number field mapping     | Inferred in converter; no editor UI               |
| Tooltip mode                  | `tooltip.mode`                                    |
| Legend                        | Grafana legend via `addLegendOptions`             |
| Standard field-config options | Full set kept (Color customized)                  |
| Editor mode                   | `editorMode` radio (Default / Advanced)           |
| Performance overrides         | Not shown (line-only), see below                  |

## Notes / gaps

- Purely ECharts-side. There is no core panel to reach parity with; any future
  work is about documenting the five-number field convention.
- Show points and Advanced **Downsampling** do not show for boxplot (they are
  line-only). `converters/multiValueCartesian.ts` has no `showSymbol`/`sampling`
  equivalent to drive. `animation.enabled` does apply. See
  [performance.md](../../../../docs/performance.md).

## ECharts API support

High-level [ECharts option](https://echarts.apache.org/en/option.html) components
used by this render path. See [echarts.ts](../../../lib/echarts/echarts.ts) for
the registered runtime surface.

| ECharts API                                                                                    | Status          | Notes                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `series` (boxplot)                                                                             | Supported       | `seriesType: boxplot`, selected by the panel Series type when the frames have the five-number shape.                                                                                                                                 |
| `grid`                                                                                         | Supported       | Single cartesian grid; spacing adapts to the legend.                                                                                                                                                                                 |
| `xAxis` / `yAxis`                                                                              | Supported       | Category x (ISO-timestamp labels); single shared value axis.                                                                                                                                                                         |
| `tooltip`                                                                                      | Supported       | Rendered by a React `@grafana/ui` `VizTooltip` overlay; category axis uses per-item `trigger`. One row per packed dimension (Min/Q1/Median/Q3/Max), each resolving its own field, so a pinned item's footer unions their data links. |
| Tooltip: click-to-pin, links                                                                   | Supported       | React `VizTooltip` footer, unioned across the five fields                                                                                                                                                                            |
| `axisPointer`                                                                                  | Partial         | Per-item crosshair only (category axis has no shared pointer).                                                                                                                                                                       |
| `brush`                                                                                        | Partial         | `lineX` drag maps category indices back to the dashboard time range.                                                                                                                                                                 |
| `markLine` / `markArea`                                                                        | Supported       | Threshold lines / regions on the shared value axis.                                                                                                                                                                                  |
| `legend`                                                                                       | Supported       | Grafana DOM legend (`addLegendOptions`); native legend hidden. Interactive show/hide (via the core `hideSeriesFrom` byNames override) + color (via `byName`) read directly (per series, not per field).                              |
| `animation`                                                                                    | Supported       | Off by default for every family; opt in via the Advanced `animation.enabled` switch.                                                                                                                                                 |
| `color` / `textStyle`                                                                          | Supported       | Derived from the Grafana theme.                                                                                                                                                                                                      |
| `visualMap`                                                                                    | Not implemented | Registered for the heatmap family only.                                                                                                                                                                                              |
| `dataZoom`                                                                                     | Not implemented | Range zoom is delegated to `brush` -> dashboard time range.                                                                                                                                                                          |
| `toolbox` / `dataset` / `title` / `graphic` / `timeline` / `aria`                              | Not implemented | Not registered.                                                                                                                                                                                                                      |
| Other coordinate systems (`polar` / `parallel` / `singleAxis` / `geo` / `calendar` / `matrix`) | Not implemented | Cartesian `grid` only.                                                                                                                                                                                                               |
