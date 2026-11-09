# Status history editor option parity

Compares the ECharts **Status history** module ([module.tsx](./module.tsx)), rendering
`seriesType: custom`, against core Grafana's **Status history** panel
([`public/app/plugins/panel/status-history/module.tsx`](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/status-history/module.tsx)).

The panel uses the chart module of the [state timeline](../state-timeline/parity.md) in core's
Samples mode: one cell per sample, never merged. The `status-history` chart family selects the mode.
The frame format is in [data-plane/timeline.md](../../../data-plane/timeline.md#samples-mode). The
option paths and defaults are core's.

## Coverage columns

- **Regression test**: `canvas:` names a case in the [canvas snapshot suite][canvas] (recorded draw
  calls). `integration:` names a case in the [integration suite][integration], which compares
  renders. `unit:` names a data prep, option or tooltip test. `—` means no test.
- **Demo panel**: the ECharts panel in the [core parity dashboard][db-parity], which puts core's
  panel on the left and this panel on the right with the same query and options. Live links assume
  `docker compose up` on the default `GRAFANA_PORT` (`http://localhost:3001`).

## Panel options

| Core Grafana option             | ECharts equivalent                                                                                  | Status        | Regression test                                                                                                                                                                                   | Demo panel                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Show values (Auto/Always/Never) | `showValue`, default Auto. The text is always centred                                               | Supported     | [integration: centres the value text on each cell][integration], [integration: draws the value text of each sample, not merged step labels][integration]                                          | [parity dashboard][db-parity] · [#100][live-100] |
| Row height                      | `rowHeight`, default 0.9                                                                            | Supported     | [canvas: status grid of numbers in threshold colours][canvas]                                                                                                                                     | [parity dashboard][db-parity] · [#112][live-112] |
| Column width                    | `colWidth`, default 0.9 of the first sample interval                                                | Supported     | [canvas: column width 0.5][canvas], [integration: draws narrower cells with a lower colWidth, on the same centres][integration], [unit: centres a cell of cellWidth on each sample time][options] | [parity dashboard][db-parity] · [#112][live-112] |
| Page size (enable pagination)   | —                                                                                                   | Not supported | —                                                                                                                                                                                                 | —                                                |
| Legend                          | Read-only `VizLegend`: threshold steps, or state colours                                            | Supported     | [unit: lists threshold steps in threshold colour mode][prepare]                                                                                                                                   | [parity dashboard][db-parity] · [#101][live-101] |
| Tooltip mode                    | Single, All and Hidden. The sample time and value, no duration. Sort and hide zeros are not applied | Partial       | [unit: shows the sample time and the lane value only in samples mode][tooltip] · [integration: lists the cell of each lane at the hovered time in the All tooltip][tooltip-int]                   | [parity dashboard][db-parity] · [#100][live-100] |
| Annotations                     | —                                                                                                   | Not supported | —                                                                                                                                                                                                 | —                                                |

## Field options

| Core Grafana option   | ECharts equivalent                                       | Status        | Regression test                                                                                                    | Demo panel                                       |
| --------------------- | -------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Line width            | `custom.lineWidth`, default 1. Border inside the cell    | Supported     | [canvas: status grid of numbers in threshold colours][canvas], [canvas: string states with value mappings][canvas] | [parity dashboard][db-parity] · [#112][live-112] |
| Fill opacity          | `custom.fillOpacity`, default 70                         | Supported     | [unit: names lanes by display name and applies fillOpacity to the value colour][prepare]                           | [parity dashboard][db-parity] · [#100][live-100] |
| Color scheme          | Grafana `field.display`, default Thresholds              | Supported     | [canvas: status grid of numbers in threshold colours][canvas]                                                      | [parity dashboard][db-parity] · [#101][live-101] |
| Value mappings        | Grafana `field.display`; mapped `null`/`NaN` draw a cell | Supported     | [canvas: string states with value mappings][canvas], [unit: draws no cell for undefined, null or NaN][prepare]     | [parity dashboard][db-parity] · [#108][live-108] |
| Thresholds            | Grafana `field.display`; never merged by step            | Supported     | [unit: does not merge threshold steps][prepare]                                                                    | [parity dashboard][db-parity] · [#103][live-103] |
| Axis placement, width | —                                                        | Not supported | —                                                                                                                  | —                                                |
| Hide in area          | —                                                        | Not supported | —                                                                                                                  | —                                                |

## Data shapes

| Shape                             | Status    | Regression test                                                                                                                                                                      | Demo panel                                       |
| --------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| One cell per sample, never merged | Supported | [integration: draws one cell per sample and never merges, even with mergeValues on][integration], [unit: draws one cell per sample, never merged, even with mergeValues on][prepare] | [parity dashboard][db-parity] · [#112][live-112] |
| Edge cells in full (axis padding) | Supported | [integration: draws every cell at the same width: the half-interval axis padding keeps the edge cells whole][integration]                                                            | [parity dashboard][db-parity] · [#112][live-112] |
| Booleans                          | Supported | —                                                                                                                                                                                    | [parity dashboard][db-parity] · [#110][live-110] |
| No data                           | Supported | —                                                                                                                                                                                    | [parity dashboard][db-parity] · [#111][live-111] |

## Differences from core

- **Too many points.** Core shows "Too many points to visualize properly" when a frame has more
  rows than half the panel width. This panel draws the cells. The chart module does not get the
  panel width. Issue #100.
- **X axis ticks.** Core puts the ticks on the sample times. ECharts puts them on round times, so
  a tick can sit between two cells. Issue #101.
- **Last X axis label.** A tick at the right edge can have its label cut ("16:0"). Issue #120.
- The state timeline differences also apply: hover, data outside the time range and density. See
  [its parity doc](../state-timeline/parity.md#differences-from-core).

[canvas]: ../../lib/components/status-history.canvas.test.tsx
[integration]: ../../lib/components/status-history.integration.test.tsx
[prepare]: ../../lib/grafana/timeline/prepareTimeline.test.ts
[options]: ../../lib/echarts/options/timeline.test.ts
[tooltip]: ../../lib/echarts/tooltip/timeline.test.ts
[tooltip-int]: ../../lib/components/timeline-tooltip.integration.test.tsx
[db-parity]: ../../../provisioning/dashboards/timeline/status-history-core-parity.json
[live-100]: http://localhost:3001/d/echarts-status-history-parity?viewPanel=100
[live-101]: http://localhost:3001/d/echarts-status-history-parity?viewPanel=101
[live-103]: http://localhost:3001/d/echarts-status-history-parity?viewPanel=103
[live-108]: http://localhost:3001/d/echarts-status-history-parity?viewPanel=108
[live-110]: http://localhost:3001/d/echarts-status-history-parity?viewPanel=110
[live-111]: http://localhost:3001/d/echarts-status-history-parity?viewPanel=111
[live-112]: http://localhost:3001/d/echarts-status-history-parity?viewPanel=112
