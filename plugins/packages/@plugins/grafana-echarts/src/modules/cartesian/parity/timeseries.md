# Time series editor option parity

Covers the ECharts **Cartesian** module ([../module.tsx](../module.tsx)) rendering
`seriesType: line`, compared against core Grafana's **Time series** panel
([`public/app/plugins/panel/timeseries/module.tsx`](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/timeseries/module.tsx)).

The Cartesian module is family-fixed: line/bar/scatter share one panel and are
selected per field via the `seriesType` override, so this doc, [barchart.md](./barchart.md),
and [xychart.md](./xychart.md) all describe the same module viewed through a
different render type.

## Design difference

Core Time series exposes the full graph field config (draw style, line width,
fill, points, stacking, per-axis config) plus the standard field-config set. This
module keeps the standard field-config set and most of the graph field config:
axis, line style, line interpolation, line width, fill opacity, points, stacking and
Connect null values. The gaps are gradient mode, fill below to, bar alignment and
Disconnect values (see "Graph styles"). The module also reads the core option paths,
so a switch from core Time series keeps the settings ([panelChange](../../../lib/grafana/panelChange/timeseries.ts)).

## Panel options

| Core Grafana option                                | ECharts equivalent                                                                                     | Status        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------- |
| Tooltip: mode (Single/All/Hidden)                  | `tooltip.mode`                                                                                         | Supported     |
| Tooltip: hover sort, hide zeros, max width         | `tooltip.sort`, `tooltip.hideZeros`, `tooltip.maxWidth` (React `VizTooltip`)                           | Supported     |
| Legend: visibility, mode, placement, width, values | Grafana legend via `addLegendOptions`                                                                  | Supported     |
| Legend: series show/hide + color (interactive)     | `VizLegend` writes `hideFrom`/color field-config overrides                                             | Supported     |
| Axis: time zone editor                             | none (timeZone from panel context)                                                                     | Not supported |
| Annotations: points and regions                    | `data.annotations` drawn as a dashed `markLine` (points, region edges) and a `markArea` band (regions) | Partial       |
| Annotations: markers and tooltip                   | A `custom` series draws the markers under the plot; its item tooltip shows the annotation              | Partial       |
| Annotations: add from the chart                    | Tooltip "Add annotation" button, ctrl/cmd + click (point), ctrl/cmd + drag (region), editor form       | Partial       |
| Annotations: Hide lines and areas                  | Custom switch on `options.annotations`: `lines.width` and `regions.opacity`                            | Supported     |
| Annotations: Enable multi-row annotations          | `options.annotations.multiLane`: a row of markers for each annotation frame                            | Supported     |
| Annotations: Enable annotation clustering          | none                                                                                                   | Not supported |
| —                                                  | `editorMode` radio (Default / Advanced editor tiers)                                                   | ECharts-only  |
| —                                                  | Advanced: `performance.downsampling` (LTTB), `animation.enabled` (off by default)                      | Advanced      |

## Graph styles (core custom field config)

