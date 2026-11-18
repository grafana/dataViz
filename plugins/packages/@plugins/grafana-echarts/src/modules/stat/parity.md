# Stat editor option parity

This document compares the ECharts **Stat** module ([module.tsx](./module.tsx)) with the core Grafana
[Stat panel](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/).

The option names, values and defaults are the ones of core Stat
([panelcfg.cue](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/stat/panelcfg.cue)), so a
panel keeps its options when it changes type.

Demo dashboard: the [stat basics dashboard][db-basics]. Each row has the ECharts panel at the left and the
core panel at the right, with the same data and options.

How to read the table:

- **Regression test**: `canvas:` names a case in the [canvas snapshot suite][canvas] (recorded draw calls).
  `integration:` names a case in the [integration suite][integration], which reads the drawn texts and
  counts. Other links are unit test files. `src/test/parityCitations.test.ts` fails when a cited case does
  not exist.
- **Demo panel**: the title of the row in the [stat basics dashboard][db-basics].

Layout arithmetic has its own unit tests: [layout.test.ts][layout].

## Status

The module is at the MVP level: it draws the default look of core Stat. `Planned` options are not in the
editor, and the panel ignores them in saved panel JSON.

| Core option                                                       | Status    | Regression test                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Demo panel                                                                                                                |
| ----------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `reduceOptions` (Show, Calculation, Limit, Fields)                | Supported | [fieldDisplays.test.ts][field-displays], [integration: draws the last value of the series, with its unit][integration]                                                                                                                                                                                                                                                                                                                                                               | [all][db-basics]                                                                                                          |
| Standard options: unit, decimals, min, max, display name, color   | Supported | [canvas: one value, stacked with a sparkline][canvas]                                                                                                                                                                                                                                                                                                                                                                                                                                | [One value][db-basics]                                                                                                    |
| Standard options: thresholds                                      | Supported | [canvas: Value, with the color of a threshold][canvas]                                                                                                                                                                                                                                                                                                                                                                                                                               | [Thresholds][db-basics]                                                                                                   |
| Standard options: value mappings                                  | Supported | [canvas: a mapped text in the color of the mapping][canvas]                                                                                                                                                                                                                                                                                                                                                                                                                          | [Value mappings and decimals][db-basics]                                                                                  |
| Standard options: No value                                        | Different | [statIssue.test.ts][issue]                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [No number field][db-basics]                                                                                              |
| Many values in an automatic grid                                  | Supported | [canvas: four values in a grid][canvas], [canvas: twelve values in a grid, with no space for sparklines][canvas], [integration: draws the name of each value when the panel has more than one value][integration]                                                                                                                                                                                                                                                                    | [Four values, Eight values][db-basics]                                                                                    |
| `textMode` auto, value, value and name, name, none                | Supported | [canvas: one value with its name, stacked with a sparkline][canvas], [canvas: Name: the name as the large text][canvas], [canvas: None: the sparkline only][canvas], [integration: draws no name for one value when the panel has a title][integration], [integration: draws the name of one value when the panel has no title][integration], [integration: draws only the name in the Name text mode][integration], [integration: draws no text in the None text mode][integration] | [Text mode Name, Text mode None][db-basics]                                                                               |
| `wideLayout`                                                      | Supported | [canvas: wide with a sparkline][canvas], [canvas: wide with no sparkline][canvas], [canvas: wide layout off][canvas]                                                                                                                                                                                                                                                                                                                                                                 | [Wide layout, Wide layout off][db-basics]                                                                                 |
| `colorMode` none, value                                           | Supported | [canvas: None][canvas], [canvas: Value, with the color of a threshold][canvas]                                                                                                                                                                                                                                                                                                                                                                                                       | [Color mode None][db-basics]                                                                                              |
| `graphMode` none, area                                            | Supported | [canvas: None: the value at the center, with no sparkline][canvas], [canvas: a gap for null values][canvas], [canvas: a series with one row][canvas], [integration: draws one sparkline line for each value][integration], [integration: draws no sparkline when the graph mode is None][integration], [integration: draws no sparkline for a series with one row][integration]                                                                                                      | [Graph mode None][db-basics]                                                                                              |
| `colorMode` background gradient, background solid                 | Supported | [canvas: Background Gradient][canvas], [canvas: Background Solid][canvas], [canvas: Background Gradient, four values in a grid][canvas], [colors.test.ts][colors]                                                                                                                                                                                                                                                                                                                    | [Color mode Background Gradient, Color mode Background Solid][db-basics]                                                  |
| `justifyMode` auto, center                                        | Supported | [canvas: Center, stacked with a sparkline][canvas], [canvas: Center, wide with no sparkline][canvas], [canvas: Center, four values in a grid][canvas], [layout.test.ts][layout]                                                                                                                                                                                                                                                                                                      | [Text alignment Center, Text alignment Center, wide][db-basics]                                                           |
| `orientation` auto, horizontal, vertical                          | Supported | [canvas: Horizontal: one cell for each row of the panel][canvas], [canvas: Vertical: one cell for each column of the panel][canvas], [repeater/layout.test.ts][repeater]                                                                                                                                                                                                                                                                                                             | [Orientation Horizontal, Orientation Vertical][db-basics]                                                                 |
| `text.titleSize`, `text.valueSize`                                | Supported | [canvas: a set size for the name and for the value][canvas], [canvas: a set size for the value only, four values in a grid][canvas], [layout.test.ts][layout]                                                                                                                                                                                                                                                                                                                        | [Text size][db-basics]                                                                                                    |
| `showPercentChange`, `percentChangeColorMode`, `text.percentSize` | Supported | [canvas: an increase, stacked with a sparkline][canvas], [canvas: wide with no sparkline][canvas], [canvas: four values in a grid, with the text alignment Center][canvas], [canvas: the text mode None][canvas], [percentChange.test.ts][percent-change], [flow.test.ts][flow]                                                                                                                                                                                                      | [Percent change, Percent change centered inverted colors, Percent change no sparkline same color as the value][db-basics] |
| Data links and actions                                            | Partial   | [integration: opens the link of a value with one link on a click][data-links], [integration: opens a menu with each link of a value with two links on a click][data-links], [integration: shows the menu cursor on a value with two links][data-links], [dataLinks.test.ts][data-links-unit]                                                                                                                                                                                         | [Data links, one link, Data links, two links][db-basics]                                                                  |
| Change of the panel type from core Stat                           | Supported | [panelChange.test.ts][panel-change], [panelChange/stat.test.ts][import]                                                                                                                                                                                                                                                                                                                                                                                                              | each core panel of the [dashboard][db-basics]                                                                             |
| Change of the panel type from other panel types                   | Supported | [panelChange.test.ts][panel-change], [panelChange/singleStat.test.ts][single-stat]                                                                                                                                                                                                                                                                                                                                                                                                   |                                                                                                                           |
| Presets, Stat JSON before 7.0                                     | Planned   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                                                                                                           |

