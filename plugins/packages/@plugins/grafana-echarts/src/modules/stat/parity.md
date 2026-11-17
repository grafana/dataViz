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

| Core option                                                     | Status    | Regression test                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Demo panel                                  |
| --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `reduceOptions` (Show, Calculation, Limit, Fields)              | Supported | [fieldDisplays.test.ts][field-displays], [integration: draws the last value of the series, with its unit][integration]                                                                                                                                                                                                                                                                                                                                                               | [all][db-basics]                            |
| Standard options: unit, decimals, min, max, display name, color | Supported | [canvas: one value, stacked with a sparkline][canvas]                                                                                                                                                                                                                                                                                                                                                                                                                                | [One value][db-basics]                      |
| Standard options: thresholds                                    | Supported | [canvas: Value, with the color of a threshold][canvas]                                                                                                                                                                                                                                                                                                                                                                                                                               | [Thresholds][db-basics]                     |
| Standard options: value mappings                                | Supported | [canvas: a mapped text in the color of the mapping][canvas]                                                                                                                                                                                                                                                                                                                                                                                                                          | [Value mappings and decimals][db-basics]    |
| Standard options: No value                                      | Different | [statIssue.test.ts][issue]                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [No number field][db-basics]                |
| Many values in an automatic grid                                | Supported | [canvas: four values in a grid][canvas], [canvas: twelve values in a grid, with no space for sparklines][canvas], [integration: draws the name of each value when the panel has more than one value][integration]                                                                                                                                                                                                                                                                    | [Four values, Eight values][db-basics]      |
| `textMode` auto, value, value and name, name, none              | Supported | [canvas: one value with its name, stacked with a sparkline][canvas], [canvas: Name: the name as the large text][canvas], [canvas: None: the sparkline only][canvas], [integration: draws no name for one value when the panel has a title][integration], [integration: draws the name of one value when the panel has no title][integration], [integration: draws only the name in the Name text mode][integration], [integration: draws no text in the None text mode][integration] | [Text mode Name, Text mode None][db-basics] |
| `wideLayout`                                                    | Supported | [canvas: wide with a sparkline][canvas], [canvas: wide with no sparkline][canvas], [canvas: wide layout off][canvas]                                                                                                                                                                                                                                                                                                                                                                 | [Wide layout, Wide layout off][db-basics]   |
| `colorMode` none, value                                         | Supported | [canvas: None][canvas], [canvas: Value, with the color of a threshold][canvas]                                                                                                                                                                                                                                                                                                                                                                                                       | [Color mode None][db-basics]                |
| `graphMode` none, area                                          | Supported | [canvas: None: the value at the center, with no sparkline][canvas], [canvas: a gap for null values][canvas], [canvas: a series with one row][canvas], [integration: draws one sparkline line for each value][integration], [integration: draws no sparkline when the graph mode is None][integration], [integration: draws no sparkline for a series with one row][integration]                                                                                                      | [Graph mode None][db-basics]                |
| `colorMode` background gradient, background solid               | Planned   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                             |
| `justifyMode`                                                   | Planned   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                             |
| `orientation` horizontal, vertical                              | Planned   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                             |
| `text.titleSize`, `text.valueSize`                              | Planned   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                             |
| `showPercentChange`, `percentChangeColorMode`                   | Planned   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                             |
| Data links and actions                                          | Planned   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                             |
| Presets, panel change handler, migration of old stat JSON       | Planned   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                             |

A panel that has a `Planned` color mode draws with the `value` color mode.

[canvas]: ../../lib/components/stat.canvas.test.tsx
[integration]: ../../lib/components/stat.integration.test.tsx
[layout]: ../../lib/grafana/stat/layout.test.ts
[field-displays]: ../../lib/grafana/fieldDisplays.test.ts
[issue]: ../../lib/echarts/charts/statIssue.test.ts
[db-basics]: ../../../provisioning/dashboards/stat/stat-basics.json

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
- **Layout code has no ECharts import** (`lib/grafana/stat/layout.ts`), and the option code has no Grafana UI
  import (`lib/echarts/options/stat.ts`). The `StatCell` model is the only type between them.

## Differences from core

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
  migration. The core panels of the demo dashboard have a `pluginVersion`, so the two columns compare.
- **Suggestions.** Core Stat has cards for a table of text and for one value for each row. This panel has one
  card, for data with a number field.
