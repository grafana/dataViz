# Bar chart editor option parity

Covers the ECharts **Cartesian** module ([../module.tsx](../module.tsx)) rendering
`seriesType: bar`, compared against core Grafana's **Bar chart** panel
([`public/app/plugins/panel/barchart/module.tsx`](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/barchart/module.tsx)).

See [timeseries.md](./timeseries.md) for the shared-module note: bar is one render
type of the family-fixed Cartesian panel, selected per field via `seriesType`.

## Design difference

Core Bar chart adds bar-specific panel options (orientation, bar and group
width, radius, value labels, x tick handling) on top of the graph field config.
This module has the core-parity options (Stacking, Orientation, Show values,
"Color by field", tick spacing, and the bar geometry and style options) in every
editor mode (#404). Only the value label position is in the **Advanced** editor tier. Two provisioned dashboards show
the options: `cartesian-bar-options.json` has one panel for each option, and
`cartesian-barchart-parity.json` shows each rule next to a core Bar chart twin.
The rendered tests of each option are in
`src/lib/components/integration-tests/bars/`.

## Panel options

| Core Grafana option                    | ECharts equivalent                                                                                                              | Status        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| X Axis field picker                    | none (x is the time field, else the first string field)                                                                         | Not supported |
| Orientation (auto/horizontal/vertical) | `orientation`: category y-axis with `inverse`, value axes on x. Category x-axis and bar panels only                             | Supported     |
| Rotate x tick labels                   | `xAxis.axisLabel.rotate` (`xTickRotate`)                                                                                        | Supported     |
| X tick label max length                | `xTickLabelMaxLength`: label formatter cuts rotated labels, as core                                                             | Supported     |
| X-axis labels minimum spacing          | `xTickLabelSpacing`: `axisLabel.interval` from the category width. Category x-axis only                                         | Supported     |
| Show values (auto/always/never)        | `series.label` with the field display text. Auto labels bars only, with `labelLayout.hideOverlap`                               | Supported     |
| Stacking (none/normal/percent)         | `stacking`; percent draws each stack as shares of its total. A per-field `stackSeries` override opts out                        | Supported     |
| Group width, bar width                 | core defaults as `barCategoryGap` / `barGap`; `barWidth` sets a width in % of the category                                      | Partial       |
| Bar radius                             | `barRadius` in px, on the value end of unstacked bars and of the top stacked bar                                                | Partial       |
| Highlight full area on hover           | `fullHighlight`: a `shadow` axis pointer on the category axis                                                                   | Supported     |
| Color by field                         | `colorByField`: each bar takes the display color of that field in the same row                                                  | Supported     |
| Tooltip: mode                          | `tooltip.mode`; All uses the `axis` trigger on the category axis too                                                            | Supported     |
| Legend                                 | Grafana legend via `addLegendOptions`                                                                                           | Supported     |
| —                                      | Annotations on the time x-axis (core Bar chart has none)                                                                        | ECharts-only  |
| Animation                              | `animation.enabled` (Advanced, **off by default** for every family)                                                             | Supported     |
| Text size: value                       | `text.valueSize`; unset fits the label in 65% of the bar thickness, 8 px to 14 px                                               | Supported     |
| —                                      | `editorMode` radio (Default / Advanced editor tiers)                                                                            | ECharts-only  |
| —                                      | Advanced: `performance.downsampling` (line-only). Bar uses `large` at 2,000+ points. Show points is Default tier (Graph styles) | Advanced      |

## Graph styles (core custom field config)

| Core Grafana option                     | ECharts equivalent                                                                        | Status        |
| --------------------------------------- | ----------------------------------------------------------------------------------------- | ------------- |
| Fill opacity                            | `barFillOpacity` (default 80): fill color alpha; the border stays solid                   | Supported     |
| Line width                              | `lineWidth`: bar border width, default 1 px                                               | Supported     |
| Gradient mode                           | none                                                                                      | Not supported |
| Transform: negative Y                   | `custom.transform`: the bar draws below zero; labels and tooltip show the field value     | Supported     |
| Transform: constant                     | none                                                                                      | Not supported |
| Show thresholds (thresholds style)      | per-field `thresholdsStyle.mode` (vertical marks on horizontal bars)                      | Supported     |
| Axis placement                          | per-field `axisPlacement`                                                                 | Partial       |
| Axis: label, width, grid, color, border | `addAxisConfig`: axis `name`, label `width`, `splitLine`, series color, `axisLine`        | Supported     |
| Axis: scale, centered zero, soft limits | log axis (symlog draws linear), symmetric range, `min`/`max` functions                    | Partial       |
| Hide in area                            | `custom.hideFrom`: only `viz` is honored (the legend and tooltip switches have no effect) | Partial       |

## Standard (field-config) options

Both keep the full standard field-config set. Thresholds and colored value
mappings color each bar, as core. Note the per-field `stackSeries` switch is shown
only when a field's `seriesType` override is `bar`.

## Notes / gaps

- A bar axis includes zero unless Min or Max is set, as core. A line-only axis
  fits the data, as core Time series.
- The classic palette counts only the value fields, as core
  `setClassicPaletteIdxs`. A label column does not move the series colors.
- Stacked bars from several time frames join on time first, as core, so each
  stack sums the values at one timestamp.
- Deliberate differences, because this panel is also the Time series panel:
  a time x-axis stays continuous (core Bar chart makes it ordinal), a time field
  is the x-axis before a string field, and a second unit draws its axis on the
  right (core Bar chart draws all Auto axes on the left).
- Bar radius is in px: ECharts has no radius relative to the bar width.
- Auto label size cannot measure the space above the tallest bar before layout,
  so the grid keeps one label row above the bars. Core hides the labels when no
  space is left.
- Interactive legend: clicking a legend item shows/hides its series and the legend
  color picker sets a fixed color; color persists as a `byName` override and
  visibility as the core `hideSeriesFrom` system override.
- **Annotations** draw on the time x-axis, with the code of Time series
  ([timeseries.md](./timeseries.md)). On a category x-axis, bars draw no annotations,
  as core Bar chart (it has no annotation support). Tests:
  [canvas baseline](../../../lib/components/annotations.canvas.test.tsx),
  [integration](../../../lib/components/annotations.integration.test.tsx).
- Per-field `seriesType` / `stackSeries` overrides apply on the **category** x-axis
  as well as the time axis, so a categorical bar chart can carry a line or scatter
  overlay (e.g. actuals as bars with a target as a line).
- **Exceeds core here:** core Bar chart requires a single frame and errors on more.
  This module merges every frame on the category axis, joining series by category
  label (union of labels in first-appearance order; a category a frame has no row
  for renders as a gap). That is what lets a scatter overlay come from its own
  query rather than a joined column. See
  [#73](https://github.com/grafana/dataViz/issues/73) for the part still open (matrix heatmap).

## ECharts API support

High-level [ECharts option](https://echarts.apache.org/en/option.html) components
used by this render path. See [echarts.ts](../../../lib/echarts/echarts.ts) for
the registered runtime surface.

| ECharts API                                                                                    | Status          | Notes                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `series` (bar)                                                                                 | Supported       | `seriesType: bar`; normal and percent stacking.                                                                                                                                                      |
| `grid`                                                                                         | Supported       | Single cartesian grid; spacing adapts to stacked y-axes and legend.                                                                                                                                  |
| `xAxis` / `yAxis`                                                                              | Supported       | X follows the data (time or category); one y-axis per field unit.                                                                                                                                    |
| `tooltip`                                                                                      | Supported       | Rendered by a React `@grafana/ui` `VizTooltip` overlay; mode maps to `trigger` (item / axis / none). Supports pin, data links, ad-hoc filters. Bars opt out of proximity hover (see the note below). |
| Tooltip: click-to-pin, data links, ad-hoc filters                                              | Supported       | React `VizTooltip` footer                                                                                                                                                                            |
| `axisPointer`                                                                                  | Partial         | Crosshair via `tooltip.axisPointer`; shared on the time axis, per-item on category axes.                                                                                                             |
| `brush`                                                                                        | Partial         | `lineX` drag maps to the dashboard time range; time axis only.                                                                                                                                       |
| `markLine` / `markArea`                                                                        | Supported       | Threshold lines / regions on the shared value axis.                                                                                                                                                  |
| `legend`                                                                                       | Supported       | Grafana DOM legend (`addLegendOptions`); native legend hidden. Interactive show/hide + color persist as field-config overrides.                                                                      |
| `animation`                                                                                    | Supported       | Off by default for every family; opt in via the Advanced `animation.enabled` switch.                                                                                                                 |
| `color` / `textStyle`                                                                          | Supported       | Derived from the Grafana theme.                                                                                                                                                                      |
| `visualMap`                                                                                    | Not implemented | Registered for the heatmap family only.                                                                                                                                                              |
| `dataZoom`                                                                                     | Not implemented | Range zoom is delegated to `brush` -> dashboard time range.                                                                                                                                          |
| `toolbox` / `dataset` / `title` / `graphic` / `timeline` / `aria`                              | Not implemented | Not registered.                                                                                                                                                                                      |
| Other coordinate systems (`polar` / `parallel` / `singleAxis` / `geo` / `calendar` / `matrix`) | Not implemented | Cartesian `grid` only.                                                                                                                                                                               |