| Core Grafana option                                                        | ECharts equivalent                                                                                                | Status        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------- |
| Style (lines/bars/points), line interpolation                              | `seriesType` (line/bar/scatter); per-field `lineInterpolation` -> ECharts `smooth` / `step`                       | Supported     |
| Line width, fill opacity                                                   | `lineWidth`, `fillOpacity` (panel options, Default tier, and per field) -> `lineStyle.width`, `areaStyle.opacity` | Supported     |
| Line style (solid, dash, dots)                                             | per-field `lineStyle` (`LineStyleEditor`)                                                                         | Supported     |
| Gradient mode                                                              | none (the chart draws no gradient on lines; histogram only)                                                       | Not supported |
| Fill below to                                                              | none                                                                                                              | Not supported |
| Bar alignment                                                              | none (each bar is at the center of its time)                                                                      | Not supported |
| Transform (Negative Y)                                                     | per-field `transform`; Constant is not supported                                                                  | Partial       |
| Connect null values                                                        | per-field `spanNulls` (Default tier): `true` -> `connectNulls`; a threshold (ms) spans shorter gaps               | Supported     |
| Disconnect values                                                          | none                                                                                                              | Not supported |
| Show points, point size                                                    | `showPoints` -> `series.showSymbol`, `pointSize` -> `symbolSize` (Default tier, and per field)                    | Supported     |
| Stack series                                                               | panel `stacking` (none/normal/percent), per-field `stackSeries` and `stackGroup` (bars; lines on a time axis)     | Supported     |
| Axis placement                                                             | per-field `axisPlacement`                                                                                         | Supported     |
| Axis: label, width, soft min/max, centered zero, color, border, grid lines | `commonOptionsBuilder.addAxisConfig`, read in `buildCartesianYAxes`                                               | Supported     |
| Axis: scale (linear, log)                                                  | per-field `scaleDistribution`; symlog draws as linear                                                             | Partial       |
| Show thresholds (thresholds style)                                         | per-field `thresholdsStyle.mode`; the `series` mode does not color the series                                     | Partial       |
| Hide in area (viz/legend/tooltip)                                          | `custom.hideFrom` (via `addHideFrom`)                                                                             | Partial       |

Connect null values follows core `nullToUndefThreshold`. A threshold leaves the connected null rows out of the
ECharts series data, and the tooltip maps each point back to its frame row. The frame values do not change. On a
category axis, a threshold is not supported: the line breaks at each null, and the panel shows a warning notice.
Dashboard: [cartesian-span-nulls.json](../../../../provisioning/dashboards/cartesian/cartesian-span-nulls.json)
(ECharts and core pairs). Tests: `span-nulls.canvas.test.tsx`, `span-nulls.integration.test.tsx`, `spanNulls.test.ts`.

