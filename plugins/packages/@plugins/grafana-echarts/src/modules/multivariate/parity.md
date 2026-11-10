# Multivariate (radar + parallel coordinates) editor option parity

Covers the ECharts **Multivariate** module ([module.tsx](./module.tsx)), which
renders `seriesType: radar` or `seriesType: parallel` — chosen via the "Chart
type" picker — from the shared multivariate model.

## No core Grafana equivalent

Grafana core has **no radar or parallel-coordinates panel**, so there is no
option-for-option parity target. This doc records what the module exposes and
compares against ECharts semantics rather than a core panel.

## Shared data model

Both render types read the multivariate model (`converters/multivariate.ts`):

- Each **number field** is one **axis** (a radar indicator / a parallel axis).
- Each **row** is one **polygon** (radar) or one **polyline** (parallel). Its name
  joins the non-empty values of all string fields with a space (`prod web-01`), as
  core pie names its "All values" rows. With no string value, the name is the row
  index. The name is the key of the legend toggle and of a `byName` color override.

This is the usual shape of a query result: one row for each item, one number field
for each metric. ECharts uses the same shape
([`radar.indicator`](https://echarts.apache.org/en/option.html#radar.indicator),
[`series-parallel.data`](https://echarts.apache.org/en/option.html#series-parallel.data)),
and so does the viz contract (`registry/chart-types.json`). The data plane calls it
[numeric long](https://grafana.com/developers/dataplane/numeric). Only the first
frame with a number field is read.

Because both render types draw the same rows over the same axes, the legend
(`buildRadarLegendItems`, one item for each row) and the tooltip (`dataIndex` → row,
`dimensionIndex` → axis) are shared, and toggling radar↔parallel on a panel draws the
same data.

Radar derives a per-indicator `max` (each axis's outer bound) from the visible rows;
parallel omits it so every axis auto-scales independently (each `parallelAxis` is a
value axis).

### Shaping your query

| Query                                                                  | Route                                                                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| SQL `GROUP BY service`, Elasticsearch terms + metrics, a JSON array    | Works as returned                                                                                                |
| Prometheus / Loki instant queries, Format: Table, one query per metric | Add the **Merge** (or **Join by field**) transformation, so the queries share one frame. The data issue names it |
| Key/value data (`metric,value`) for one item                           | Add the **Transpose** transformation. The data issue names it                                                    |

The panel does not transpose data by itself: the shape alone cannot show the
orientation (3 rows × 3 number fields are valid either way), and a wrong guess draws
the wrong chart with no error.

## Editor options

| Area                                                                              | ECharts Multivariate                                                                                  | Notes                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chart type                                                                        | "Chart type" picker (Radar / Parallel)                                                                | Panel-level `seriesType`; the radar and parallel option groups gate on the selection (`isRadarSelected` / `isParallelSelected`)                                                                                              |
| Legend                                                                            | Grafana legend via `addLegendOptions` (no Values)                                                     | One item for each row (polygon / polyline); interactive show/hide (`hideSeriesFrom`) + color (`byName`) persist as field-config overrides on the row name. No calc values: a calc over the axes of one row mixes their units |
| Tooltip: mode                                                                     | `tooltip.mode` (Single/Hidden)                                                                        | Maps to the ECharts tooltip trigger. A hover lists every axis of one row, each with the unit of its own field. **All is withdrawn**: it would add nothing to that                                                            |
| Axes                                                                              | derived from the multivariate model                                                                   | Number fields become radar indicators / parallel axes; rows become polygons / polylines                                                                                                                                      |
| Radar shape (Default: Fill area; Advanced: Shape, Line width, Symbol size, Rings) | `series.areaStyle`, `radar.shape`, `series.lineStyle.width`, `series.symbolSize`, `radar.splitNumber` | Each omitted at its default; shown only when Radar is selected                                                                                                                                                               |
| Parallel style (Default: Smooth; Advanced: Layout, Line width, Line opacity)      | `series.smooth`, `parallel.layout`, `series.lineStyle.width`, `series.lineStyle.opacity`              | Shown only when Parallel is selected. Omitted at their defaults except Line opacity, which defaults to fully opaque rather than ECharts' faint 0.45                                                                          |
| Animation                                                                         | `animation.enabled` (Advanced)                                                                        | **Off by default** for every family; opt in via the Advanced switch or panel JSON                                                                                                                                            |

## Standard (field-config) options

Keeps the full standard field-config set (Color, Unit, Decimals, Min, Max,
Display name, No value, Thresholds, Value mappings, Data links), customizing only
Color (PaletteClassic, byValue + bySeries). Unit and Decimals apply to each axis,
because each axis is one field. Min/Max do not set the axis range yet. Each row
takes the classic palette color of its row index, or a `byName` fixed-color override
on its name. A "Hide in area" (`custom.hideFrom.viz`) override on a number field has
no effect, because that field is an axis, not a polygon. Hide a row from the legend
instead.

## Notes / gaps

- Data model: see [Shared data model](#shared-data-model) — radar and parallel
  share the multivariate model, so a panel toggles between them on one dataset.
- Editor mode: each type's Advanced options reset to their defaults in Default
  editor mode (`applyRadarEditorModeDefaults` / `applyParallelEditorModeDefaults`),
  so an untouched panel renders unchanged.
- Parallel per-line color rides on each data item's `lineStyle.color` (ECharts has
  no per-line `itemStyle` for parallel), resolved from the row's palette color.
- **No proximity hover** for either render type — hovering _near_ a polygon or
  polyline does nothing; you must be on it. This is by design, not a gap. The
  proximity gate (`tooltip/proximity.ts`) admits only `line` / `scatter` /
  `effectScatter`, and the family fails three of its structural preconditions:
  `findHoveredPoint` opens with `containPixel({ gridIndex: 0 })` and neither
  coordinate system builds a `grid`; ECharts' `Parallel` implements no
  `convertToPixel` / `convertFromPixel` (and `Radar`'s are `Not implemented.`
  stubs), which the snap and the y-distance test both call; and proximity keys on
  `seriesIndex`-per-series, while this family emits _one_ series whose polygons /
  polylines are `dataIndex` entries. The "snap on x, pick on y" rule is also
  meaningless here — a parallel cursor sits _between_ N axes, so the honest hit
  test is perpendicular distance to a polyline segment, a different algorithm.
  Both types therefore rely on ECharts' native `trigger: 'item'` hit-testing.
- **Parallel data links need a click on the line**, and re-pinning costs an extra
  one. The data-link footer only renders while the tooltip is pinned, and the pin
  path replays the click into ECharts as `showTip { seriesIndex, dataIndex }`.
  ECharts cannot service that for a parallel coordinate system — it resolves the
  point through `findPointFromSeries`, which calls `coordSys.dataToPoint(values)`
  with one argument, while `Parallel.prototype.dataToPoint(value, dim)` needs the
  dimension and throws without it. (Radar sidesteps this by defining
  `getTooltipPosition`, checked first; parallel defines neither.) `replayTip`
  swallows the throw, so the pin still lands on the content the preceding hover
  produced. The cost is that clicking straight from one pinned line to another
  finds the model already cleared by the dismiss, so that click leaves the
  tooltip unpinned; moving the cursor re-hovers and the next click pins. The
  positional form of `showTip` is not a workaround — it emits nothing for a
  parallel coordinate system even when `findHover` lands on the polyline.
- Parallel sizes its own layout box (`getParallelComponent`) rather than a
  `grid`, and there is no `containLabel` for this coordinate system, so label
  room is reserved in literal px. ECharts' defaults (80/80/60/60) spent about
  two-thirds of a panel on padding. The horizontal and vertical boxes are not
  rotations of each other: with `vertical`, ECharts draws each axis name past the
  _right_ end of its axis and left-aligned, making that side a name column.
- Label allowances in both families are deliberately generous rather than
  minimal. ECharts anchors tick labels and axis names with
  `textBaseline: 'middle'`, so half the line box overhangs the anchor — and the
  jsdom canvas these values are measured against reports where the anchor landed,
  not how far the glyphs reach from it. Sizing the parallel name row from the
  anchor plus half the font looked correct in the measurements and still clipped
  the top of the axis names in a real browser; the same miss clipped radar's top
  indicator on short panels. Hence `LABEL_HALF_LINE` and the tightened
  `RADAR_AXIS_NAME_GAP`. Measure anchors in jsdom, but budget for glyphs it
  cannot see.
- **Radar cannot be fitted to the canvas as precisely as parallel.** It takes no
  layout box — `RadarModel` declares no `layoutMode = 'box'`, so
  `left`/`top`/`right`/`bottom` are ignored — and its `radius` is a percentage of
  `min(canvas width, canvas height) / 2`, with the indicator names hanging
  _outside_ that radius. Because the names cost a fixed number of px while the
  radius is a proportion, no single percentage is ideal at every panel shape:
  wide panels (what Grafana mostly renders) are limited by the cheap vertical
  name gap, near-square ones by the wide side labels. `RADAR_OUTER_RADIUS` is set
  to 75% — matching `PIE_OUTER_RADIUS`, and up from ECharts' 50%, which drew the
  web at a quarter of the panel's smaller dimension. Fitting the labels exactly
  would mean giving the option build the panel's pixel size, which
  `useChartOption` deliberately memoizes away so a resize does not rebuild the
  option; that trade is not worth making for one family.
- Radar also has no way to reserve space for a _native_ ECharts legend (again,
  no box), so it shrinks its radius instead. The default Grafana DOM legend needs
  none of this — `VizLayout` sizes the canvas before the chart mounts.

## ECharts API support

High-level [ECharts option](https://echarts.apache.org/en/option.html) components
used by this module. See [echarts.ts](../../lib/echarts/echarts.ts) for the
registered runtime surface.

| ECharts API                                                                       | Status          | Notes                                                                                                                                                                                           |
| --------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `series` (radar)                                                                  | Supported       | `seriesType: radar`; Advanced area / line width / symbol size.                                                                                                                                  |
| `series` (parallel)                                                               | Supported       | `seriesType: parallel`; Default smooth + Advanced line width / opacity; per-line color via each data item's `lineStyle`.                                                                        |
| `radar` (coordinate system)                                                       | Supported       | One indicator per number field; web radius sized past ECharts' default and themed indicator names. No box layout — see Notes.                                                                   |
| `parallel` / `parallelAxis` (coordinate system)                                   | Supported       | One value axis per number field (auto-scaling); Advanced `parallel.layout` (Horizontal / Vertical). Layout box and themed axis labels/names via `parallel.parallelAxisDefault`.                 |
| `legend`                                                                          | Supported       | Grafana DOM legend (`addLegendOptions`); native legend hidden. One item per row. Interactive show/hide + color persist as field-config overrides on the row name.                               |
| `tooltip`                                                                         | Supported       | Rendered by a React `@grafana/ui` `VizTooltip` overlay; one row per axis, each with its field's formatter and data links at the hovered row (shared by radar and parallel). Single/Hidden only. |
| `animation`                                                                       | Supported       | Off by default for every family; opt in via the Advanced switch or `animation.enabled` in panel JSON.                                                                                           |
| `color` / `textStyle`                                                             | Supported       | Derived from the Grafana theme.                                                                                                                                                                 |
| `grid` / `xAxis` / `yAxis`                                                        | Not implemented | Radar and parallel use their own coordinate systems, not cartesian.                                                                                                                             |
| `visualMap` / `markLine` / `markArea` / `axisPointer` / `brush` / `dataZoom`      | Not implemented | Cartesian-oriented components; N/A here.                                                                                                                                                        |
| `toolbox` / `dataset` / `title` / `graphic` / `timeline` / `aria`                 | Not implemented | Not registered.                                                                                                                                                                                 |
| Other coordinate systems (`polar` / `singleAxis` / `geo` / `calendar` / `matrix`) | Not implemented | —                                                                                                                                                                                               |