The default color scheme is `thresholds`, as in core Stat, and not `palette-classic` as in the other ECharts
panels ([standardOptions.ts](../../lib/grafana/editor/stat/standardOptions.ts)). A new panel thus draws each
value in the color of its threshold. Regression tests: [standardOptions.test.ts][standard-options],
[canvas: Value, with the default color scheme of the panel][canvas]. Demo panel:
[Thresholds, default color scheme][db-basics].

Data links are `Partial`: a click and the cursor are as in core, and the keyboard and the native tooltips are
not (see "Differences from core"). Field actions are not a difference: core Stat gives only the links of a
value to its menu, and does not handle actions.

[canvas]: ../../lib/components/stat.canvas.test.tsx
[integration]: ../../lib/components/stat.integration.test.tsx
[data-links]: ../../lib/components/stat-data-links.integration.test.tsx
[data-links-unit]: ../../lib/grafana/dataLinks.test.ts
[layout]: ../../lib/grafana/stat/layout.test.ts
[colors]: ../../lib/grafana/stat/colors.test.ts
[repeater]: ../../lib/grafana/repeater/layout.test.ts
[percent-change]: ../../lib/grafana/stat/percentChange.test.ts
[flow]: ../../lib/grafana/stat/flow.test.ts
[field-displays]: ../../lib/grafana/fieldDisplays.test.ts
[panel-change]: ./panelChange.test.ts
[single-stat]: ../../lib/grafana/panelChange/singleStat.test.ts
[import]: ../../lib/grafana/panelChange/stat.test.ts
[issue]: ../../lib/echarts/charts/statIssue.test.ts
[standard-options]: ../../lib/grafana/editor/stat/standardOptions.test.ts
[db-basics]: ../../../provisioning/dashboards/stat/stat-basics.json

