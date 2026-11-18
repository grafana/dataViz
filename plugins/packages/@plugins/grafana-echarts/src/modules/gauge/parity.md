# Gauge editor option parity

This document compares the ECharts **Gauge** module ([module.tsx](./module.tsx)) with the core Grafana **Gauge**
panel
([`public/app/plugins/panel/gauge/module.tsx`](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/gauge/module.tsx)).

The panel is experimental (`"state": "beta"` in [plugin.json](./plugin.json)). The Renderer does not draw it.

## Design

The panel draws one gauge for each value. Grafana reduces the frames to values with `getFieldDisplayValues`, as core
Gauge does. All gauges are in one ECharts instance: a grid layout gives each gauge a cell, and each gauge is one or
two ECharts `gauge` series.

| Step                       | Code                                                                               | Side                  |
| -------------------------- | ---------------------------------------------------------------------------------- | --------------------- |
| Frames to values           | `resolveFieldDisplays`, `applyPercentUnitRange` ([fieldDisplays.ts][src-displays]) | Grafana               |
| Values to the gauge model  | `resolveGaugeValues` ([converters/gauge.ts][src-conv])                             | Grafana to plain data |
| Panel to cells             | `layoutRepeaterCells` ([repeater/layout.ts][src-repeater])                         | Pixel arithmetic      |
| Cell to arcs and text      | `layoutGaugeGeometry`, `layoutGaugeText` ([gauge/layout.ts][src-layout])           | Pixel arithmetic      |
| Model and layout to series | `getGaugeSeries` ([options/gauge.ts][src-opts])                                    | ECharts               |
| Join of the steps          | `gaugeChartModule` ([charts/gauge.ts][src-chart])                                  | Both                  |

The option names, the option values and the defaults are those of core Gauge, so the options of a core panel keep
their meaning.

## Decisions

- **Two series for each gauge.** The first series is the threshold band: a thin outer ring with the color of each
  threshold step and no data. The second series is the value bar: a grey track and a progress arc in the value
  color. One series cannot do the two jobs, because the threshold colors then replace the grey track and the
  progress arc hides the thresholds below the value.
- **Text fit.** The font sizes come from `fitFontSize` ([fitFontSize.ts][src-fit]). It measures with the font family
  of the theme, the family that ECharts draws with. All gauges of a panel get the font sizes of the longest value
  and the longest name.
- **Name in small gauges.** The name keeps a font size of 10px or more, as core. It is not hidden.
- **Angles.** An arc gauge covers 220 degrees with the opening down: ECharts `startAngle: 200`, `endAngle: -20`.
  These are the core constants `ARC_START = 250` and `ARC_END = 110`, changed to the angle convention of ECharts.

## Coverage columns

- **Regression test**: the test that pins the behaviour. `canvas:` is a case of the [canvas suite][canvas].
  `integration:` is a case of the [integration suite][integration]. `unit:` names a unit test file.
  "needs e2e" marks what these tests cannot prove.
- **Demo panel**: the provisioned dashboard panel that shows the option. Live links assume the package stack on
  port 3020.

## Core options