On a time axis, line and area series stack as in core Time series (`preparePlotData2`), in a group apart from the
bars. A null in one line, at a row where another line of the stack has a value, adds 0: the line draws on the line
below it. At a row where each line is null, Connect null values decides. A line with a threshold breaks at a row
where another line of the stack breaks, where core connects it (#440). Dashboard:
[cartesian-stacked-lines.json](../../../../provisioning/dashboards/cartesian/cartesian-stacked-lines.json) (ECharts
and core pairs). Tests: `stacked-lines.canvas.test.tsx`, `stacked-lines.integration.test.tsx`, `stackedLines.test.ts`.

As in core `getStackingGroups`, a stack holds only fields with the same unit (the scale key). A field with another
unit goes on its own y-axis and does not stack on the fields of the other unit. Tests:
`stacking.integration.test.tsx`, `timeSeries.test.ts`.

## Standard (field-config) options

Both core Time series and this module keep the full standard field-config set
(Color, Unit, Decimals, Min, Max, Display name, No value, Thresholds, Value
mappings, Data links). This module customizes only Color (PaletteClassic,
byValue + bySeries).

## Notes / gaps

- ECharts-only: a single panel can mix cartesian render types per field (e.g. one
  field as `bar` over others as `line`) via the `seriesType` override.
- The remaining gaps are gradient mode, fill below to, bar alignment, Disconnect values,
  the symlog scale, Show values on points, annotation clustering and annotation edit/delete.
  The source of truth for a switch from core Time series is
  [capabilities/timeseries.json](../../../lib/grafana/panelChange/capabilities/timeseries.json).
- **Hide in area** registers all three toggles (viz/legend/tooltip), but only
  `viz` is honored: viz-hidden fields are stripped from the render, while the
  series stays greyed in the legend. The `legend`/`tooltip` sub-toggles have no
  effect. Clicking a legend item toggles the same `viz` state.
- **Annotations** draw on the time axis (line, bar and scatter) and on the candlestick
  axis ([candlestick.md](./candlestick.md)). A point is a
  dashed vertical line. A region is a band with a dashed line at each edge. The dash is
  5 px, as core. Each
  event has its own color (`getColorByName`, default `DEFAULT_ANNOTATION_COLOR`). Marks
  out of the time range do not draw, and regions are clipped to it. A legend click that
  hides a series keeps the marks. Tests: [canvas baseline](../../../lib/components/annotations.canvas.test.tsx),
  [integration](../../../lib/components/annotations.integration.test.tsx). Dashboard:
  `provisioning/dashboards/cartesian/cartesian-annotations.json`.
- **Annotation options** use the core paths of `options.annotations` (`VizAnnotations`
  in `@grafana/schema`), so the fallback map copies them unchanged (viz contract 10.4).
  `lines.width` sets the line width (default 2 px), and `regions.opacity` sets the band
  opacity (default 0.1). As core, the lines and the bands draw only when both values are
  more than 0. The "Hide lines and areas" switch sets both to 0, or back to the defaults.
  Unlike core, the switch keeps `multiLane` and `clustering`. "Enable multi-row
  annotations" (`multiLane`) draws the markers of each annotation frame in its own row,
  7 px under the row before it. With 2 or more frames, the time labels move down by 7 px
  for each frame, as core. Core also draws the grid lines down through the marker rows.
  This panel does not. As core, multi-row hides the lines and the bands until the panel
  sets them. The editors
  show only when the panel has annotation frames (multi-row: two or more), as core.
  Tested on Grafana 13.2.0. Tests:
  [canvas baseline](../../../lib/components/annotation-options.canvas.test.tsx),
  [integration](../../../lib/components/annotation-options.integration.test.tsx).
  Dashboard: `provisioning/dashboards/cartesian/cartesian-annotations.json`.
- **Annotation markers** draw under the plot, as core `AnnotationMarker`: a 10 x 5 px
  triangle at a point, and a 5 px bar under a region, in the event color. A hover on a
  marker shows the annotation tooltip in Single and All mode: the time (a range for a
  region), the title and the text as sanitized HTML, and the tags. A click pins the
  tooltip. The markers are a `custom` series after the data series, so they are not in
  the legend or in the All tooltip rows. The panel sets `setDataSupport({ annotations: true })`,
  as core does. Without it, a Scenes dashboard removes `data.annotations` (tested on Grafana
  13.1.0). Tests:
  [canvas baseline](../../../lib/components/annotation-markers.canvas.test.tsx),
  [integration](../../../lib/components/annotation-markers.integration.test.tsx).
- **Pan** the time range with a drag of the x-axis labels, as core `XAxisInteractionAreaPlugin`
  (viz contract 26). The x axis moves during the drag. On release, a drag of 5 px or more
  calls `onChangeTimeRange` with the range moved by the drag. The brush zoom stays in the
  plot area. Only on a time x-axis: candlestick and boxplot do not pan (#601). Dashboard:
  [cartesian-pan.json](../../../../provisioning/dashboards/cartesian/cartesian-pan.json)
  (ECharts and core pair). Tests: [integration](../../../lib/components/time-axis-pan.integration.test.tsx),
  [core formula](../../../lib/echarts/timePan.test.ts),
  [standalone](../../../standalone/renderPan.integration.test.tsx).
- **Add an annotation** from the chart, as core. The pinned tooltip has an "Add annotation"
  button, which adds a point at the cursor time. Ctrl or cmd + click adds a point, and
  ctrl or cmd + drag adds a region. A ctrl or cmd click does not pin the tooltip, and a
  ctrl or cmd drag does not zoom. The editor has a required description and tags. Save
  sends the event to `PanelContext.onAnnotationCreate`. All of this is only on a time
  x-axis (the tests and the browser check use a line chart), and only when
  `PanelContext.canAddAnnotations()` is true. The standalone renderer has no panel context, so it does not show the button.
  As in core, Grafana saves the panel id with the annotation, and the built-in layer
  shows it only on that panel. Differences from core: the editor opens at the cursor
  (core puts it under the plot), no marker shows the new annotation while the editor is
  open, and the tags input does not list the existing tags. Candlestick does not add
  annotations. Tests:
  [integration](../../../lib/components/annotation-create.integration.test.tsx). Tested
  on Grafana 13.2.0. Dashboard: `provisioning/dashboards/cartesian/cartesian-annotations.json`.
- Annotations: not supported yet. Clustering (`annotations.clustering`): core joins the
  point markers that are near each other into one region marker. The panel has no
  clustering switch, and it draws each marker. Edit and delete of an annotation. The
  marker tooltip follows the cursor (core puts it under the marker),
  has no data links, and does not show when the tooltip mode is Hidden (core shows it).
  Its tags are in one theme color, and its time is in the font of the data tooltip header.
  Core `Tag` colors and the monospace time would put the viz bundle over its size limit.
  The standalone renderer (#261) does not draw annotations. Candlestick draws lines and
  bands, but no markers and no tooltip.

## ECharts API support

High-level [ECharts option](https://echarts.apache.org/en/option.html) components
used by this render path. See [echarts.ts](../../../lib/echarts/echarts.ts) for
the registered runtime surface.

| ECharts API                                                                                    | Status                                                | Notes                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `series` (line)                                                                                | Supported                                             | `seriesType: line`; a panel can mix bar/scatter per field.                                                                                                                                                                                   |
| `grid`                                                                                         | Supported                                             | Single cartesian grid; spacing adapts to stacked y-axes and legend.                                                                                                                                                                          |
| `xAxis` / `yAxis`                                                                              | Supported                                             | X follows the data (time or category); one y-axis per field unit.                                                                                                                                                                            |
| `tooltip`                                                                                      | Supported                                             | Rendered by a React `@grafana/ui` `VizTooltip` overlay; the (invisible) ECharts tooltip only drives hover + "All"-mode aggregation. Mode maps to `trigger` (item / axis / none). Supports pin, data links, ad-hoc filters, max width/height. |
| Tooltip: hover sort, hide zeros                                                                | `tooltip.sort` / `tooltip.hideZeros` (Multi only)     | Supported                                                                                                                                                                                                                                    |
| Tooltip: max width / height + scroll                                                           | `tooltip.maxWidth` / `maxHeight` (React `VizTooltip`) | Supported                                                                                                                                                                                                                                    |
| Tooltip: click-to-pin, data links, ad-hoc filters                                              | React `VizTooltip` footer (with "Add annotation")     | Supported                                                                                                                                                                                                                                    |
| `axisPointer`                                                                                  | Partial                                               | Crosshair via `tooltip.axisPointer`; shared on the time axis, per-item on category axes.                                                                                                                                                     |
| `brush`                                                                                        | Partial                                               | `lineX` drag maps to the dashboard time range; time axis only.                                                                                                                                                                               |
| `markLine` / `markArea`                                                                        | Supported                                             | Threshold lines / regions on the shared value axis. Annotation lines / bands on the time axis, in one series with no data.                                                                                                                   |
| `series` (custom)                                                                              | Partial                                               | Annotation markers under the plot, with an item tooltip. `clip: false`, and a `NaN` y value so the markers do not change the y-axis extent.                                                                                                  |
| `legend`                                                                                       | Supported                                             | Grafana DOM legend (`addLegendOptions`); native legend hidden. Interactive show/hide + color persist as field-config overrides.                                                                                                              |
| `animation`                                                                                    | Supported                                             | Off by default for every family; opt in via the Advanced `animation.enabled` switch.                                                                                                                                                         |
| `color` / `textStyle`                                                                          | Supported                                             | Derived from the Grafana theme.                                                                                                                                                                                                              |
| `visualMap`                                                                                    | Not implemented                                       | Registered for the heatmap family only.                                                                                                                                                                                                      |
| `dataZoom`                                                                                     | Not implemented                                       | Range zoom is delegated to `brush` -> dashboard time range.                                                                                                                                                                                  |
| `toolbox` / `dataset` / `title` / `graphic` / `timeline` / `aria`                              | Not implemented                                       | Not registered.                                                                                                                                                                                                                              |
| Other coordinate systems (`polar` / `parallel` / `singleAxis` / `geo` / `calendar` / `matrix`) | Not implemented                                       | Cartesian `grid` only.                                                                                                                                                                                                                       |