## Many values

The panel draws one cell for each value, with no limit of its own, as core Stat. The limit of "All values" is
the Limit option. All values are data items of one series, so a panel with 200 values has one ECharts series.
Regression tests: [integration: draws the name of each of %s values, and no name is cut][integration],
[layout.test.ts][layout]. Demo panels: [50 values, 200 values][db-basics].

## Streaming data

The panel draws each update of a query that streams, as core Stat
([streaming.ts](../../lib/echarts/charts/streaming.ts)). The other ECharts panels draw nothing until the query
is done. A live data source streams with no end, and the panel shows its last value. Regression tests:
[integration: draws the last value of each update while the data streams][integration],
[streaming.test.ts](../../lib/echarts/charts/streaming.test.ts). Demo panel: [Streaming data][db-basics].

## Change from core Stat

A change of the panel type from core Stat to this panel keeps the Stat options, the standard field options and
the overrides ([panelChange.ts](./panelChange.ts)). The option names and values are the ones of core, so the
adapter ([panelChange/stat.ts](../../lib/grafana/panelChange/stat.ts)) copies them and changes no value. The
status of each setting is in
[capabilities/stat.json](../../lib/grafana/panelChange/capabilities/stat.json).

The adapter also reads core Stat JSON that Grafana did not load. For a panel with a `pluginVersion` before
8.0, or with none, it applies the last rule of the migration of core: a field with the unit `percent` or
`percentunit` gets the range of its unit. It does not apply the older rules, for JSON with `fieldOptions` from
before Grafana 7.0.

A change from another panel type keeps `reduceOptions` and `orientation` when the previous panel has them, as
core Stat ([panelChange/singleStat.ts](../../lib/grafana/panelChange/singleStat.ts)). Core Gauge and core Bar
gauge have the two options. Grafana keeps the standard field options. Core Stat also has rules for the Angular
Singlestat and Graph panels, which Grafana does not have now. This panel does not have those rules.

## Design decisions