| Core option                                                  | ECharts gauge                                           | Status    | Regression test                                                                                                                                                | Demo panel                                           |
| ------------------------------------------------------------ | ------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Value options (`reduceOptions`)                              | `addStandardDataReduceOptions`, default `lastNotNull`   | Supported | [unit: resolveFieldDisplays][t-displays], [unit: resolveGaugeModel][t-chart]                                                                                   | [gauge-basics.json][db-basics] · [#8 live][live-8]   |
| Standard options: min, max                                   | Range of the bar; equal limits move apart               | Supported | [canvas: percentage thresholds on a range that is not 0 to 100][canvas], [unit: resolveGaugeRange][t-conv]                                                     | [gauge-basics.json][db-basics] · [#2 live][live-2]   |
| Standard options: unit, decimals, mappings, no value         | From the Grafana display processor                      | Supported | [canvas: percent unit uses the range 0 to 100][canvas], [canvas: no value draws the track only][canvas]                                                        | [gauge-basics.json][db-basics] · [#8 live][live-8]   |
| Standard options: color                                      | Color of the progress arc                               | Supported | [unit: resolveGaugeModel][t-chart]                                                                                                                             | [gauge-basics.json][db-basics] · [#2 live][live-2]   |
| Standard options: thresholds (absolute and percentage)       | Threshold band and value color                          | Supported | [canvas: arc (the default)][canvas], [canvas: percentage thresholds on a range that is not 0 to 100][canvas], [unit: resolveGaugeThresholds][t-conv]           | [gauge-basics.json][db-basics] · [#8 live][live-8]   |
| Percent units get the range 0 to 100 / 0 to 1                | `applyPercentUnitRange`                                 | Supported | [canvas: percent unit uses the range 0 to 100][canvas], [unit: applyPercentUnitRange][t-displays]                                                              | [gauge-basics.json][db-basics] · [#8 live][live-8]   |
| Prefix and suffix of the value at 70% of the value font size | `getGaugeValueText`, rich text of `detail`              | Supported | [canvas: percent unit uses the range 0 to 100][canvas], [canvas: a currency prefix draws smaller than the value][canvas], [unit: getGaugeValueText][t-options] | [gauge-basics.json][db-basics] · [#8 live][live-8]   |
| Style (`shape`): Circle / Arc                                | `shape`; `getGaugeAngles`                               | Supported | [canvas: arc (the default)][canvas], [canvas: circle][canvas]                                                                                                  | [gauge-basics.json][db-basics] · [#4 live][live-4]   |
| Bar width factor (`barWidthFactor`)                          | `barWidthFactor`; `layoutGaugeGeometry`                 | Supported | [canvas: thin bar][canvas], [canvas: wide bar][canvas]                                                                                                         | [gauge-basics.json][db-basics] · [#9 live][live-9]   |
| Text mode (`textMode`)                                       | `textMode`; `resolveGaugeTextParts`                     | Supported | [canvas: value and name][canvas], [canvas: name][canvas], [canvas: none][canvas], [integration: draws the value of one gauge and no name][integration]         | [gauge-basics.json][db-basics] · [#10 live][live-10] |
| Show thresholds (`showThresholdMarkers`)                     | `showThresholdMarkers`; `getGaugeBandSeries`            | Supported | [canvas: no threshold band][canvas], [integration: draws fewer shapes with no threshold band][integration]                                                     | [gauge-basics.json][db-basics] · [#9 live][live-9]   |
| Many values, automatic grid                                  | `layoutRepeaterCells`                                   | Supported | [canvas: four gauges in a grid, with names][canvas], [canvas: four circles in a grid][canvas], [unit: layoutRepeaterCells][t-repeater]                         | [gauge-basics.json][db-basics] · [#6 live][live-6]   |
| Value outside the range                                      | Bar at the nearest limit; the text shows the real value | Supported | [canvas: above the maximum draws a full bar][canvas], [canvas: below the minimum draws an empty bar][canvas]                                                   | —                                                    |
| Suggestions (Gauge, Circular gauge)                          | `gaugeSuggestionsSupplier`                              | Supported | [unit: gaugeSuggestionsSupplier][t-suggest]; the cards need e2e                                                                                                | —                                                    |
| Orientation (`orientation`)                                  | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Gauge size (`sizing`, `minVizWidth`, `minVizHeight`)         | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Segments (`segmentCount`, `segmentSpacing`)                  | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Bar style (`barShape`)                                       | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Endpoint marker (`endpointMarker`)                           | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Neutral value (`neutral`)                                    | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Show sparkline (`sparkline`)                                 | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Show labels (`showThresholdLabels`)                          | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Effects (`effects.gradient`, `barGlow`, `centerGlow`)        | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Text size (`text.titleSize`, `text.valueSize`)               | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Data links and actions menu                                  | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Presets                                                      | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |
| Migration and panel change handlers                          | —                                                       | Not yet   | —                                                                                                                                                              | —                                                    |

## Known differences from core

- The light theme has no canvas case. The colors come from the theme, and the unit test of `gaugeChartModule` pins
  the text colors.
- A gauge of a field with no threshold step draws no threshold band.
- The panel has no tooltip and no legend, as core.
- A value text with the rich text syntax of ECharts (`{name|text}`), or a prefix or a suffix with `}`, draws at one
  font size.
- A suggestion has the options, the field config and the score of the core suggestion, without `sparkline`: this
  panel does not have that option yet. A preview card uses the shared card options of this package
  (`previewCardOptions`), not the card options of core (unit `short`, a limit of 4 values).

[canvas]: ../../lib/components/gauge.canvas.test.tsx
[integration]: ../../lib/components/gauge.integration.test.tsx
[t-displays]: ../../lib/grafana/fieldDisplays.test.ts
[t-conv]: ../../lib/echarts/converters/gauge.test.ts
[t-options]: ../../lib/echarts/options/gauge.test.ts
[t-chart]: ../../lib/echarts/charts/gauge.test.ts
[t-repeater]: ../../lib/grafana/repeater/layout.test.ts
[t-suggest]: ./suggestions.test.ts
[src-displays]: ../../lib/grafana/fieldDisplays.ts
[src-conv]: ../../lib/echarts/converters/gauge.ts
[src-repeater]: ../../lib/grafana/repeater/layout.ts
[src-layout]: ../../lib/grafana/gauge/layout.ts
[src-opts]: ../../lib/echarts/options/gauge.ts
[src-chart]: ../../lib/echarts/charts/gauge.ts
[src-fit]: ../../lib/grafana/fitFontSize.ts
[db-basics]: ../../../provisioning/dashboards/gauge/gauge-basics.json
[live-2]: http://localhost:3020/d/b7c1d2e3-f4a5-4b60-9c71-d8e9f0a1b2c3?viewPanel=2
[live-4]: http://localhost:3020/d/b7c1d2e3-f4a5-4b60-9c71-d8e9f0a1b2c3?viewPanel=4
[live-6]: http://localhost:3020/d/b7c1d2e3-f4a5-4b60-9c71-d8e9f0a1b2c3?viewPanel=6
[live-8]: http://localhost:3020/d/b7c1d2e3-f4a5-4b60-9c71-d8e9f0a1b2c3?viewPanel=8
[live-9]: http://localhost:3020/d/b7c1d2e3-f4a5-4b60-9c71-d8e9f0a1b2c3?viewPanel=9
[live-10]: http://localhost:3020/d/b7c1d2e3-f4a5-4b60-9c71-d8e9f0a1b2c3?viewPanel=10
