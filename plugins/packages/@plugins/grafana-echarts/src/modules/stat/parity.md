# Stat editor option parity

This document compares the ECharts **Stat** module ([module.tsx](./module.tsx)) with the core Grafana
[Stat panel](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/).

The option names, values and defaults are the ones of core Stat
([panelcfg.cue](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/stat/panelcfg.cue)), so a
panel keeps its options when it changes type.

Demo dashboard: `provisioning/dashboards/stat/stat-basics.json`. Each row has the ECharts panel at the left
and the core panel at the right, with the same data and options.

Tests:

- Canvas baselines: [stat.canvas.test.tsx](../../lib/components/stat.canvas.test.tsx)
- Drawn texts and counts: [stat.integration.test.tsx](../../lib/components/stat.integration.test.tsx)
- Layout arithmetic: [layout.test.ts](../../lib/grafana/stat/layout.test.ts)

## Status

The module is at the MVP level: it draws the default look of core Stat. `Planned` options are not in the
editor, and the panel ignores them in saved panel JSON.

| Core option                                                     | Status    | Regression test                                    | Demo panel                   |
| --------------------------------------------------------------- | --------- | -------------------------------------------------- | ---------------------------- |
| `reduceOptions` (Show, Calculation, Limit, Fields)              | Supported | `fieldDisplays.test.ts`                            | all                          |
| Standard options: unit, decimals, min, max, display name, color | Supported | canvas: "one value, stacked with a sparkline"      | One value                    |
| Standard options: thresholds                                    | Supported | canvas: "Value, with the color of a threshold"     | Thresholds                   |
| Standard options: value mappings                                | Supported | none yet                                           | Value mappings and decimals  |
| Standard options: No value                                      | Different | `statIssue.test.ts`                                | No number field              |
| Many values in an automatic grid                                | Supported | canvas: "four values in a grid"                    | Four values, Eight values    |
| `textMode` auto, value, value and name, name, none              | Supported | canvas: "text mode"; integration: text mode cases  | Text mode Name, None         |
| `wideLayout`                                                    | Supported | canvas: "wide with a sparkline", "wide layout off" | Wide layout, Wide layout off |
| `colorMode` none, value                                         | Supported | canvas: "color mode"                               | Color mode None              |
| `graphMode` none, area                                          | Supported | canvas: "graph mode"; integration: sparkline cases | Graph mode None              |
| `colorMode` background gradient, background solid               | Planned   |                                                    |                              |
| `justifyMode`                                                   | Planned   |                                                    |                              |
| `orientation` horizontal, vertical                              | Planned   |                                                    |                              |
| `text.titleSize`, `text.valueSize`                              | Planned   |                                                    |                              |
| `showPercentChange`, `percentChangeColorMode`                   | Planned   |                                                    |                              |
| Data links and actions                                          | Planned   |                                                    |                              |
| Presets, panel change handler, migration of old stat JSON       | Planned   |                                                    |                              |

A panel that has a `Planned` color mode draws with the `value` color mode.

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