- **One `custom` series, no coordinate system.** Each value is one data item. `renderItem` returns a group
  with the sparkline, the name and the value at pixel positions. The alternative was the `graphic` component,
  which is a new ECharts module in the bundle and has no data items for a click.
  [series-custom](https://echarts.apache.org/en/option.html#series-custom)
- **The layout is made in `renderItem`.** The panel builds the ECharts option only when the data or the
  options change, and not when the panel size changes. `renderItem` reads the chart size and asks for the
  layout, so the cells follow a resize.
- **`stat` is a routing token, not an ECharts series type.** The timeline family owns the `custom` token in
  `resolveChartModule`.
- **The sparkline is a polyline and a polygon in the same `custom` series.** It is not a `line` series on a
  `grid`. A panel with 50 values then has one series, not 50 grids and 50 series.
- **The font fit measures with the font that ECharts draws with** (`lib/grafana/fitFontSize.ts`). Core measures
  with the fixed family `Inter`. In Grafana the two are equal. In a host with no Inter font, the text fits its
  box in the fallback font, and only the font size differs from core.
- **The background colors are computed, not given to CSS.** Core gives the gradient to the browser as
  `linear-gradient(120deg, …)` with two `hsl(from …)` colors. A canvas has no CSS background, so
  `lib/grafana/stat/colors.ts` does the same arithmetic: the two HSL shifts, and the start and the end of the
  gradient line of CSS. The cell fill is an ECharts linear gradient with those pixel positions.
  [color](https://echarts.apache.org/en/option.html#color)
- **The text positions are pixel arithmetic for a flexbox.** Core gives the name, the value and the percent
  change to a CSS flexbox: a column in a stacked cell, and a row that wraps in a wide cell. The centered text
  alignment adds the gap `0.75ch`. `lib/grafana/stat/flow.ts` does the arithmetic of those flexbox rules, and
  `lib/grafana/stat/layout.ts` measures the texts and gives them to it as items.
- **The arrow of a percent change is an SVG path.** Core shows the `arrow-up` and `arrow-down` icons of Grafana.
  `lib/echarts/options/stat.ts` has the two paths, and draws one as a `path` element in the color of the text.
  In a wide cell, the bottom of the arrow is on the baseline of the text, which the layout gets from the metrics
  of the Inter font.
- **Data links are a click on the canvas.** Core puts a cell with links in a DOM element: an `<a>` for one
  link, and a menu trigger for more. A canvas cell is not a DOM element. A cell with links gets one invisible
  rectangle that takes pointer events, and ECharts gives the click with the `dataIndex` of the value. For one
  link, `lib/grafana/dataLinks.ts` makes the `<a>` element of core and clicks it, so the link handler of
  Grafana opens the link. For more links, `lib/components/DataLinksMenu.tsx` shows the Grafana context menu.
  Those two files and `useDataLinkClicks` have no stat code, so the gauge panel can use them.
  [Mouse events](https://echarts.apache.org/en/api.html#events.Mouse%20events)
- **Layout code has no ECharts import** (`lib/grafana/stat/layout.ts`), and the option code has no Grafana UI
  import (`lib/echarts/options/stat.ts`). The `StatCell` model is the only type between them.

## Differences from core

- **Background gradient mix.** The two colors of the gradient are the same as in core, and so is the gradient
  line. The colors between them differ a little: in a browser check against core Stat in Grafana 13.3.0, the
  largest difference was 8 of 255 in one color channel. The canvas mixes the two colors in sRGB. The browser
  mixes the colors of a CSS gradient in Oklab when a color is not in a legacy format, and `hsl(from …)` is not.
  [Interpolation](https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient#interpolation_in_rectangular_color_space)
- **No value.** When the data has no value, core Stat draws the "No value" text (or "No data") as a large
  value. This panel shows the data issue view: the "No value" text if the option is set, else the Grafana text
  "Data is missing a number field".
- **Sparkline gaps.** A null value makes a gap, as in core. Core also makes a gap where rows are missing for
  longer than the interval of the series. This panel does not.
- **Sparkline order.** Core sorts the rows by time. This panel draws the rows in frame order, which is the
  order of a data plane time series frame.
- **Suffix baseline.** ECharts aligns the parts of a rich text at the bottom of the line. The suffix gets a
  bottom padding of 25% of the difference of the two font sizes, which puts it on the baseline of the value
  within about one pixel.
- **Text position.** CSS and the canvas do not put text at the same position in its line. In a browser check
  against core Stat in Grafana 13.3.0, the font sizes were equal, and a large text was a few pixels higher than
  in core. Parity means the same layout (wide or stacked, with or without a sparkline) and a font size within
  1px.
- **Core panels with no `pluginVersion`.** Core Stat runs its migration for a panel saved before Grafana 8.0,
  which sets `min` 0 and `max` 100 for the `percent` unit. The sparkline then has that range. This panel has no
  migration of its own JSON. The core panels of the demo dashboard have a `pluginVersion`, so the two columns
  compare. The import from core Stat applies the rule (see "Change from core Stat").
- **A name that is wider than its cell.** Core does not cut a name: a name with a set size that is wider than
  its cell goes out of the cell, or wraps at a space. This panel cuts that name at the width of its box, with
  an ellipsis. A name with no set size is fitted to its cell, and the two panels draw it in full.
- **Data links: keyboard.** In core, a cell with links takes the keyboard focus, shows a focus ring, and opens
  its link or its menu with Enter or Space. A canvas cell takes no focus, so this panel opens links only with
  the pointer.
- **Data links: native tooltips.** Core shows a browser tooltip on a cell: the title of the link on a cell with
  one link, and the name or the value that the text mode hides on a cell with no link. This panel shows none.
- **Suggestions.** Core Stat has cards for a table of text and for one value for each row. This panel has one
  card, for data with a number field.
